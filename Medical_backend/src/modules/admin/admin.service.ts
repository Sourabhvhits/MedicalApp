import type { ApprovalStatus, Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { hashPassword } from '../../utils/password';
import { slugify } from '../../utils/slug';
import { dayjs, endOfDay, startOfDay } from '../../utils/time';
import { toNumber } from '../../utils/money';
import { notify } from '../notifications/notification.service';
import { NOTIFICATION_EVENTS } from '../../config/constants';
import { invalidateSecuritySettingsCache } from '../../lib/security-settings';
import { toSignedUrl } from '../../lib/signed-url';
import * as vendorService from '../vendors/vendor.service';
import * as retailerService from '../retailers/retailer.service';

// ---------------------------------------------------------------------------
// Vendor & retailer approvals
// ---------------------------------------------------------------------------

export async function listVendors(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.VendorWhereInput = { deletedAt: null };
  if (query.approvalStatus) where.approvalStatus = query.approvalStatus as ApprovalStatus;
  if (query.city) where.city = query.city as string;
  if (query.state) where.state = query.state as string;
  if (query.isActive !== undefined) where.isActive = query.isActive as boolean;
  if (query.search) {
    const search = query.search as string;
    where.OR = [
      { businessName: { contains: search } },
      { code: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
      { gstNumber: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, phone: true, status: true, lastLoginAt: true } },
        _count: { select: { products: true, documents: true, purchaseOrders: true } },
      },
      orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.vendor.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function getVendor(id: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      documents: true,
      warehouses: true,
      _count: { select: { products: true, purchaseOrders: true } },
    },
  });
  if (!vendor) throw ApiError.notFound('Vendor not found');
  return {
    ...vendor,
    documents: vendor.documents.map((doc) => ({ ...doc, fileUrl: toSignedUrl(doc.fileUrl) ?? doc.fileUrl })),
  };
}

export async function decideVendor(
  id: string,
  decision: ApprovalStatus,
  reason: string | undefined,
  adminId: string,
) {
  const vendor = await getVendor(id);

  const updated = await prisma.vendor.update({
    where: { id },
    data: {
      approvalStatus: decision,
      rejectionReason: decision === 'REJECTED' || decision === 'SUSPENDED' ? (reason ?? null) : null,
      approvedAt: decision === 'APPROVED' ? new Date() : null,
      approvedById: decision === 'APPROVED' ? adminId : null,
      isActive: decision === 'APPROVED',
    },
  });

  // A newly approved vendor needs a default warehouse before it can hold stock.
  if (decision === 'APPROVED') {
    const existing = await prisma.warehouse.findFirst({ where: { vendorId: id }, select: { id: true } });
    if (!existing) {
      await prisma.warehouse.create({
        data: {
          ownerType: 'VENDOR',
          vendorId: id,
          name: `${vendor.businessName} — Main Warehouse`,
          code: 'MAIN',
          addressLine1: vendor.addressLine1,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          isDefault: true,
        },
      });
    }
  }

  await notify({
    userId: vendor.userId,
    event: decision === 'APPROVED' ? NOTIFICATION_EVENTS.VENDOR_APPROVED : NOTIFICATION_EVENTS.VENDOR_REJECTED,
    title: `Vendor application ${decision.toLowerCase()}`,
    body:
      decision === 'APPROVED'
        ? 'Your vendor account has been approved. You can now list products and receive orders.'
        : `Your vendor application was ${decision.toLowerCase()}.${reason ? ` Reason: ${reason}` : ''}`,
    channels: ['IN_APP', 'EMAIL'],
  });

  return updated;
}

export async function listRetailers(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.RetailerWhereInput = { deletedAt: null };
  if (query.approvalStatus) where.approvalStatus = query.approvalStatus as ApprovalStatus;
  if (query.city) where.city = query.city as string;
  if (query.state) where.state = query.state as string;
  if (query.isActive !== undefined) where.isActive = query.isActive as boolean;
  if (query.search) {
    const search = query.search as string;
    where.OR = [
      { storeName: { contains: search } },
      { code: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
      { gstNumber: { contains: search } },
      { pincode: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.retailer.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, phone: true, status: true, lastLoginAt: true } },
        _count: { select: { products: true, documents: true, orders: true } },
      },
      orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.retailer.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function getRetailer(id: string) {
  const retailer = await prisma.retailer.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
      documents: true,
      images: true,
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
      pickupConfig: true,
      _count: { select: { products: true, orders: true } },
    },
  });
  if (!retailer) throw ApiError.notFound('Medical shop not found');
  return {
    ...retailer,
    documents: retailer.documents.map((doc) => ({ ...doc, fileUrl: toSignedUrl(doc.fileUrl) ?? doc.fileUrl })),
  };
}

