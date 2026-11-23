import type { UserType } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/password';
import type { StockOwner } from '../inventory/inventory.service';
import type { InviteStaffInput } from './staff.validation';

/** Roles a business owner may offer when inviting staff — every role scoped
 * to their account type, admin-managed like any other role (`/admin/roles`).
 * Not filtered down to just the seeded "*-staff" role so an owner can also
 * hand a trusted manager the full owner-equivalent role if they choose. */
export async function listAvailableRoles(scope: UserType) {
  return prisma.role.findMany({
    where: { scope },
    select: { id: true, name: true, slug: true, description: true },
    orderBy: { name: 'asc' },
  });
}

export async function listStaff(owner: StockOwner) {
  return prisma.staffMember.findMany({
    where: {
      ...(owner.vendorId ? { vendorId: owner.vendorId } : {}),
      ...(owner.retailerId ? { retailerId: owner.retailerId } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          lastLoginAt: true,
          roles: { select: { role: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Creates the staff member's own login and links it to the business.
 * Mirrors `admin.service.ts#createAdminUser` — the owner sets the initial
 * password directly and shares it out of band, the same pattern already
 * used for admin-staff accounts, rather than inventing a separate
 * email-invite-link flow this codebase doesn't have anywhere else yet.
 */
export async function inviteStaff(
  owner: StockOwner,
  data: InviteStaffInput,
  invitedById: string,
) {
  const role = await prisma.role.findUnique({ where: { id: data.roleId }, select: { id: true, scope: true } });
  if (!role) throw ApiError.badRequest('Role not found');
  if (role.scope !== owner.ownerType) {
    throw ApiError.badRequest(`This role is not available for a ${owner.ownerType.toLowerCase()} account`);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { phone: data.phone }] },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict('A user with this email or mobile number already exists');

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone,
      passwordHash,
      userType: owner.ownerType,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      createdById: invitedById,
      roles: { create: { roleId: role.id } },
      staffMembership: {
        create: {
          ownerType: owner.ownerType,
          vendorId: owner.vendorId ?? null,
          retailerId: owner.retailerId ?? null,
          invitedById,
        },
      },
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true },
  });

  return user;
}

async function getOwnedStaffMember(owner: StockOwner, staffMemberId: string) {
  const staff = await prisma.staffMember.findFirst({
    where: {
      id: staffMemberId,
      ...(owner.vendorId ? { vendorId: owner.vendorId } : {}),
      ...(owner.retailerId ? { retailerId: owner.retailerId } : {}),
    },
  });
  if (!staff) throw ApiError.notFound('Staff member not found');
  return staff;
}

/** Deactivating revokes every active session too, so it takes effect
 * immediately rather than only on their next token refresh. */
export async function setStaffStatus(owner: StockOwner, staffMemberId: string, status: 'ACTIVE' | 'INACTIVE') {
  const staff = await getOwnedStaffMember(owner, staffMemberId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.staffMember.update({ where: { id: staff.id }, data: { status } });
    await tx.user.update({ where: { id: staff.userId }, data: { status } });
    if (status === 'INACTIVE') {
      await tx.userSession.updateMany({ where: { userId: staff.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return updated;
  });
}
