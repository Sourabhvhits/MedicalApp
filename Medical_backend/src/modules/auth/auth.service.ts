import type { OtpPurpose, User, UserType } from '@prisma/client';
import { prisma, type PrismaTx } from '../../database/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  durationToMs,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenPayload,
} from '../../utils/jwt';
import { generateOtp, hashOtp, otpExpiry } from '../../utils/otp';
import { entityCode } from '../../utils/numbering';
import { logger } from '../../lib/logger';
import { recordAudit } from '../../lib/audit';
import { sendMail, renderTemplate } from '../../lib/mailer';
import { sendSms } from '../../lib/sms';
import { notifyAdmins } from '../notifications/notification.service';
import { AUDIT_MODULES } from '../../config/constants';
import type { LoginInput, RegisterInput } from './auth.validation';

export interface SessionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthProfile {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  userType: UserType;
  status: string;
  avatarUrl: string | null;
  permissions: string[];
  vendorId: string | null;
  retailerId: string | null;
  customerId: string | null;
  approvalStatus: string | null;
}

const isEmail = (identifier: string) => identifier.includes('@');

/** Resolves an email-or-phone identifier to a user row. */
async function findUserByIdentifier(identifier: string): Promise<User | null> {
  const value = identifier.trim();
  return prisma.user.findFirst({
    where: isEmail(value)
      ? { email: value.toLowerCase(), deletedAt: null }
      : { phone: value, deletedAt: null },
  });
}

/** Collects every permission code granted by the user's roles. */
async function loadPermissions(userId: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
  });

  const codes = new Set<string>();
  for (const row of rows) {
    for (const rp of row.role.permissions) codes.add(rp.permission.code);
  }
  return [...codes];
}

async function loadScopes(userId: string) {
  const [vendor, retailer, customer, staff] = await Promise.all([
    prisma.vendor.findUnique({ where: { userId }, select: { id: true, approvalStatus: true } }),
    prisma.retailer.findUnique({ where: { userId }, select: { id: true, approvalStatus: true } }),
    prisma.customer.findUnique({ where: { userId }, select: { id: true } }),
    prisma.staffMember.findUnique({
      where: { userId },
      select: {
        status: true,
        vendor: { select: { id: true, approvalStatus: true } },
        retailer: { select: { id: true, approvalStatus: true } },
      },
    }),
  ]);

  // A staff login resolves to the same business scope its owner does — the
  // `StaffMember` row is a second, parallel path to the same vendorId/
  // retailerId `loadScopes` already returns for the owner account, so every
  // existing `vendorScope(req)`/`retailerScope(req)` check downstream works
  // unchanged. Deactivating the staff row (not the parent business) is
  // enough to cut access off.
  const staffActive = staff?.status === 'ACTIVE';

  return {
    vendor: vendor ?? (staffActive ? staff!.vendor : null),
    retailer: retailer ?? (staffActive ? staff!.retailer : null),
    customer,
    isStaff: Boolean(!vendor && !retailer && staffActive),
  };
}

export async function buildProfile(user: User): Promise<AuthProfile> {
  const [permissions, scopes] = await Promise.all([loadPermissions(user.id), loadScopes(user.id)]);
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    userType: user.userType,
    status: user.status,
    avatarUrl: user.avatarUrl,
    permissions,
    vendorId: scopes.vendor?.id ?? null,
    retailerId: scopes.retailer?.id ?? null,
    customerId: scopes.customer?.id ?? null,
    approvalStatus: scopes.vendor?.approvalStatus ?? scopes.retailer?.approvalStatus ?? null,
  };
}

async function issueTokens(user: User, context: SessionContext): Promise<{ tokens: AuthTokens; profile: AuthProfile }> {
  const profile = await buildProfile(user);

  const payload: AccessTokenPayload = {
    sub: user.id,
    userType: user.userType,
    vendorId: profile.vendorId,
    retailerId: profile.retailerId,
    customerId: profile.customerId,
    permissions: profile.permissions,
  };

  const accessToken = signAccessToken(payload);
  const refreshTtlMs = durationToMs(env.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + refreshTtlMs);

  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: 'pending',
      userAgent: context.userAgent?.slice(0, 255) ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt,
    },
  });

  const refreshToken = signRefreshToken({ sub: user.id, sid: session.id });
  await prisma.userSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashToken(refreshToken) },
  });

  return {
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(durationToMs(env.JWT_ACCESS_EXPIRES_IN) / 1000),
    },
    profile,
  };
}