export async function decideRetailer(
  id: string,
  decision: ApprovalStatus,
  reason: string | undefined,
  adminId: string,
) {
  const retailer = await getRetailer(id);

  const updated = await prisma.retailer.update({
    where: { id },
    data: {
      approvalStatus: decision,
      rejectionReason: decision === 'REJECTED' || decision === 'SUSPENDED' ? (reason ?? null) : null,
      approvedAt: decision === 'APPROVED' ? new Date() : null,
      approvedById: decision === 'APPROVED' ? adminId : null,
      isActive: decision === 'APPROVED',
    },
  });

  if (decision === 'APPROVED') {
    const existing = await prisma.warehouse.findFirst({ where: { retailerId: id }, select: { id: true } });
    if (!existing) {
      await prisma.warehouse.create({
        data: {
          ownerType: 'RETAILER',
          retailerId: id,
          name: `${retailer.storeName} — Store`,
          code: 'STORE',
          addressLine1: retailer.addressLine1,
          city: retailer.city,
          state: retailer.state,
          pincode: retailer.pincode,
          isDefault: true,
        },
      });
    }
  }

  await notify({
    userId: retailer.userId,
    event: decision === 'APPROVED' ? NOTIFICATION_EVENTS.RETAILER_APPROVED : NOTIFICATION_EVENTS.RETAILER_REJECTED,
    title: `Store application ${decision.toLowerCase()}`,
    body:
      decision === 'APPROVED'
        ? 'Your medical shop has been approved and is now visible to customers.'
        : `Your store application was ${decision.toLowerCase()}.${reason ? ` Reason: ${reason}` : ''}`,
    channels: ['IN_APP', 'EMAIL'],
  });

  return updated;
}

export async function reviewDocument(
  ownerType: 'VENDOR' | 'RETAILER',
  documentId: string,
  status: 'APPROVED' | 'REJECTED',
  remarks: string | undefined,
  adminId: string,
) {
  const data = {
    status,
    remarks: remarks ?? null,
    verifiedAt: new Date(),
    verifiedById: adminId,
  };

  if (ownerType === 'VENDOR') {
    const existing = await prisma.vendorDocument.findUnique({ where: { id: documentId } });
    if (!existing) throw ApiError.notFound('Document not found');
    return prisma.vendorDocument.update({ where: { id: documentId }, data });
  }

  const existing = await prisma.shopDocument.findUnique({ where: { id: documentId } });
  if (!existing) throw ApiError.notFound('Document not found');
  return prisma.shopDocument.update({ where: { id: documentId }, data });
}

/**
 * Full admin-side KYC CRUD (TASKS.md #20) — until now admin could only
 * approve/reject a document the business itself uploaded. Mirrors
 * `reviewDocument` above: acts by `ownerType` + the document's own id,
 * no need to also carry the parent vendor/retailer id.
 */
export async function createDocument(
  ownerType: 'VENDOR' | 'RETAILER',
  ownerId: string,
  file: Express.Multer.File,
  data: { type: string; documentNo?: string; issueDate?: Date; expiryDate?: Date },
) {
  return ownerType === 'VENDOR'
    ? vendorService.addDocument(ownerId, file, data)
    : retailerService.addDocument(ownerId, file, data);
}

export async function updateDocumentMeta(
  ownerType: 'VENDOR' | 'RETAILER',
  documentId: string,
  data: { type?: string; documentNo?: string; issueDate?: Date | null; expiryDate?: Date | null },
) {
  const fields = {
    ...(data.type !== undefined ? { type: data.type as never } : {}),
    ...(data.documentNo !== undefined ? { documentNo: data.documentNo || null } : {}),
    ...(data.issueDate !== undefined ? { issueDate: data.issueDate } : {}),
    ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate } : {}),
  };

  if (ownerType === 'VENDOR') {
    const existing = await prisma.vendorDocument.findUnique({ where: { id: documentId } });
    if (!existing) throw ApiError.notFound('Document not found');
    return prisma.vendorDocument.update({ where: { id: documentId }, data: fields });
  }
  const existing = await prisma.shopDocument.findUnique({ where: { id: documentId } });
  if (!existing) throw ApiError.notFound('Document not found');
  return prisma.shopDocument.update({ where: { id: documentId }, data: fields });
}

