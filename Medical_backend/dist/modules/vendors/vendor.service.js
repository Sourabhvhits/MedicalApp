"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.addDocument = addDocument;
exports.deleteDocument = deleteDocument;
exports.assertApproved = assertApproved;
exports.listCatalog = listCatalog;
exports.stockByProduct = stockByProduct;
exports.addCatalogProduct = addCatalogProduct;
exports.updateCatalogProduct = updateCatalogProduct;
exports.removeCatalogProduct = removeCatalogProduct;
exports.bulkUpdatePrices = bulkUpdatePrices;
exports.dashboard = dashboard;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const money_1 = require("../../utils/money");
const time_1 = require("../../utils/time");
const price_history_1 = require("../../common/price-history");
const upload_1 = require("../../middleware/upload");
async function getProfile(vendorId) {
    const vendor = await prisma_1.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            documents: { orderBy: { createdAt: 'desc' } },
            warehouses: { orderBy: { isDefault: 'desc' } },
        },
    });
    if (!vendor)
        throw ApiError_1.ApiError.notFound('Vendor profile not found');
    return vendor;
}
async function updateProfile(vendorId, data) {
    const vendor = await getProfile(vendorId);
    // Re-verification is required when statutory identifiers change.
    const identityChanged = (data.gstNumber && data.gstNumber !== vendor.gstNumber) ||
        (data.drugLicenseNumber && data.drugLicenseNumber !== vendor.drugLicenseNumber);
    return prisma_1.prisma.vendor.update({
        where: { id: vendorId },
        data: {
            ...data,
            ...(identityChanged && vendor.approvalStatus === 'APPROVED'
                ? { approvalStatus: 'UNDER_REVIEW' }
                : {}),
        },
    });
}
async function addDocument(vendorId, file, data) {
    return prisma_1.prisma.vendorDocument.create({
        data: {
            vendorId,
            type: data.type,
            documentNo: data.documentNo ?? null,
            fileUrl: (0, upload_1.publicUrl)('vendor-documents', file.filename),
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            issueDate: data.issueDate ?? null,
            expiryDate: data.expiryDate ?? null,
            status: 'PENDING',
        },
    });
}
async function deleteDocument(vendorId, documentId) {
    const document = await prisma_1.prisma.vendorDocument.findFirst({ where: { id: documentId, vendorId } });
    if (!document)
        throw ApiError_1.ApiError.notFound('Document not found');
    if (document.status === 'APPROVED') {
        throw ApiError_1.ApiError.badRequest('Approved documents cannot be removed — contact support');
    }
    return prisma_1.prisma.vendorDocument.delete({ where: { id: documentId } });
}
/** Blocks catalog and order actions until the admin has approved the vendor. */
async function assertApproved(vendorId) {
    const vendor = await prisma_1.prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { approvalStatus: true, isActive: true },
    });
    if (!vendor)
        throw ApiError_1.ApiError.notFound('Vendor profile not found');
    if (vendor.approvalStatus !== 'APPROVED' || !vendor.isActive) {
        throw ApiError_1.ApiError.forbidden('Your vendor account is not approved yet. You can complete your profile but cannot sell until approval.');
    }
}
// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
async function listCatalog(vendorId, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = { vendorId, deletedAt: null };
    if (query.status)
        where.status = query.status;
    if (query.categoryId || query.manufacturerId || query.search) {
        where.product = {
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
            ...(query.manufacturerId ? { manufacturerId: query.manufacturerId } : {}),
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
    const [rows, total] = await Promise.all([
        prisma_1.prisma.vendorProduct.findMany({
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
                        imageUrl: true,
                        prescriptionRequired: true,
                        status: true,
                        category: { select: { id: true, name: true } },
                        manufacturer: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.vendorProduct.count({ where }),
    ]);
    const stock = await stockByProduct({ ownerType: 'VENDOR', vendorId }, rows.map((row) => row.productId));
    const items = rows
        .map((row) => ({ ...row, availableQty: stock.get(row.productId) ?? 0 }))
        .filter((row) => (query.inStockOnly ? row.availableQty > 0 : true));
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
/** Available quantity per product for one owner, keyed by product id. */
async function stockByProduct(owner, productIds) {
    if (productIds.length === 0)
        return new Map();
    const rows = await prisma_1.prisma.inventory.findMany({
        where: {
            productId: { in: productIds },
            warehouse: owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId },
        },
        select: { productId: true, availableQty: true },
    });
    return rows.reduce((map, row) => {
        map.set(row.productId, (map.get(row.productId) ?? 0) + row.availableQty);
        return map;
    }, new Map());
}
async function addCatalogProduct(vendorId, data, userId) {
    await assertApproved(vendorId);
    const product = await prisma_1.prisma.product.findFirst({
        where: { id: data.productId, deletedAt: null },
        select: { id: true, status: true, isRecalled: true, mrp: true, gstRate: true },
    });
    if (!product)
        throw ApiError_1.ApiError.badRequest('Product not found in the master catalogue');
    if (product.status === 'BLOCKED' || product.isRecalled) {
        throw ApiError_1.ApiError.badRequest('This product is blocked or recalled and cannot be listed');
    }
    const existing = await prisma_1.prisma.vendorProduct.findUnique({
        where: { vendorId_productId: { vendorId, productId: product.id } },
        select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) {
        throw ApiError_1.ApiError.conflict('This product is already in your catalogue — edit it instead of adding a duplicate');
    }
    const payload = {
        ...data,
        vendorId,
        gstRate: data.gstRate ?? product.gstRate,
        mrp: data.mrp ?? product.mrp,
        deletedAt: null,
    };
    const saved = existing
        ? await prisma_1.prisma.vendorProduct.update({ where: { id: existing.id }, data: payload })
        : await prisma_1.prisma.vendorProduct.create({ data: payload });
    await (0, price_history_1.recordPriceChanges)({
        productId: product.id,
        ownerType: 'VENDOR',
        ownerId: vendorId,
        before: {},
        after: saved,
        changedById: userId,
    });
    return saved;
}
async function updateCatalogProduct(vendorId, id, data, userId) {
    const existing = await prisma_1.prisma.vendorProduct.findFirst({ where: { id, vendorId, deletedAt: null } });
    if (!existing)
        throw ApiError_1.ApiError.notFound('Catalogue entry not found');
    const sellingPrice = data.sellingPrice ?? existing.sellingPrice;
    const mrp = data.mrp ?? existing.mrp;
    if ((0, money_1.toNumber)(sellingPrice) > (0, money_1.toNumber)(mrp)) {
        throw ApiError_1.ApiError.badRequest('Selling price cannot exceed MRP');
    }
    const updated = await prisma_1.prisma.vendorProduct.update({ where: { id }, data });
    await (0, price_history_1.recordPriceChanges)({
        productId: existing.productId,
        ownerType: 'VENDOR',
        ownerId: vendorId,
        before: existing,
        after: updated,
        changedById: userId,
    });
    return updated;
}
async function removeCatalogProduct(vendorId, id) {
    const existing = await prisma_1.prisma.vendorProduct.findFirst({ where: { id, vendorId, deletedAt: null } });
    if (!existing)
        throw ApiError_1.ApiError.notFound('Catalogue entry not found');
    return prisma_1.prisma.vendorProduct.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
}
async function bulkUpdatePrices(vendorId, items, userId) {
    const ids = items.map((item) => item.vendorProductId);
    const existing = await prisma_1.prisma.vendorProduct.findMany({
        where: { id: { in: ids }, vendorId, deletedAt: null },
    });
    const byId = new Map(existing.map((row) => [row.id, row]));
    const updated = [];
    for (const item of items) {
        const current = byId.get(item.vendorProductId);
        if (!current)
            continue;
        const sellingPrice = item.sellingPrice ?? (0, money_1.toNumber)(current.sellingPrice);
        if (sellingPrice > (0, money_1.toNumber)(current.mrp))
            continue;
        const row = await prisma_1.prisma.vendorProduct.update({
            where: { id: current.id },
            data: {
                ...(item.sellingPrice !== undefined ? { sellingPrice: item.sellingPrice } : {}),
                ...(item.purchasePrice !== undefined ? { purchasePrice: item.purchasePrice } : {}),
                ...(item.discountPct !== undefined ? { discountPct: item.discountPct } : {}),
            },
        });
        await (0, price_history_1.recordPriceChanges)({
            productId: current.productId,
            ownerType: 'VENDOR',
            ownerId: vendorId,
            before: current,
            after: row,
            changedById: userId,
        });
        updated.push(row.id);
    }
    return { updated: updated.length, skipped: items.length - updated.length };
}
// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function dashboard(vendorId, days = 30) {
    const todayStart = (0, time_1.startOfDay)();
    const todayEnd = (0, time_1.endOfDay)();
    const rangeStart = (0, time_1.startOfDay)((0, time_1.dayjs)().subtract(days - 1, 'day').toDate());
    const [todaysOrders, pendingOrders, totalProducts, stockAgg, lowStock, expiringStock, salesAgg, pendingPayments,] = await Promise.all([
        prisma_1.prisma.purchaseOrder.count({ where: { vendorId, createdAt: { gte: todayStart, lte: todayEnd } } }),
        prisma_1.prisma.purchaseOrder.count({ where: { vendorId, status: { in: ['PLACED', 'ACCEPTED', 'PROCESSING'] } } }),
        prisma_1.prisma.vendorProduct.count({ where: { vendorId, deletedAt: null, status: 'ACTIVE' } }),
        prisma_1.prisma.inventoryBatch.aggregate({
            where: { vendorId, status: 'ACTIVE', quantity: { gt: 0 } },
            _sum: { quantity: true, freeQuantity: true },
        }),
        prisma_1.prisma.$queryRaw `
      SELECT COUNT(*) AS count FROM inventory i
      JOIN warehouses w ON w.id = i.warehouseId
      WHERE w.vendorId = ${vendorId} AND i.availableQty <= i.minStockAlert`,
        prisma_1.prisma.inventoryBatch.count({
            where: {
                vendorId,
                status: 'ACTIVE',
                quantity: { gt: 0 },
                expiryDate: { gt: new Date(), lte: (0, time_1.dayjs)().add(90, 'day').toDate() },
            },
        }),
        prisma_1.prisma.purchaseOrder.aggregate({
            where: { vendorId, status: { in: ['DELIVERED', 'RECEIVED', 'COMPLETED'] } },
            _sum: { totalAmount: true },
        }),
        prisma_1.prisma.purchaseOrder.aggregate({
            where: { vendorId, paymentStatus: { in: ['PENDING', 'PARTIAL'] }, status: { notIn: ['CANCELLED', 'REJECTED'] } },
            _sum: { totalAmount: true, paidAmount: true },
        }),
    ]);
    const [ordersTrend, salesTrend, topProducts, topRetailers] = await Promise.all([
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COUNT(*) AS count FROM purchase_orders
      WHERE vendorId = ${vendorId} AND createdAt >= ${rangeStart}
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COALESCE(SUM(totalAmount), 0) AS total FROM purchase_orders
      WHERE vendorId = ${vendorId} AND createdAt >= ${rangeStart}
        AND status IN ('DELIVERED','RECEIVED','COMPLETED')
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT p.id, p.name, SUM(poi.quantity) AS qty, COALESCE(SUM(poi.totalAmount), 0) AS revenue
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchaseOrderId
      JOIN products p ON p.id = poi.productId
      WHERE po.vendorId = ${vendorId} AND po.createdAt >= ${rangeStart}
      GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 10`,
        prisma_1.prisma.$queryRaw `
      SELECT s.id, s.storeName, COUNT(po.id) AS orders, COALESCE(SUM(po.totalAmount), 0) AS total
      FROM purchase_orders po
      JOIN medical_shops s ON s.id = po.retailerId
      WHERE po.vendorId = ${vendorId} AND po.createdAt >= ${rangeStart}
      GROUP BY s.id, s.storeName ORDER BY total DESC LIMIT 10`,
    ]);
    const outstanding = (0, money_1.toNumber)(pendingPayments._sum.totalAmount ?? 0) - (0, money_1.toNumber)(pendingPayments._sum.paidAmount ?? 0);
    return {
        cards: {
            todaysOrders,
            pendingOrders,
            totalProducts,
            totalStock: (stockAgg._sum.quantity ?? 0) + (stockAgg._sum.freeQuantity ?? 0),
            lowStock: Number(lowStock[0]?.count ?? 0),
            expiringStock,
            totalSales: (0, money_1.toNumber)(salesAgg._sum.totalAmount ?? 0),
            pendingPayments: Math.max(0, outstanding),
        },
        charts: {
            ordersTrend: ordersTrend.map((row) => ({ day: (0, time_1.dayjs)(row.day).format('YYYY-MM-DD'), value: Number(row.count) })),
            salesTrend: salesTrend.map((row) => ({ day: (0, time_1.dayjs)(row.day).format('YYYY-MM-DD'), value: Number(row.total) })),
            topProducts: topProducts.map((row) => ({
                id: row.id,
                name: row.name,
                quantity: Number(row.qty),
                revenue: Number(row.revenue),
            })),
            topRetailers: topRetailers.map((row) => ({
                id: row.id,
                name: row.storeName,
                orders: Number(row.orders),
                amount: Number(row.total),
            })),
        },
    };
}
//# sourceMappingURL=vendor.service.js.map