/** Assigns the system role matching the account type. */
async function assignDefaultRole(tx: PrismaTx, userId: string, userType: UserType): Promise<void> {
  const slug =
    userType === 'SUPER_ADMIN'
      ? 'super-admin'
      : userType === 'ADMIN_STAFF'
        ? 'admin-staff'
        : userType.toLowerCase();

  const role = await tx.role.findUnique({ where: { slug }, select: { id: true } });
  if (!role) {
    logger.warn({ slug }, 'Default role missing — run the database seed');
    return;
  }
  await tx.userRole.create({ data: { userId, roleId: role.id } });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput, context: SessionContext) {
  const email = input.email?.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone: input.phone }, ...(email ? [{ email }] : [])] },
    select: { id: true, email: true, phone: true },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.phone === input.phone
        ? 'An account with this mobile number already exists'
        : 'An account with this email already exists',
    );
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: email ?? null,
        phone: input.phone,
        passwordHash,
        userType: input.userType,
        // Customers are usable immediately; businesses wait for admin approval.
        status: input.userType === 'CUSTOMER' ? 'ACTIVE' : 'ACTIVE',
      },
    });

    await assignDefaultRole(tx, created.id, input.userType);

    if (input.userType === 'CUSTOMER') {
      const sequence = await tx.customer.count();
      await tx.customer.create({
        data: { userId: created.id, code: entityCode('CUS', sequence + 1) },
      });
    } else if (input.userType === 'VENDOR') {
      const sequence = await tx.vendor.count();
      await tx.vendor.create({
        data: {
          userId: created.id,
          code: entityCode('VEN', sequence + 1),
          businessName: input.businessName!,
          phone: input.phone,
          email: email ?? null,
          contactPerson: `${input.firstName} ${input.lastName ?? ''}`.trim(),
          approvalStatus: 'PENDING',
        },
      });
    } else {
      const sequence = await tx.retailer.count();
      const retailer = await tx.retailer.create({
        data: {
          userId: created.id,
          code: entityCode('RET', sequence + 1),
          storeName: input.businessName!,
          phone: input.phone,
          email: email ?? null,
          ownerName: `${input.firstName} ${input.lastName ?? ''}`.trim(),
          approvalStatus: 'PENDING',
        },
      });

      // Sensible defaults so a new store is immediately configurable.
      await tx.pickupSlotConfig.create({ data: { retailerId: retailer.id } });
      await tx.storeBusinessHour.createMany({
        data: Array.from({ length: 7 }, (_, day) => ({
          retailerId: retailer.id,
          dayOfWeek: day,
          isClosed: false,
          openTime: '09:00',
          closeTime: '21:00',
        })),
      });
    }

    return created;
  });

  await issueOtp(input.phone, 'PHONE_VERIFICATION', user.id).catch((error) =>
    logger.warn({ err: error }, 'Failed to send verification OTP'),
  );

  if (input.userType !== 'CUSTOMER') {
    void notifyAdmins({
      event: 'user.registered',
      title: 'New business registration',
      body: `${input.businessName} registered as a ${input.userType.toLowerCase()} and is awaiting approval.`,
      data: { userId: user.id, userType: input.userType },
    }).catch(() => undefined);
  }

  await recordAudit({
    userId: user.id,
    userType: user.userType,
    action: 'register',
    module: AUDIT_MODULES.AUTH,
    recordId: user.id,
    newValue: { userType: input.userType, phone: input.phone, email },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  const { tokens, profile } = await issueTokens(user, context);
  return { user: profile, tokens };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(input: LoginInput, context: SessionContext) {
  const user = await findUserByIdentifier(input.identifier);

  // Same error for unknown user and wrong password — no account enumeration.
  if (!user?.passwordHash) throw ApiError.unauthorized('Invalid credentials');

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid credentials');

  assertLoginAllowed(user);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await recordAudit({
    userId: user.id,
    userType: user.userType,
    action: 'login',
    module: AUDIT_MODULES.AUTH,
    recordId: user.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  const { tokens, profile } = await issueTokens(user, context);
  return { user: profile, tokens };
}

function assertLoginAllowed(user: User): void {
  if (user.deletedAt) throw ApiError.unauthorized('Invalid credentials');
  if (user.status === 'SUSPENDED') {
    throw ApiError.forbidden('Your account has been suspended. Contact support.');
  }
  if (user.status === 'INACTIVE') {
    throw ApiError.forbidden('Your account is inactive. Contact support.');
  }
}

// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

export async function issueOtp(identifier: string, purpose: OtpPurpose, userId?: string) {
  const code = generateOtp();

  await prisma.otpToken.updateMany({
    where: { identifier, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.otpToken.create({
    data: {
      userId: userId ?? null,
      identifier,
      codeHash: hashOtp(code),
      purpose,
      expiresAt: otpExpiry(),
    },
  });

  const message = `Your ${env.APP_NAME} verification code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`;

  if (isEmail(identifier)) {
    await sendMail({
      to: identifier,
      subject: `${env.APP_NAME} verification code`,
      html: renderTemplate('Your verification code', `<p style="font-size:24px;letter-spacing:4px"><b>${code}</b></p><p>${message}</p>`),
      text: message,
    });
  } else {
    await sendSms(identifier, message);
  }

  // Returned only outside production so the flow is testable without a provider.
  return env.isProd ? { sent: true } : { sent: true, devCode: code };
}

export async function sendOtp(identifier: string, purpose: OtpPurpose) {
  const user = await findUserByIdentifier(identifier);

  if (purpose === 'LOGIN' || purpose === 'FORGOT_PASSWORD') {
    // Do not reveal whether the account exists.
    if (!user) return { sent: true };
    return issueOtp(identifier, purpose, user.id);
  }
  return issueOtp(identifier, purpose, user?.id);
}

/** Validates an OTP and marks it consumed. Throws on any failure. */
export async function consumeOtp(identifier: string, purpose: OtpPurpose, code: string) {
  const token = await prisma.otpToken.findFirst({
    where: { identifier, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) throw ApiError.badRequest('No active verification code. Request a new one.');
  if (token.expiresAt < new Date()) throw ApiError.badRequest('This code has expired. Request a new one.');
  if (token.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw ApiError.tooMany('Too many incorrect attempts. Request a new code.');
  }

  if (token.codeHash !== hashOtp(code)) {
    await prisma.otpToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    throw ApiError.badRequest('Incorrect verification code');
  }

  await prisma.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
  return token;
}

export async function verifyOtp(
  identifier: string,
  purpose: OtpPurpose,
  code: string,
  context: SessionContext,
) {
  const token = await consumeOtp(identifier, purpose, code);
  const user = token.userId
    ? await prisma.user.findUnique({ where: { id: token.userId } })
    : await findUserByIdentifier(identifier);

  if (!user) throw ApiError.notFound('Account not found');

  const verificationField = isEmail(identifier) ? 'emailVerifiedAt' : 'phoneVerifiedAt';
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      [verificationField]: new Date(),
      status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
      lastLoginAt: purpose === 'LOGIN' ? new Date() : user.lastLoginAt,
    },
  });

  if (purpose === 'FORGOT_PASSWORD') {
    // Password reset completes in resetPassword — no session is issued here.
    return { verified: true as const };
  }

  assertLoginAllowed(updated);
  const { tokens, profile } = await issueTokens(updated, context);
  return { verified: true as const, user: profile, tokens };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export async function refresh(refreshToken: string, context: SessionContext) {
  const payload = verifyRefreshToken(refreshToken);

  const session = await prisma.userSession.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
  });

  if (!session || session.id !== payload.sid || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized('Account not found');
  assertLoginAllowed(user);

  // Rotate: the presented refresh token can never be replayed.
  await prisma.userSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const { tokens, profile } = await issueTokens(user, context);
  return { user: profile, tokens };
}

export async function logout(refreshToken?: string, userId?: string): Promise<void> {
  if (refreshToken) {
    await prisma.userSession.updateMany({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return;
  }
  if (userId) {
    await prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export async function forgotPassword(identifier: string) {
  return sendOtp(identifier, 'FORGOT_PASSWORD');
}

export async function resetPassword(identifier: string, code: string, newPassword: string) {
  await consumeOtp(identifier, 'FORGOT_PASSWORD', code);

  const user = await findUserByIdentifier(identifier);
  if (!user) throw ApiError.notFound('Account not found');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    // Every existing session is invalidated after a password reset.
    prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAudit({
    userId: user.id,
    userType: user.userType,
    action: 'password.reset',
    module: AUDIT_MODULES.AUTH,
    recordId: user.id,
  });

  return { reset: true };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) throw ApiError.notFound('Account not found');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await recordAudit({
    userId,
    userType: user.userType,
    action: 'password.change',
    module: AUDIT_MODULES.AUTH,
    recordId: userId,
  });

  return { changed: true };
}

export async function me(userId: string): Promise<AuthProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw ApiError.notFound('Account not found');
  return buildProfile(user);
}

export async function listSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const result = await prisma.userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound('Session not found');
}