/** Admin can remove a document regardless of status — unlike the business's own self-service delete. */
export async function removeDocument(ownerType: 'VENDOR' | 'RETAILER', documentId: string): Promise<void> {
  if (ownerType === 'VENDOR') {
    const existing = await prisma.vendorDocument.findUnique({ where: { id: documentId } });
    if (!existing) throw ApiError.notFound('Document not found');
    await prisma.vendorDocument.delete({ where: { id: documentId } });
    return;
  }
  const existing = await prisma.shopDocument.findUnique({ where: { id: documentId } });
  if (!existing) throw ApiError.notFound('Document not found');
  await prisma.shopDocument.delete({ where: { id: documentId } });
}

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

export async function listUsers(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (query.userType) where.userType = query.userType as never;
  if (query.status) where.status = query.status as UserStatus;
  if (query.search) {
    const search = query.search as string;
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        userType: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function getUser(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      userType: true,
      status: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      roles: { select: { role: { select: { id: true, name: true, slug: true } } } },
      vendor: { select: { id: true, businessName: true, approvalStatus: true } },
      retailer: { select: { id: true, storeName: true, approvalStatus: true } },
      customer: { select: { id: true, code: true } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/** Creates an internal admin-staff user with explicit role assignment. */
export async function createAdminUser(data: {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
  roleIds: string[];
}, createdById: string) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { phone: data.phone }] },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict('A user with this email or mobile number already exists');

  const roles = await prisma.role.findMany({ where: { id: { in: data.roleIds } }, select: { id: true } });
  if (roles.length !== data.roleIds.length) throw ApiError.badRequest('One or more roles were not found');

  const passwordHash = await hashPassword(data.password);

  return prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone,
      passwordHash,
      userType: 'ADMIN_STAFF',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      createdById,
      roles: { createMany: { data: roles.map((role) => ({ roleId: role.id })) } },
    },
    select: { id: true, firstName: true, email: true, phone: true, userType: true, status: true },
  });
}

export async function updateUser(
  id: string,
  data: { firstName?: string; lastName?: string; phone?: string; status?: UserStatus; roleIds?: string[] },
) {
  const user = await getUser(id);

  if (data.roleIds) {
    const roles = await prisma.role.findMany({ where: { id: { in: data.roleIds } }, select: { id: true } });
    if (roles.length !== data.roleIds.length) throw ApiError.badRequest('One or more roles were not found');

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.userRole.createMany({ data: roles.map((role) => ({ userId: id, roleId: role.id })) }),
    ]);
  }

  const { roleIds: _ignored, ...rest } = data;
  void _ignored;
  void user;

  return prisma.user.update({
    where: { id },
    data: rest,
    select: { id: true, firstName: true, lastName: true, phone: true, status: true, userType: true },
  });
}

