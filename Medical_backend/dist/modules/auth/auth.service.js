"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProfile = buildProfile;
exports.register = register;
exports.login = login;
exports.issueOtp = issueOtp;
exports.sendOtp = sendOtp;
exports.consumeOtp = consumeOtp;
exports.verifyOtp = verifyOtp;
exports.refresh = refresh;
exports.logout = logout;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.changePassword = changePassword;
exports.me = me;
exports.listSessions = listSessions;
exports.revokeSession = revokeSession;
const prisma_1 = require("../../database/prisma");
const env_1 = require("../../config/env");
const ApiError_1 = require("../../utils/ApiError");
const password_1 = require("../../utils/password");
const jwt_1 = require("../../utils/jwt");
const otp_1 = require("../../utils/otp");
const numbering_1 = require("../../utils/numbering");
const logger_1 = require("../../lib/logger");
const audit_1 = require("../../lib/audit");
const mailer_1 = require("../../lib/mailer");
const sms_1 = require("../../lib/sms");
const notification_service_1 = require("../notifications/notification.service");
const constants_1 = require("../../config/constants");
const isEmail = (identifier) => identifier.includes('@');
/** Resolves an email-or-phone identifier to a user row. */
async function findUserByIdentifier(identifier) {
    const value = identifier.trim();
    return prisma_1.prisma.user.findFirst({
        where: isEmail(value)
            ? { email: value.toLowerCase(), deletedAt: null }
            : { phone: value, deletedAt: null },
    });
}
/** Collects every permission code granted by the user's roles. */
async function loadPermissions(userId) {
    const rows = await prisma_1.prisma.userRole.findMany({
        where: { userId },
        select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
    });
    const codes = new Set();
    for (const row of rows) {
        for (const rp of row.role.permissions)
            codes.add(rp.permission.code);
    }
    return [...codes];
}
async function loadScopes(userId) {
    const [vendor, retailer, customer] = await Promise.all([
        prisma_1.prisma.vendor.findUnique({ where: { userId }, select: { id: true, approvalStatus: true } }),
        prisma_1.prisma.retailer.findUnique({ where: { userId }, select: { id: true, approvalStatus: true } }),
        prisma_1.prisma.customer.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    return { vendor, retailer, customer };
}
async function buildProfile(user) {
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
async function issueTokens(user, context) {
    const profile = await buildProfile(user);
    const payload = {
        sub: user.id,
        userType: user.userType,
        vendorId: profile.vendorId,
        retailerId: profile.retailerId,
        customerId: profile.customerId,
        permissions: profile.permissions,
    };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshTtlMs = (0, jwt_1.durationToMs)(env_1.env.JWT_REFRESH_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + refreshTtlMs);
    const session = await prisma_1.prisma.userSession.create({
        data: {
            userId: user.id,
            refreshTokenHash: 'pending',
            userAgent: context.userAgent?.slice(0, 255) ?? null,
            ipAddress: context.ipAddress ?? null,
            expiresAt,
        },
    });
    const refreshToken = (0, jwt_1.signRefreshToken)({ sub: user.id, sid: session.id });
    await prisma_1.prisma.userSession.update({
        where: { id: session.id },
        data: { refreshTokenHash: (0, jwt_1.hashToken)(refreshToken) },
    });
    return {
        tokens: {
            accessToken,
            refreshToken,
            expiresIn: Math.floor((0, jwt_1.durationToMs)(env_1.env.JWT_ACCESS_EXPIRES_IN) / 1000),
        },
        profile,
    };
}
/** Assigns the system role matching the account type. */
async function assignDefaultRole(tx, userId, userType) {
    const slug = userType === 'SUPER_ADMIN'
        ? 'super-admin'
        : userType === 'ADMIN_STAFF'
            ? 'admin-staff'
            : userType.toLowerCase();
    const role = await tx.role.findUnique({ where: { slug }, select: { id: true } });
    if (!role) {
        logger_1.logger.warn({ slug }, 'Default role missing — run the database seed');
        return;
    }
    await tx.userRole.create({ data: { userId, roleId: role.id } });
}
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
async function register(input, context) {
    const email = input.email?.toLowerCase();
    const existing = await prisma_1.prisma.user.findFirst({
        where: { OR: [{ phone: input.phone }, ...(email ? [{ email }] : [])] },
        select: { id: true, email: true, phone: true },
    });
    if (existing) {
        throw ApiError_1.ApiError.conflict(existing.phone === input.phone
            ? 'An account with this mobile number already exists'
            : 'An account with this email already exists');
    }
    const passwordHash = await (0, password_1.hashPassword)(input.password);
    const user = await prisma_1.prisma.$transaction(async (tx) => {
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
                data: { userId: created.id, code: (0, numbering_1.entityCode)('CUS', sequence + 1) },
            });
        }
        else if (input.userType === 'VENDOR') {
            const sequence = await tx.vendor.count();
            await tx.vendor.create({
                data: {
                    userId: created.id,
                    code: (0, numbering_1.entityCode)('VEN', sequence + 1),
                    businessName: input.businessName,
                    phone: input.phone,
                    email: email ?? null,
                    contactPerson: `${input.firstName} ${input.lastName ?? ''}`.trim(),
                    approvalStatus: 'PENDING',
                },
            });
        }
        else {
            const sequence = await tx.retailer.count();
            const retailer = await tx.retailer.create({
                data: {
                    userId: created.id,
                    code: (0, numbering_1.entityCode)('RET', sequence + 1),
                    storeName: input.businessName,
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
    await issueOtp(input.phone, 'PHONE_VERIFICATION', user.id).catch((error) => logger_1.logger.warn({ err: error }, 'Failed to send verification OTP'));
    if (input.userType !== 'CUSTOMER') {
        void (0, notification_service_1.notifyAdmins)({
            event: 'user.registered',
            title: 'New business registration',
            body: `${input.businessName} registered as a ${input.userType.toLowerCase()} and is awaiting approval.`,
            data: { userId: user.id, userType: input.userType },
        }).catch(() => undefined);
    }
    await (0, audit_1.recordAudit)({
        userId: user.id,
        userType: user.userType,
        action: 'register',
        module: constants_1.AUDIT_MODULES.AUTH,
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
async function login(input, context) {
    const user = await findUserByIdentifier(input.identifier);
    // Same error for unknown user and wrong password — no account enumeration.
    if (!user?.passwordHash)
        throw ApiError_1.ApiError.unauthorized('Invalid credentials');
    const valid = await (0, password_1.verifyPassword)(input.password, user.passwordHash);
    if (!valid)
        throw ApiError_1.ApiError.unauthorized('Invalid credentials');
    assertLoginAllowed(user);
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await (0, audit_1.recordAudit)({
        userId: user.id,
        userType: user.userType,
        action: 'login',
        module: constants_1.AUDIT_MODULES.AUTH,
        recordId: user.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
    });
    const { tokens, profile } = await issueTokens(user, context);
    return { user: profile, tokens };
}
function assertLoginAllowed(user) {
    if (user.deletedAt)
        throw ApiError_1.ApiError.unauthorized('Invalid credentials');
    if (user.status === 'SUSPENDED') {
        throw ApiError_1.ApiError.forbidden('Your account has been suspended. Contact support.');
    }
    if (user.status === 'INACTIVE') {
        throw ApiError_1.ApiError.forbidden('Your account is inactive. Contact support.');
    }
}
// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------
async function issueOtp(identifier, purpose, userId) {
    const code = (0, otp_1.generateOtp)();
    await prisma_1.prisma.otpToken.updateMany({
        where: { identifier, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
    });
    await prisma_1.prisma.otpToken.create({
        data: {
            userId: userId ?? null,
            identifier,
            codeHash: (0, otp_1.hashOtp)(code),
            purpose,
            expiresAt: (0, otp_1.otpExpiry)(),
        },
    });
    const message = `Your ${env_1.env.APP_NAME} verification code is ${code}. It expires in ${env_1.env.OTP_EXPIRY_MINUTES} minutes.`;
    if (isEmail(identifier)) {
        await (0, mailer_1.sendMail)({
            to: identifier,
            subject: `${env_1.env.APP_NAME} verification code`,
            html: (0, mailer_1.renderTemplate)('Your verification code', `<p style="font-size:24px;letter-spacing:4px"><b>${code}</b></p><p>${message}</p>`),
            text: message,
        });
    }
    else {
        await (0, sms_1.sendSms)(identifier, message);
    }
    // Returned only outside production so the flow is testable without a provider.
    return env_1.env.isProd ? { sent: true } : { sent: true, devCode: code };
}
async function sendOtp(identifier, purpose) {
    const user = await findUserByIdentifier(identifier);
    if (purpose === 'LOGIN' || purpose === 'FORGOT_PASSWORD') {
        // Do not reveal whether the account exists.
        if (!user)
            return { sent: true };
        return issueOtp(identifier, purpose, user.id);
    }
    return issueOtp(identifier, purpose, user?.id);
}
/** Validates an OTP and marks it consumed. Throws on any failure. */
async function consumeOtp(identifier, purpose, code) {
    const token = await prisma_1.prisma.otpToken.findFirst({
        where: { identifier, purpose, consumedAt: null },
        orderBy: { createdAt: 'desc' },
    });
    if (!token)
        throw ApiError_1.ApiError.badRequest('No active verification code. Request a new one.');
    if (token.expiresAt < new Date())
        throw ApiError_1.ApiError.badRequest('This code has expired. Request a new one.');
    if (token.attempts >= env_1.env.OTP_MAX_ATTEMPTS) {
        throw ApiError_1.ApiError.tooMany('Too many incorrect attempts. Request a new code.');
    }
    if (token.codeHash !== (0, otp_1.hashOtp)(code)) {
        await prisma_1.prisma.otpToken.update({
            where: { id: token.id },
            data: { attempts: { increment: 1 } },
        });
        throw ApiError_1.ApiError.badRequest('Incorrect verification code');
    }
    await prisma_1.prisma.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    return token;
}
async function verifyOtp(identifier, purpose, code, context) {
    const token = await consumeOtp(identifier, purpose, code);
    const user = token.userId
        ? await prisma_1.prisma.user.findUnique({ where: { id: token.userId } })
        : await findUserByIdentifier(identifier);
    if (!user)
        throw ApiError_1.ApiError.notFound('Account not found');
    const verificationField = isEmail(identifier) ? 'emailVerifiedAt' : 'phoneVerifiedAt';
    const updated = await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            [verificationField]: new Date(),
            status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
            lastLoginAt: purpose === 'LOGIN' ? new Date() : user.lastLoginAt,
        },
    });
    if (purpose === 'FORGOT_PASSWORD') {
        // Password reset completes in resetPassword — no session is issued here.
        return { verified: true };
    }
    assertLoginAllowed(updated);
    const { tokens, profile } = await issueTokens(updated, context);
    return { verified: true, user: profile, tokens };
}
// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------
async function refresh(refreshToken, context) {
    const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
    const session = await prisma_1.prisma.userSession.findUnique({
        where: { refreshTokenHash: (0, jwt_1.hashToken)(refreshToken) },
    });
    if (!session || session.id !== payload.sid || session.revokedAt || session.expiresAt < new Date()) {
        throw ApiError_1.ApiError.unauthorized('Session expired, please sign in again');
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user)
        throw ApiError_1.ApiError.unauthorized('Account not found');
    assertLoginAllowed(user);
    // Rotate: the presented refresh token can never be replayed.
    await prisma_1.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
    });
    const { tokens, profile } = await issueTokens(user, context);
    return { user: profile, tokens };
}
async function logout(refreshToken, userId) {
    if (refreshToken) {
        await prisma_1.prisma.userSession.updateMany({
            where: { refreshTokenHash: (0, jwt_1.hashToken)(refreshToken), revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return;
    }
    if (userId) {
        await prisma_1.prisma.userSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
}
async function forgotPassword(identifier) {
    return sendOtp(identifier, 'FORGOT_PASSWORD');
}
async function resetPassword(identifier, code, newPassword) {
    await consumeOtp(identifier, 'FORGOT_PASSWORD', code);
    const user = await findUserByIdentifier(identifier);
    if (!user)
        throw ApiError_1.ApiError.notFound('Account not found');
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await (0, password_1.hashPassword)(newPassword) },
        }),
        // Every existing session is invalidated after a password reset.
        prisma_1.prisma.userSession.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
        }),
    ]);
    await (0, audit_1.recordAudit)({
        userId: user.id,
        userType: user.userType,
        action: 'password.reset',
        module: constants_1.AUDIT_MODULES.AUTH,
        recordId: user.id,
    });
    return { reset: true };
}
async function changePassword(userId, currentPassword, newPassword) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash)
        throw ApiError_1.ApiError.notFound('Account not found');
    const valid = await (0, password_1.verifyPassword)(currentPassword, user.passwordHash);
    if (!valid)
        throw ApiError_1.ApiError.badRequest('Current password is incorrect');
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await (0, password_1.hashPassword)(newPassword) },
    });
    await (0, audit_1.recordAudit)({
        userId,
        userType: user.userType,
        action: 'password.change',
        module: constants_1.AUDIT_MODULES.AUTH,
        recordId: userId,
    });
    return { changed: true };
}
async function me(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt)
        throw ApiError_1.ApiError.notFound('Account not found');
    return buildProfile(user);
}
async function listSessions(userId) {
    return prisma_1.prisma.userSession.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
    });
}
async function revokeSession(userId, sessionId) {
    const result = await prisma_1.prisma.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    if (result.count === 0)
        throw ApiError_1.ApiError.notFound('Session not found');
}
//# sourceMappingURL=auth.service.js.map