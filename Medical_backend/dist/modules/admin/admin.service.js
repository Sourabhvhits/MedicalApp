"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVendors = listVendors;
exports.getVendor = getVendor;
exports.decideVendor = decideVendor;
exports.listRetailers = listRetailers;
exports.getRetailer = getRetailer;
exports.decideRetailer = decideRetailer;
exports.reviewDocument = reviewDocument;
exports.listUsers = listUsers;
exports.getUser = getUser;
exports.createAdminUser = createAdminUser;
exports.updateUser = updateUser;
exports.setUserStatus = setUserStatus;
exports.listRoles = listRoles;
exports.listPermissions = listPermissions;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
exports.listSettings = listSettings;
exports.updateSettings = updateSettings;
exports.listAuditLogs = listAuditLogs;
exports.dashboard = dashboard;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const password_1 = require("../../utils/password");
const slug_1 = require("../../utils/slug");
const time_1 = require("../../utils/time");
const money_1 = require("../../utils/money");
const notification_service_1 = require("../notifications/notification.service");
const constants_1 = require("../../config/constants");
// ---------------------------------------------------------------------------
// Vendor & retailer approvals
// ---------------------------------------------------------------------------
async function listVendors(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = { deletedAt: null };
    if (query.approvalStatus)
        where.approvalStatus = query.approvalStatus;
    if (query.city)
        where.city = query.city;
    if (query.state)
        where.state = query.state;
    if (query.isActive !== undefined)
        where.isActive = query.isActive;
    if (query.search) {
        const search = query.search;
        where.OR = [
            { businessName: { contains: search } },
            { code: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
            { gstNumber: { contains: search } },
        ];
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.vendor.findMany({
            where,
            include: {
                user: { select: { id: true, email: true, phone: true, status: true, lastLoginAt: true } },
                _count: { select: { products: true, documents: true, purchaseOrders: true } },
            },
            orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.vendor.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function getVendor(id) {
    const vendor = await prisma_1.prisma.vendor.findFirst({
        where: { id, deletedAt: null },
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
            documents: true,
            warehouses: true,
            _count: { select: { products: true, purchaseOrders: true } },
        },
    });
    if (!vendor)
        throw ApiError_1.ApiError.notFound('Vendor not found');
    return vendor;
}
async function decideVendor(id, decision, reason, adminId) {
    const vendor = await getVendor(id);
    const updated = await prisma_1.prisma.vendor.update({
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
        const existing = await prisma_1.prisma.warehouse.findFirst({ where: { vendorId: id }, select: { id: true } });
        if (!existing) {
            await prisma_1.prisma.warehouse.create({
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
    await (0, notification_service_1.notify)({
        userId: vendor.userId,
        event: decision === 'APPROVED' ? constants_1.NOTIFICATION_EVENTS.VENDOR_APPROVED : constants_1.NOTIFICATION_EVENTS.VENDOR_REJECTED,
        title: `Vendor application ${decision.toLowerCase()}`,
        body: decision === 'APPROVED'
            ? 'Your vendor account has been approved. You can now list products and receive orders.'
            : `Your vendor application was ${decision.toLowerCase()}.${reason ? ` Reason: ${reason}` : ''}`,
        channels: ['IN_APP', 'EMAIL'],
    });
    return updated;
}
async function listRetailers(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = { deletedAt: null };
    if (query.approvalStatus)
        where.approvalStatus = query.approvalStatus;
    if (query.city)
        where.city = query.city;
    if (query.state)
        where.state = query.state;
    if (query.isActive !== undefined)
        where.isActive = query.isActive;
    if (query.search) {
        const search = query.search;
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
        prisma_1.prisma.retailer.findMany({
            where,
            include: {
                user: { select: { id: true, email: true, phone: true, status: true, lastLoginAt: true } },
                _count: { select: { products: true, documents: true, orders: true } },
            },
            orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.retailer.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function getRetailer(id) {
    const retailer = await prisma_1.prisma.retailer.findFirst({
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
    if (!retailer)
        throw ApiError_1.ApiError.notFound('Medical shop not found');
    return retailer;
}
async function decideRetailer(id, decision, reason, adminId) {
    const retailer = await getRetailer(id);
    const updated = await prisma_1.prisma.retailer.update({
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
        const existing = await prisma_1.prisma.warehouse.findFirst({ where: { retailerId: id }, select: { id: true } });
        if (!existing) {
            await prisma_1.prisma.warehouse.create({
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
    await (0, notification_service_1.notify)({
        userId: retailer.userId,
        event: decision === 'APPROVED' ? constants_1.NOTIFICATION_EVENTS.RETAILER_APPROVED : constants_1.NOTIFICATION_EVENTS.RETAILER_REJECTED,
        title: `Store application ${decision.toLowerCase()}`,
        body: decision === 'APPROVED'
            ? 'Your medical shop has been approved and is now visible to customers.'
            : `Your store application was ${decision.toLowerCase()}.${reason ? ` Reason: ${reason}` : ''}`,
        channels: ['IN_APP', 'EMAIL'],
    });
    return updated;
}
async function reviewDocument(ownerType, documentId, status, remarks, adminId) {
    const data = {
        status,
        remarks: remarks ?? null,
        verifiedAt: new Date(),
        verifiedById: adminId,
    };
    if (ownerType === 'VENDOR') {
        const existing = await prisma_1.prisma.vendorDocument.findUnique({ where: { id: documentId } });
        if (!existing)
            throw ApiError_1.ApiError.notFound('Document not found');
        return prisma_1.prisma.vendorDocument.update({ where: { id: documentId }, data });
    }
    const existing = await prisma_1.prisma.shopDocument.findUnique({ where: { id: documentId } });
    if (!existing)
        throw ApiError_1.ApiError.notFound('Document not found');
    return prisma_1.prisma.shopDocument.update({ where: { id: documentId }, data });
}
// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------
async function listUsers(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = { deletedAt: null };
    if (query.userType)
        where.userType = query.userType;
    if (query.status)
        where.status = query.status;
    if (query.search) {
        const search = query.search;
        where.OR = [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
        ];
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.user.findMany({
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
        prisma_1.prisma.user.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function getUser(id) {
    const user = await prisma_1.prisma.user.findFirst({
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
    if (!user)
        throw ApiError_1.ApiError.notFound('User not found');
    return user;
}
/** Creates an internal admin-staff user with explicit role assignment. */
async function createAdminUser(data, createdById) {
    const existing = await prisma_1.prisma.user.findFirst({
        where: { OR: [{ email: data.email }, { phone: data.phone }] },
        select: { id: true },
    });
    if (existing)
        throw ApiError_1.ApiError.conflict('A user with this email or mobile number already exists');
    const roles = await prisma_1.prisma.role.findMany({ where: { id: { in: data.roleIds } }, select: { id: true } });
    if (roles.length !== data.roleIds.length)
        throw ApiError_1.ApiError.badRequest('One or more roles were not found');
    const passwordHash = await (0, password_1.hashPassword)(data.password);
    return prisma_1.prisma.user.create({
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
async function updateUser(id, data) {
    const user = await getUser(id);
    if (data.roleIds) {
        const roles = await prisma_1.prisma.role.findMany({ where: { id: { in: data.roleIds } }, select: { id: true } });
        if (roles.length !== data.roleIds.length)
            throw ApiError_1.ApiError.badRequest('One or more roles were not found');
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.userRole.deleteMany({ where: { userId: id } }),
            prisma_1.prisma.userRole.createMany({ data: roles.map((role) => ({ userId: id, roleId: role.id })) }),
        ]);
    }
    const { roleIds: _ignored, ...rest } = data;
    void _ignored;
    void user;
    return prisma_1.prisma.user.update({
        where: { id },
        data: rest,
        select: { id: true, firstName: true, lastName: true, phone: true, status: true, userType: true },
    });
}
async function setUserStatus(id, status) {
    const user = await getUser(id);
    if (user.userType === 'SUPER_ADMIN' && status !== 'ACTIVE') {
        const activeAdmins = await prisma_1.prisma.user.count({
            where: { userType: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null },
        });
        if (activeAdmins <= 1)
            throw ApiError_1.ApiError.badRequest('The last active super admin cannot be deactivated');
    }
    const updated = await prisma_1.prisma.user.update({ where: { id }, data: { status } });
    // Locking an account must also terminate its live sessions.
    if (status !== 'ACTIVE') {
        await prisma_1.prisma.userSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    return updated;
}
async function listRoles() {
    return prisma_1.prisma.role.findMany({
        include: {
            permissions: { select: { permission: { select: { code: true, module: true } } } },
            _count: { select: { users: true } },
        },
        orderBy: { name: 'asc' },
    });
}
async function listPermissions() {
    const permissions = await prisma_1.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
    const grouped = permissions.reduce((acc, permission) => {
        (acc[permission.module] ??= []).push(permission);
        return acc;
    }, {});
    return { permissions, grouped };
}
async function createRole(data) {
    const slug = (0, slug_1.slugify)(data.name);
    const existing = await prisma_1.prisma.role.findFirst({ where: { OR: [{ slug }, { name: data.name }] } });
    if (existing)
        throw ApiError_1.ApiError.conflict('A role with this name already exists');
    const permissions = await prisma_1.prisma.permission.findMany({
        where: { code: { in: data.permissionCodes } },
        select: { id: true },
    });
    return prisma_1.prisma.role.create({
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
async function updateRole(id, data) {
    const role = await prisma_1.prisma.role.findUnique({ where: { id } });
    if (!role)
        throw ApiError_1.ApiError.notFound('Role not found');
    if (role.isSystem && data.name) {
        throw ApiError_1.ApiError.badRequest('System roles cannot be renamed — create a custom role instead');
    }
    if (data.permissionCodes) {
        const permissions = await prisma_1.prisma.permission.findMany({
            where: { code: { in: data.permissionCodes } },
            select: { id: true },
        });
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
            prisma_1.prisma.rolePermission.createMany({
                data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
            }),
        ]);
    }
    return prisma_1.prisma.role.update({
        where: { id },
        data: {
            name: data.name ?? role.name,
            description: data.description ?? role.description,
        },
        include: { permissions: { select: { permission: { select: { code: true } } } } },
    });
}
async function deleteRole(id) {
    const role = await prisma_1.prisma.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true } } },
    });
    if (!role)
        throw ApiError_1.ApiError.notFound('Role not found');
    if (role.isSystem)
        throw ApiError_1.ApiError.badRequest('System roles cannot be deleted');
    if (role._count.users > 0)
        throw ApiError_1.ApiError.badRequest(`This role is assigned to ${role._count.users} user(s)`);
    return prisma_1.prisma.role.delete({ where: { id } });
}
// ---------------------------------------------------------------------------
// Settings & audit
// ---------------------------------------------------------------------------
async function listSettings(group) {
    return prisma_1.prisma.setting.findMany({
        where: group ? { group } : {},
        orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
}
async function updateSettings(updates) {
    return prisma_1.prisma.$transaction(updates.map((update) => prisma_1.prisma.setting.upsert({
        where: { key: update.key },
        update: { value: update.value },
        create: { key: update.key, value: update.value, group: update.key.split('.')[0] ?? 'general' },
    })));
}
async function listAuditLogs(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {};
    if (query.module)
        where.module = query.module;
    if (query.action)
        where.action = { contains: query.action };
    if (query.userId)
        where.userId = query.userId;
    if (query.recordId)
        where.recordId = query.recordId;
    if (query.dateFrom || query.dateTo) {
        where.createdAt = {
            ...(query.dateFrom ? { gte: (0, time_1.startOfDay)(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: (0, time_1.endOfDay)(query.dateTo) } : {}),
        };
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.auditLog.findMany({
            where,
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function dashboard(days = 30) {
    const todayStart = (0, time_1.startOfDay)();
    const todayEnd = (0, time_1.endOfDay)();
    const rangeStart = (0, time_1.startOfDay)((0, time_1.dayjs)().subtract(days - 1, 'day').toDate());
    const in30Days = (0, time_1.dayjs)().add(30, 'day').toDate();
    const [totalShops, totalVendors, totalCustomers, totalProducts, totalOrders, todaysOrders, todaysSalesAgg, pendingVendorApprovals, pendingShopApprovals, lowStockCount, expiringCount, expiredCount,] = await Promise.all([
        prisma_1.prisma.retailer.count({ where: { deletedAt: null, approvalStatus: 'APPROVED' } }),
        prisma_1.prisma.vendor.count({ where: { deletedAt: null, approvalStatus: 'APPROVED' } }),
        prisma_1.prisma.customer.count({ where: { deletedAt: null } }),
        prisma_1.prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        prisma_1.prisma.order.count(),
        prisma_1.prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
        prisma_1.prisma.order.aggregate({
            where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { in: ['COMPLETED', 'PICKED_UP'] } },
            _sum: { totalAmount: true },
        }),
        prisma_1.prisma.vendor.count({ where: { approvalStatus: 'PENDING', deletedAt: null } }),
        prisma_1.prisma.retailer.count({ where: { approvalStatus: 'PENDING', deletedAt: null } }),
        prisma_1.prisma.$queryRaw `
      SELECT COUNT(*) AS count FROM inventory
      WHERE availableQty <= minStockAlert`,
        prisma_1.prisma.inventoryBatch.count({
            where: { status: 'ACTIVE', quantity: { gt: 0 }, expiryDate: { gt: new Date(), lte: in30Days } },
        }),
        prisma_1.prisma.inventoryBatch.count({
            where: { quantity: { gt: 0 }, expiryDate: { lte: new Date() } },
        }),
    ]);
    const [ordersTrend, salesTrend, newStores, newVendors, topStores, topProducts] = await Promise.all([
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COUNT(*) AS count
      FROM orders WHERE createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COALESCE(SUM(totalAmount), 0) AS total
      FROM orders WHERE createdAt >= ${rangeStart} AND status IN ('COMPLETED','PICKED_UP')
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COUNT(*) AS count
      FROM medical_shops WHERE createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COUNT(*) AS count
      FROM medical_vendors WHERE createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT s.id, s.storeName, COUNT(o.id) AS orders, COALESCE(SUM(o.totalAmount), 0) AS revenue
      FROM medical_shops s
      JOIN orders o ON o.retailerId = s.id AND o.createdAt >= ${rangeStart}
      GROUP BY s.id, s.storeName ORDER BY revenue DESC LIMIT 10`,
        prisma_1.prisma.$queryRaw `
      SELECT p.id, p.name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.totalAmount), 0) AS revenue
      FROM products p
      JOIN order_items oi ON oi.productId = p.id
      JOIN orders o ON o.id = oi.orderId AND o.createdAt >= ${rangeStart}
      GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 10`,
    ]);
    const serialiseTrend = (rows) => rows.map((row) => ({
        day: (0, time_1.dayjs)(row.day).format('YYYY-MM-DD'),
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
            todaysSales: (0, money_1.toNumber)(todaysSalesAgg._sum.totalAmount ?? 0),
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
//# sourceMappingURL=admin.service.js.map