export async function setUserStatus(id: string, status: UserStatus) {
  const user = await getUser(id);
  if (user.userType === 'SUPER_ADMIN' && status !== 'ACTIVE') {
    const activeAdmins = await prisma.user.count({
      where: { userType: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null },
    });
    if (activeAdmins <= 1) throw ApiError.badRequest('The last active super admin cannot be deactivated');
  }

  const updated = await prisma.user.update({ where: { id }, data: { status } });

  // Locking an account must also terminate its live sessions.
  if (status !== 'ACTIVE') {
    await prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return updated;
}

export async function listRoles() {
  return prisma.role.findMany({
    include: {
      permissions: { select: { permission: { select: { code: true, module: true } } } },
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function listPermissions() {
  const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, permission) => {
    (acc[permission.module] ??= []).push(permission);
    return acc;
  }, {});
  return { permissions, grouped };
}

export async function createRole(data: {
  name: string;
  description?: string;
  scope: 'SUPER_ADMIN' | 'ADMIN_STAFF' | 'VENDOR' | 'RETAILER' | 'CUSTOMER';
  permissionCodes: string[];
}) {
  const slug = slugify(data.name);
  const existing = await prisma.role.findFirst({ where: { OR: [{ slug }, { name: data.name }] } });
  if (existing) throw ApiError.conflict('A role with this name already exists');

  const permissions = await prisma.permission.findMany({
    where: { code: { in: data.permissionCodes } },
    select: { id: true },
  });

  return prisma.role.create({
    data: {
      name: data.name,
      slug,
      description: data.description ?? null,
      scope: data.scope,
      permissions: { createMany: { data: permissions.map((p) => ({ permissionId: p.id })) } },
    },
    include: { permissions: { select: { permission: { select: { code: true } } } } },
  });
}

export async function updateRole(
  id: string,
  data: { name?: string; description?: string; permissionCodes?: string[] },
) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem && data.name) {
    throw ApiError.badRequest('System roles cannot be renamed — create a custom role instead');
  }

  if (data.permissionCodes) {
    const permissions = await prisma.permission.findMany({
      where: { code: { in: data.permissionCodes } },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
      }),
    ]);
  }

  return prisma.role.update({
    where: { id },
    data: {
      name: data.name ?? role.name,
      description: data.description ?? role.description,
    },
    include: { permissions: { select: { permission: { select: { code: true } } } } },
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.badRequest('System roles cannot be deleted');
  if (role._count.users > 0) throw ApiError.badRequest(`This role is assigned to ${role._count.users} user(s)`);

  return prisma.role.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Settings & audit
// ---------------------------------------------------------------------------

export async function listSettings(group?: string) {
  return prisma.setting.findMany({
    where: group ? { group } : {},
    orderBy: [{ group: 'asc' }, { key: 'asc' }],
  });
}

export async function updateSettings(updates: { key: string; value: string }[]) {
  const result = await prisma.$transaction(
    updates.map((update) =>
      prisma.setting.upsert({
        where: { key: update.key },
        update: { value: update.value },
        create: { key: update.key, value: update.value, group: update.key.split('.')[0] ?? 'general' },
      }),
    ),
  );
  if (updates.some((update) => update.key.startsWith('security.'))) invalidateSecuritySettingsCache();
  return result;
}

// ---------------------------------------------------------------------------
// KYC requirements (TASKS.md #20a) — which documents each business type
// needs, previously hardcoded per-page in the frontend.
// ---------------------------------------------------------------------------

export async function listKycRequirements(ownerType?: 'VENDOR' | 'RETAILER') {
  return prisma.kycRequirement.findMany({
    where: ownerType ? { ownerType } : {},
    orderBy: [{ ownerType: 'asc' }, { documentType: 'asc' }],
  });
}

/** "FSSAI License" -> "FSSAI_LICENSE" — same UPPER_SNAKE_CASE shape the original fixed set used, so `humanize()` on the frontend renders both identically with no lookup table needed. */
function toDocumentTypeKey(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** Admin defines a brand-new document type at runtime — not limited to the originally fixed set. */
export async function createKycRequirement(
  ownerType: 'VENDOR' | 'RETAILER',
  label: string,
  isRequired: boolean,
) {
  const documentType = toDocumentTypeKey(label);
  if (!documentType) throw ApiError.badRequest('Enter a document type name');

  const existing = await prisma.kycRequirement.findUnique({
    where: { ownerType_documentType: { ownerType, documentType } },
  });
  if (existing) throw ApiError.conflict('This document type already exists for this business type');

  return prisma.kycRequirement.create({
    data: { ownerType, documentType, isRequired, isActive: true },
  });
}

export async function updateKycRequirement(
  id: string,
  data: { isRequired?: boolean; isActive?: boolean },
) {
  const existing = await prisma.kycRequirement.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('KYC requirement not found');
  return prisma.kycRequirement.update({ where: { id }, data });
}

/** Public: what the vendor/retailer profile upload forms should offer, in place of a hardcoded list. */
export async function getActiveKycRequirements(ownerType: 'VENDOR' | 'RETAILER') {
  return prisma.kycRequirement.findMany({
    where: { ownerType, isActive: true },
    select: { documentType: true, isRequired: true },
    orderBy: { documentType: 'asc' },
  });
}

function auditLogWhere(query: Record<string, unknown>): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (query.module) where.module = query.module as string;
  if (query.action) where.action = { contains: query.action as string };
  if (query.userId) where.userId = query.userId as string;
  if (query.recordId) where.recordId = query.recordId as string;
  // `search` is part of the shared `paginationQuery` the frontend's
  // `useListQuery` always sends — was accepted by the schema but never
  // actually applied here, so the audit-log search box was a silent no-op.
  // Real pre-existing bug, fixed as part of #19.
  if (query.search) {
    const search = query.search as string;
    where.OR = [{ action: { contains: search } }, { recordId: { contains: search } }];
  }
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: startOfDay(query.dateFrom as Date) } : {}),
      ...(query.dateTo ? { lte: endOfDay(query.dateTo as Date) } : {}),
    };
  }
  return where;
}

