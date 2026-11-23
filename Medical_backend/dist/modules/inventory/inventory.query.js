"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStock = listStock;
exports.listStockSummary = listStockSummary;
exports.expirySummary = expirySummary;
exports.listExpiring = listExpiring;
exports.listExpired = listExpired;
exports.listTransactions = listTransactions;
exports.stockValuation = stockValuation;
exports.lowStockItems = lowStockItems;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../database/prisma");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const money_1 = require("../../utils/money");
const time_1 = require("../../utils/time");
const constants_1 = require("../../config/constants");
const ownerFilter = (owner) => owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId };
// ---------------------------------------------------------------------------
// Stock listing
// ---------------------------------------------------------------------------
async function listStock(owner, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        ...ownerFilter(owner),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.includeDepleted ? {} : { quantity: { gt: 0 } }),
    };
    if (query.search || query.categoryId) {
        where.product = {
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search } },
                        { genericName: { contains: query.search } },
                        { brandName: { contains: query.search } },
                        { sku: { contains: query.search } },
                    ],
                }
                : {}),
        };
    }
    if (query.batchNumber)
        where.batchNumber = { contains: query.batchNumber };
    if (query.expiringInDays !== undefined) {
        where.expiryDate = {
            gt: new Date(),
            lte: (0, time_1.dayjs)().add(Number(query.expiringInDays), 'day').toDate(),
        };
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.inventoryBatch.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        genericName: true,
                        brandName: true,
                        packSize: true,
                        category: { select: { id: true, name: true } },
                        unit: { select: { code: true } },
                    },
                },
                warehouse: { select: { id: true, name: true } },
            },
            orderBy: { expiryDate: 'asc' },
            skip,
            take,
        }),
        prisma_1.prisma.inventoryBatch.count({ where }),
    ]);
    return {
        items: items.map((batch) => ({
            ...batch,
            availableQty: batch.quantity + batch.freeQuantity - batch.reservedQty,
            daysToExpiry: (0, time_1.dayjs)(batch.expiryDate).startOf('day').diff((0, time_1.dayjs)().startOf('day'), 'day'),
            stockValue: (0, money_1.toNumber)(batch.purchasePrice) * (batch.quantity + batch.freeQuantity),
        })),
        meta: (0, response_1.buildMeta)(page, limit, total),
    };
}
/** Product-level stock position (aggregated across batches). */
async function listStockSummary(owner, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const warehouses = await prisma_1.prisma.warehouse.findMany({
        where: ownerFilter(owner),
        select: { id: true },
    });
    const warehouseIds = warehouses.map((w) => w.id);
    if (warehouseIds.length === 0)
        return { items: [], meta: (0, response_1.buildMeta)(page, limit, 0) };
    const where = { warehouseId: { in: warehouseIds } };
    // Column-to-column comparison so the low-stock filter is applied in SQL and
    // the pagination total stays correct.
    if (query.lowStockOnly) {
        where.availableQty = { lte: prisma_1.prisma.inventory.fields.minStockAlert };
    }
    if (query.search || query.categoryId) {
        where.product = {
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search } },
                        { genericName: { contains: query.search } },
                        { sku: { contains: query.search } },
                    ],
                }
                : {}),
        };
    }
    const [rows, total] = await Promise.all([
        prisma_1.prisma.inventory.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        brandName: true,
                        packSize: true,
                        mrp: true,
                        category: { select: { id: true, name: true } },
                    },
                },
                warehouse: { select: { id: true, name: true } },
            },
            orderBy: { availableQty: 'asc' },
            skip,
            take,
        }),
        prisma_1.prisma.inventory.count({ where }),
    ]);
    const items = rows.map((row) => ({
        ...row,
        isLowStock: row.availableQty <= row.minStockAlert,
        isOutOfStock: row.availableQty === 0,
    }));
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------
async function expirySummary(owner) {
    const now = new Date();
    const [expired, ...buckets] = await Promise.all([
        prisma_1.prisma.inventoryBatch.aggregate({
            where: { ...ownerFilter(owner), quantity: { gt: 0 }, expiryDate: { lte: now } },
            _count: true,
            _sum: { quantity: true },
        }),
        ...constants_1.EXPIRY_BUCKETS.map((days) => prisma_1.prisma.inventoryBatch.aggregate({
            where: {
                ...ownerFilter(owner),
                quantity: { gt: 0 },
                status: 'ACTIVE',
                expiryDate: { gt: now, lte: (0, time_1.dayjs)().add(days, 'day').toDate() },
            },
            _count: true,
            _sum: { quantity: true },
        })),
    ]);
    const valueAtRisk = await prisma_1.prisma.$queryRaw `
    SELECT COALESCE(SUM(purchasePrice * (quantity + freeQuantity)), 0) AS value
    FROM inventory_batches
    WHERE quantity > 0
      AND expiryDate <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      AND ${owner.ownerType === 'VENDOR' ? client_1.Prisma.sql `vendorId = ${owner.vendorId}` : client_1.Prisma.sql `retailerId = ${owner.retailerId}`}`;
    return {
        expired: { batches: expired._count, quantity: expired._sum.quantity ?? 0 },
        buckets: constants_1.EXPIRY_BUCKETS.map((days, index) => ({
            days,
            batches: buckets[index]._count,
            quantity: buckets[index]._sum.quantity ?? 0,
        })),
        stockValueAtRisk: Number(valueAtRisk[0]?.value ?? 0),
    };
}
async function listExpiring(owner, days, query) {
    return listStock(owner, { ...query, expiringInDays: days, status: 'ACTIVE' });
}
async function listExpired(owner, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        ...ownerFilter(owner),
        quantity: { gt: 0 },
        expiryDate: { lte: new Date() },
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.inventoryBatch.findMany({
            where,
            include: { product: { select: { id: true, name: true, sku: true, packSize: true } } },
            orderBy: { expiryDate: 'asc' },
            skip,
            take,
        }),
        prisma_1.prisma.inventoryBatch.count({ where }),
    ]);
    return {
        items: items.map((batch) => ({
            ...batch,
            lossValue: (0, money_1.toNumber)(batch.purchasePrice) * (batch.quantity + batch.freeQuantity),
        })),
        meta: (0, response_1.buildMeta)(page, limit, total),
    };
}
// ---------------------------------------------------------------------------
// Transactions & valuation
// ---------------------------------------------------------------------------
async function listTransactions(owner, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        ...ownerFilter(owner),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.referenceId ? { referenceId: query.referenceId } : {}),
    };
    if (query.dateFrom || query.dateTo) {
        where.createdAt = {
            ...(query.dateFrom ? { gte: (0, time_1.startOfDay)(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: (0, time_1.endOfDay)(query.dateTo) } : {}),
        };
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.inventoryTransaction.findMany({
            where,
            include: {
                product: { select: { id: true, name: true, sku: true } },
                batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.inventoryTransaction.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function stockValuation(owner) {
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT COUNT(*) AS totalBatches,
           COALESCE(SUM(quantity + freeQuantity), 0) AS totalUnits,
           COALESCE(SUM(purchasePrice * (quantity + freeQuantity)), 0) AS costValue,
           COALESCE(SUM(mrp * (quantity + freeQuantity)), 0) AS mrpValue
    FROM inventory_batches
    WHERE quantity > 0 AND status = 'ACTIVE'
      AND ${owner.ownerType === 'VENDOR' ? client_1.Prisma.sql `vendorId = ${owner.vendorId}` : client_1.Prisma.sql `retailerId = ${owner.retailerId}`}`;
    const row = rows[0];
    return {
        totalBatches: Number(row?.totalBatches ?? 0),
        totalUnits: Number(row?.totalUnits ?? 0),
        costValue: Number(row?.costValue ?? 0),
        mrpValue: Number(row?.mrpValue ?? 0),
        potentialMargin: Number(row?.mrpValue ?? 0) - Number(row?.costValue ?? 0),
    };
}
async function lowStockItems(owner, limit = 20) {
    return prisma_1.prisma.$queryRaw `
    SELECT i.productId, p.name, p.sku, i.availableQty, i.minStockAlert
    FROM inventory i
    JOIN products p ON p.id = i.productId
    JOIN warehouses w ON w.id = i.warehouseId
    WHERE i.availableQty <= i.minStockAlert
      AND ${owner.ownerType === 'VENDOR' ? client_1.Prisma.sql `w.vendorId = ${owner.vendorId}` : client_1.Prisma.sql `w.retailerId = ${owner.retailerId}`}
    ORDER BY i.availableQty ASC
    LIMIT ${limit}`;
}
//# sourceMappingURL=inventory.query.js.map