export async function listAuditLogs(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);
  const where = auditLogWhere(query);

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export const AUDIT_LOG_EXPORT_COLUMNS = [
  { key: 'createdAt', header: 'Timestamp', width: 20 },
  { key: 'userName', header: 'User', width: 24 },
  { key: 'userType', header: 'User type', width: 16 },
  { key: 'action', header: 'Action', width: 26 },
  { key: 'module', header: 'Module', width: 16 },
  { key: 'recordId', header: 'Record ID', width: 24 },
  { key: 'ipAddress', header: 'IP address', width: 16 },
];

/** Capped well above any real filtered window so an export never silently truncates a normal day/week/month pull. */
const AUDIT_LOG_EXPORT_LIMIT = 10_000;

export async function listAuditLogsForExport(query: Record<string, unknown>) {
  const where = auditLogWhere(query);
  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: AUDIT_LOG_EXPORT_LIMIT,
  });

  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    userName: row.user ? `${row.user.firstName} ${row.user.lastName ?? ''}`.trim() : 'System',
    userType: row.userType ?? '',
    action: row.action,
    module: row.module,
    recordId: row.recordId ?? '',
    ipAddress: row.ipAddress ?? '',
  }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function dashboard(days = 30) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const rangeStart = startOfDay(dayjs().subtract(days - 1, 'day').toDate());
  const in30Days = dayjs().add(30, 'day').toDate();

  const [
    totalShops,
    totalVendors,
    totalCustomers,
    totalProducts,
    totalOrders,
    todaysOrders,
    todaysSalesAgg,
    pendingVendorApprovals,
    pendingShopApprovals,
    lowStockCount,
    expiringCount,
    expiredCount,
  ] = await Promise.all([
    prisma.retailer.count({ where: { deletedAt: null, approvalStatus: 'APPROVED' } }),
    prisma.vendor.count({ where: { deletedAt: null, approvalStatus: 'APPROVED' } }),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { in: ['COMPLETED', 'PICKED_UP', 'DELIVERED'] } },
      _sum: { totalAmount: true },
    }),
    prisma.vendor.count({ where: { approvalStatus: 'PENDING', deletedAt: null } }),
    prisma.retailer.count({ where: { approvalStatus: 'PENDING', deletedAt: null } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM inventory
      WHERE availableQty <= minStockAlert`,
    prisma.inventoryBatch.count({
      where: { status: 'ACTIVE', quantity: { gt: 0 }, expiryDate: { gt: new Date(), lte: in30Days } },
    }),
    prisma.inventoryBatch.count({
      where: { quantity: { gt: 0 }, expiryDate: { lte: new Date() } },
    }),
  ]);

  const [ordersTrend, salesTrend, newStores, newVendors, topStores, topProducts] = await Promise.all([
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE(createdAt) AS day, COUNT(*) AS count
      FROM orders WHERE createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.$queryRaw<{ day: string; total: string }[]>`
      SELECT DATE(createdAt) AS day, COALESCE(SUM(totalAmount), 0) AS total
      FROM orders WHERE createdAt >= ${rangeStart} AND status IN ('COMPLETED','PICKED_UP','DELIVERED')
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE(createdAt) AS day, COUNT(*) AS count
      FROM medical_shops WHERE createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE(createdAt) AS day, COUNT(*) AS count
      FROM medical_vendors WHERE createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
    prisma.$queryRaw<{ id: string; storeName: string; orders: bigint; revenue: string }[]>`
      SELECT s.id, s.storeName, COUNT(o.id) AS orders, COALESCE(SUM(o.totalAmount), 0) AS revenue
      FROM medical_shops s
      JOIN orders o ON o.retailerId = s.id AND o.createdAt >= ${rangeStart}
      GROUP BY s.id, s.storeName ORDER BY revenue DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; name: string; qty: bigint; revenue: string }[]>`
      SELECT p.id, p.name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.totalAmount), 0) AS revenue
      FROM products p
      JOIN order_items oi ON oi.productId = p.id
      JOIN orders o ON o.id = oi.orderId AND o.createdAt >= ${rangeStart}
      GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 10`,
  ]);

  const serialiseTrend = (rows: { day: string; count?: bigint; total?: string }[]) =>
    rows.map((row) => ({
      day: dayjs(row.day).format('YYYY-MM-DD'),
      value: row.count !== undefined ? Number(row.count) : Number(row.total ?? 0),
    }));

  return {
    cards: {
      totalShops,
      totalVendors,
      totalCustomers,
      totalProducts,
      totalOrders,
      todaysOrders,
      todaysSales: toNumber(todaysSalesAgg._sum.totalAmount ?? 0),
      pendingApprovals: pendingVendorApprovals + pendingShopApprovals,
      pendingVendorApprovals,
      pendingShopApprovals,
      lowStockProducts: Number(lowStockCount[0]?.count ?? 0),
      expiringProducts: expiringCount,
      expiredProducts: expiredCount,
    },
    charts: {
      ordersTrend: serialiseTrend(ordersTrend),
      salesTrend: serialiseTrend(salesTrend),
      newStores: serialiseTrend(newStores),
      newVendors: serialiseTrend(newVendors),
      topStores: topStores.map((row) => ({
        id: row.id,
        name: row.storeName,
        orders: Number(row.orders),
        revenue: Number(row.revenue),
      })),
      topProducts: topProducts.map((row) => ({
        id: row.id,
        name: row.name,
        quantity: Number(row.qty),
        revenue: Number(row.revenue),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Global search (TASKS.md #17)
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface GlobalSearchResults {
  products: SearchResult[];
  vendors: SearchResult[];
  retailers: SearchResult[];
  users: SearchResult[];
  orders: SearchResult[];
}

const SEARCH_LIMIT = 5;

/**
 * Fans out the same `q` across the five entity types an admin actually looks
 * up by name/code/number, reusing each module's existing `contains` search
 * fields rather than inventing a separate full-text index. Each group is
 * capped at 5 so the dropdown stays scannable; the admin top-bar search box
 * links each row straight to that entity's existing detail/list screen.
 */
export async function globalSearch(q: string): Promise<GlobalSearchResults> {
  const [products, vendors, retailers, users, orders] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { genericName: { contains: q } },
          { brandName: { contains: q } },
        ],
      },
      select: { id: true, name: true, sku: true },
      take: SEARCH_LIMIT,
    }),
    prisma.vendor.findMany({
      where: {
        deletedAt: null,
        OR: [
          { businessName: { contains: q } },
          { code: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, businessName: true, code: true },
      take: SEARCH_LIMIT,
    }),
    prisma.retailer.findMany({
      where: {
        deletedAt: null,
        OR: [
          { storeName: { contains: q } },
          { code: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, storeName: true, code: true },
      take: SEARCH_LIMIT,
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, userType: true },
      take: SEARCH_LIMIT,
    }),
    prisma.order.findMany({
      where: { orderNumber: { contains: q } },
      select: { id: true, orderNumber: true, status: true, retailer: { select: { storeName: true } } },
      take: SEARCH_LIMIT,
    }),
  ]);

  // Vendors/retailers have a real admin detail route to deep-link into.
  // Products/users/orders only have a list screen today (no `/admin/x/:id`
  // page, and the list's search box is local component state, not
  // URL-driven) — link to the list itself rather than a `?search=` param
  // that page would silently ignore.
  return {
    products: products.map((p) => ({ id: p.id, title: p.name, subtitle: p.sku, href: '/admin/products' })),
    vendors: vendors.map((v) => ({ id: v.id, title: v.businessName, subtitle: v.code, href: `/admin/vendors/${v.id}` })),
    retailers: retailers.map((r) => ({ id: r.id, title: r.storeName, subtitle: r.code, href: `/admin/retailers/${r.id}` })),
    users: users.map((u) => ({
      id: u.id,
      title: `${u.firstName} ${u.lastName ?? ''}`.trim(),
      subtitle: `${u.userType} · ${u.email ?? ''}`,
      href: '/admin/users',
    })),
    orders: orders.map((o) => ({
      id: o.id,
      title: o.orderNumber,
      subtitle: `${o.status} · ${o.retailer.storeName}`,
      href: '/admin/orders',
    })),
  };
}
