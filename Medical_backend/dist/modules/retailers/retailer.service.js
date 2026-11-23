"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.setTemporaryClosure = setTemporaryClosure;
exports.assertApproved = assertApproved;
exports.addDocument = addDocument;
exports.deleteDocument = deleteDocument;
exports.addImage = addImage;
exports.deleteImage = deleteImage;
exports.setBusinessHours = setBusinessHours;
exports.listHolidays = listHolidays;
exports.addHoliday = addHoliday;
exports.deleteHoliday = deleteHoliday;
exports.updatePickupConfig = updatePickupConfig;
exports.listCatalog = listCatalog;
exports.addCatalogProduct = addCatalogProduct;
exports.updateCatalogProduct = updateCatalogProduct;
exports.removeCatalogProduct = removeCatalogProduct;
exports.listVendors = listVendors;
exports.listVendorProducts = listVendorProducts;
exports.dashboard = dashboard;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const money_1 = require("../../utils/money");
const time_1 = require("../../utils/time");
const price_history_1 = require("../../common/price-history");
const upload_1 = require("../../middleware/upload");
const vendor_service_1 = require("../vendors/vendor.service");
async function getProfile(retailerId) {
    const retailer = await prisma_1.prisma.retailer.findUnique({
        where: { id: retailerId },
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            documents: { orderBy: { createdAt: 'desc' } },
            images: { orderBy: { sortOrder: 'asc' } },
            businessHours: { orderBy: { dayOfWeek: 'asc' } },
            pickupConfig: true,
            warehouses: { orderBy: { isDefault: 'desc' } },
        },
    });
    if (!retailer)
        throw ApiError_1.ApiError.notFound('Store profile not found');
    return retailer;
}
async function updateProfile(retailerId, data) {
    const retailer = await getProfile(retailerId);
    const identityChanged = (data.gstNumber && data.gstNumber !== retailer.gstNumber) ||
        (data.drugLicenseNumber && data.drugLicenseNumber !== retailer.drugLicenseNumber);
    return prisma_1.prisma.retailer.update({
        where: { id: retailerId },
        data: {
            ...data,
            ...(identityChanged && retailer.approvalStatus === 'APPROVED'
                ? { approvalStatus: 'UNDER_REVIEW' }
                : {}),
        },
    });
}
async function setTemporaryClosure(retailerId, isClosed, reason) {
    return prisma_1.prisma.retailer.update({
        where: { id: retailerId },
        data: { isTemporarilyClosed: isClosed, closureReason: isClosed ? (reason ?? null) : null },
    });
}
async function assertApproved(retailerId) {
    const retailer = await prisma_1.prisma.retailer.findUnique({
        where: { id: retailerId },
        select: { approvalStatus: true, isActive: true },
    });
    if (!retailer)
        throw ApiError_1.ApiError.notFound('Store profile not found');
    if (retailer.approvalStatus !== 'APPROVED' || !retailer.isActive) {
        throw ApiError_1.ApiError.forbidden('Your store is not approved yet. You can complete your profile but cannot trade until approval.');
    }
}
// ---------------------------------------------------------------------------
// Documents & images
// ---------------------------------------------------------------------------
async function addDocument(retailerId, file, data) {
    return prisma_1.prisma.shopDocument.create({
        data: {
            retailerId,
            type: data.type,
            documentNo: data.documentNo ?? null,
            fileUrl: (0, upload_1.publicUrl)('shop-documents', file.filename),
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            issueDate: data.issueDate ?? null,
            expiryDate: data.expiryDate ?? null,
            status: 'PENDING',
        },
    });
}
async function deleteDocument(retailerId, documentId) {
    const document = await prisma_1.prisma.shopDocument.findFirst({ where: { id: documentId, retailerId } });
    if (!document)
        throw ApiError_1.ApiError.notFound('Document not found');
    if (document.status === 'APPROVED') {
        throw ApiError_1.ApiError.badRequest('Approved documents cannot be removed — contact support');
    }
    return prisma_1.prisma.shopDocument.delete({ where: { id: documentId } });
}
async function addImage(retailerId, file, data) {
    return prisma_1.prisma.storeImage.create({
        data: {
            retailerId,
            url: (0, upload_1.publicUrl)('store-images', file.filename),
            caption: data.caption ?? null,
            sortOrder: data.sortOrder ?? 0,
        },
    });
}
async function deleteImage(retailerId, imageId) {
    const image = await prisma_1.prisma.storeImage.findFirst({ where: { id: imageId, retailerId } });
    if (!image)
        throw ApiError_1.ApiError.notFound('Image not found');
    return prisma_1.prisma.storeImage.delete({ where: { id: imageId } });
}
// ---------------------------------------------------------------------------
// Business hours & holidays
// ---------------------------------------------------------------------------
async function setBusinessHours(retailerId, hours) {
    await prisma_1.prisma.$transaction(hours.map((day) => prisma_1.prisma.storeBusinessHour.upsert({
        where: { retailerId_dayOfWeek: { retailerId, dayOfWeek: day.dayOfWeek } },
        update: {
            isClosed: day.isClosed,
            openTime: day.isClosed ? null : (day.openTime ?? null),
            closeTime: day.isClosed ? null : (day.closeTime ?? null),
            breakStart: day.breakStart ?? null,
            breakEnd: day.breakEnd ?? null,
        },
        create: {
            retailerId,
            dayOfWeek: day.dayOfWeek,
            isClosed: day.isClosed,
            openTime: day.isClosed ? null : (day.openTime ?? null),
            closeTime: day.isClosed ? null : (day.closeTime ?? null),
            breakStart: day.breakStart ?? null,
            breakEnd: day.breakEnd ?? null,
        },
    })));
    // Future slots are rebuilt lazily on the next availability read.
    await prisma_1.prisma.pickupSlot.deleteMany({
        where: { retailerId, date: { gte: (0, time_1.toDateOnly)(new Date()) }, bookedCount: 0 },
    });
    return prisma_1.prisma.storeBusinessHour.findMany({ where: { retailerId }, orderBy: { dayOfWeek: 'asc' } });
}
async function listHolidays(retailerId) {
    return prisma_1.prisma.storeHoliday.findMany({
        where: { retailerId, date: { gte: (0, time_1.dayjs)().subtract(30, 'day').toDate() } },
        orderBy: { date: 'asc' },
    });
}
async function addHoliday(retailerId, data) {
    const date = (0, time_1.toDateOnly)(data.date);
    const holiday = await prisma_1.prisma.storeHoliday.upsert({
        where: { retailerId_date: { retailerId, date } },
        update: {
            title: data.title ?? null,
            isFullDay: data.isFullDay,
            openTime: data.openTime ?? null,
            closeTime: data.closeTime ?? null,
        },
        create: {
            retailerId,
            date,
            title: data.title ?? null,
            isFullDay: data.isFullDay,
            openTime: data.openTime ?? null,
            closeTime: data.closeTime ?? null,
        },
    });
    const booked = await prisma_1.prisma.pickupSlot.count({
        where: { retailerId, date, bookedCount: { gt: 0 } },
    });
    await prisma_1.prisma.pickupSlot.updateMany({
        where: { retailerId, date, bookedCount: 0 },
        data: { status: 'DISABLED' },
    });
    return { holiday, bookedSlotsNeedingAttention: booked };
}
async function deleteHoliday(retailerId, holidayId) {
    const holiday = await prisma_1.prisma.storeHoliday.findFirst({ where: { id: holidayId, retailerId } });
    if (!holiday)
        throw ApiError_1.ApiError.notFound('Holiday not found');
    await prisma_1.prisma.storeHoliday.delete({ where: { id: holidayId } });
    await prisma_1.prisma.pickupSlot.updateMany({
        where: { retailerId, date: holiday.date, status: 'DISABLED' },
        data: { status: 'AVAILABLE' },
    });
    return { deleted: true };
}
async function updatePickupConfig(retailerId, data) {
    const config = await prisma_1.prisma.pickupSlotConfig.upsert({
        where: { retailerId },
        update: data,
        create: { retailerId, ...data },
    });
    // Slot duration or capacity changes invalidate unbooked slots.
    if (data.slotDurationMins !== undefined) {
        await prisma_1.prisma.pickupSlot.deleteMany({
            where: { retailerId, date: { gte: (0, time_1.toDateOnly)(new Date()) }, bookedCount: 0 },
        });
    }
    else if (data.maxOrdersPerSlot !== undefined) {
        await prisma_1.prisma.pickupSlot.updateMany({
            where: { retailerId, date: { gte: (0, time_1.toDateOnly)(new Date()) } },
            data: { capacity: Number(data.maxOrdersPerSlot) },
        });
    }
    return config;
}
// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
async function listCatalog(retailerId, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = { retailerId, deletedAt: null };
    if (query.status)
        where.status = query.status;
    if (query.categoryId || query.search) {
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
    const [rows, total] = await Promise.all([
        prisma_1.prisma.retailerProduct.findMany({
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
        prisma_1.prisma.retailerProduct.count({ where }),
    ]);
    const stock = await (0, vendor_service_1.stockByProduct)({ ownerType: 'RETAILER', retailerId }, rows.map((row) => row.productId));
    const items = rows
        .map((row) => {
        const availableQty = stock.get(row.productId) ?? 0;
        return { ...row, availableQty, isLowStock: availableQty <= row.minStockAlert };
    })
        .filter((row) => {
        if (query.inStockOnly && row.availableQty <= 0)
            return false;
        if (query.lowStockOnly && !row.isLowStock)
            return false;
        return true;
    });
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function addCatalogProduct(retailerId, data, userId) {
    await assertApproved(retailerId);
    const product = await prisma_1.prisma.product.findFirst({
        where: { id: data.productId, deletedAt: null },
        select: { id: true, status: true, isRecalled: true, mrp: true, gstRate: true },
    });
    if (!product)
        throw ApiError_1.ApiError.badRequest('Product not found in the master catalogue');
    if (product.status === 'BLOCKED' || product.isRecalled) {
        throw ApiError_1.ApiError.badRequest('This product is blocked or recalled and cannot be listed');
    }
    const existing = await prisma_1.prisma.retailerProduct.findUnique({
        where: { retailerId_productId: { retailerId, productId: product.id } },
        select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) {
        throw ApiError_1.ApiError.conflict('This product is already in your catalogue — edit it instead of adding a duplicate');
    }
    const payload = {
        ...data,
        retailerId,
        gstRate: data.gstRate ?? product.gstRate,
        mrp: data.mrp ?? product.mrp,
        deletedAt: null,
    };
    const saved = existing
        ? await prisma_1.prisma.retailerProduct.update({ where: { id: existing.id }, data: payload })
        : await prisma_1.prisma.retailerProduct.create({ data: payload });
    await (0, price_history_1.recordPriceChanges)({
        productId: product.id,
        ownerType: 'RETAILER',
        ownerId: retailerId,
        before: {},
        after: saved,
        changedById: userId,
    });
    return saved;
}
async function updateCatalogProduct(retailerId, id, data, userId) {
    const existing = await prisma_1.prisma.retailerProduct.findFirst({ where: { id, retailerId, deletedAt: null } });
    if (!existing)
        throw ApiError_1.ApiError.notFound('Catalogue entry not found');
    const sellingPrice = data.sellingPrice ?? existing.sellingPrice;
    const mrp = data.mrp ?? existing.mrp;
    if ((0, money_1.toNumber)(sellingPrice) > (0, money_1.toNumber)(mrp)) {
        throw ApiError_1.ApiError.badRequest('Selling price cannot exceed MRP');
    }
    const updated = await prisma_1.prisma.retailerProduct.update({ where: { id }, data });
    await (0, price_history_1.recordPriceChanges)({
        productId: existing.productId,
        ownerType: 'RETAILER',
        ownerId: retailerId,
        before: existing,
        after: updated,
        changedById: userId,
    });
    return updated;
}
async function removeCatalogProduct(retailerId, id) {
    const existing = await prisma_1.prisma.retailerProduct.findFirst({ where: { id, retailerId, deletedAt: null } });
    if (!existing)
        throw ApiError_1.ApiError.notFound('Catalogue entry not found');
    return prisma_1.prisma.retailerProduct.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
}
// ---------------------------------------------------------------------------
// Vendor browsing (wholesale sourcing)
// ---------------------------------------------------------------------------
async function listVendors(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        deletedAt: null,
        approvalStatus: 'APPROVED',
        isActive: true,
        ...(query.city ? { city: query.city } : {}),
        ...(query.state ? { state: query.state } : {}),
        ...(query.search
            ? {
                OR: [
                    { businessName: { contains: query.search } },
                    { city: { contains: query.search } },
                ],
            }
            : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.vendor.findMany({
            where,
            select: {
                id: true,
                code: true,
                businessName: true,
                city: true,
                state: true,
                pincode: true,
                logoUrl: true,
                description: true,
                minOrderValue: true,
                phone: true,
                gstNumber: true,
                _count: { select: { products: { where: { status: 'ACTIVE', deletedAt: null } } } },
            },
            orderBy: { businessName: 'asc' },
            skip,
            take,
        }),
        prisma_1.prisma.vendor.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
async function listVendorProducts(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        deletedAt: null,
        status: 'ACTIVE',
        vendor: { approvalStatus: 'APPROVED', isActive: true, deletedAt: null },
        product: {
            deletedAt: null,
            status: 'ACTIVE',
            isRecalled: false,
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
            ...(query.manufacturerId ? { manufacturerId: query.manufacturerId } : {}),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search } },
                        { genericName: { contains: query.search } },
                        { brandName: { contains: query.search } },
                    ],
                }
                : {}),
        },
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    };
    const [rows, total] = await Promise.all([
        prisma_1.prisma.vendorProduct.findMany({
            where,
            include: {
                vendor: { select: { id: true, businessName: true, city: true, minOrderValue: true } },
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
                        manufacturer: { select: { id: true, name: true } },
                        category: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { sellingPrice: 'asc' },
            skip,
            take,
        }),
        prisma_1.prisma.vendorProduct.count({ where }),
    ]);
    // Availability is resolved per vendor so retailers never order dead stock.
    const byVendor = new Map();
    for (const row of rows) {
        byVendor.set(row.vendorId, [...(byVendor.get(row.vendorId) ?? []), row.productId]);
    }
    const availability = new Map();
    for (const [vendorId, productIds] of byVendor) {
        const stock = await (0, vendor_service_1.stockByProduct)({ ownerType: 'VENDOR', vendorId }, productIds);
        for (const [productId, qty] of stock)
            availability.set(`${vendorId}:${productId}`, qty);
    }
    const items = rows
        .map((row) => ({
        ...row,
        availableQty: availability.get(`${row.vendorId}:${row.productId}`) ?? 0,
    }))
        .filter((row) => (query.inStockOnly ? row.availableQty > 0 : true));
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function dashboard(retailerId, days = 30) {
    const todayStart = (0, time_1.startOfDay)();
    const todayEnd = (0, time_1.endOfDay)();
    const rangeStart = (0, time_1.startOfDay)((0, time_1.dayjs)().subtract(days - 1, 'day').toDate());
    const [todaysSalesAgg, todaysOrders, pendingOrders, totalProducts, stockAgg, lowStock, expiringProducts, pendingPurchases,] = await Promise.all([
        prisma_1.prisma.order.aggregate({
            where: {
                retailerId,
                createdAt: { gte: todayStart, lte: todayEnd },
                status: { in: ['PICKED_UP', 'COMPLETED'] },
            },
            _sum: { totalAmount: true },
        }),
        prisma_1.prisma.order.count({ where: { retailerId, createdAt: { gte: todayStart, lte: todayEnd } } }),
        prisma_1.prisma.order.count({
            where: { retailerId, status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] } },
        }),
        prisma_1.prisma.retailerProduct.count({ where: { retailerId, deletedAt: null, status: 'ACTIVE' } }),
        prisma_1.prisma.inventoryBatch.aggregate({
            where: { retailerId, status: 'ACTIVE', quantity: { gt: 0 } },
            _sum: { quantity: true, freeQuantity: true },
        }),
        prisma_1.prisma.$queryRaw `
      SELECT COUNT(*) AS count FROM inventory i
      JOIN warehouses w ON w.id = i.warehouseId
      WHERE w.retailerId = ${retailerId} AND i.availableQty <= i.minStockAlert`,
        prisma_1.prisma.inventoryBatch.count({
            where: {
                retailerId,
                status: 'ACTIVE',
                quantity: { gt: 0 },
                expiryDate: { gt: new Date(), lte: (0, time_1.dayjs)().add(90, 'day').toDate() },
            },
        }),
        prisma_1.prisma.purchaseOrder.count({
            where: { retailerId, status: { in: ['PLACED', 'ACCEPTED', 'PROCESSING', 'DISPATCHED', 'DELIVERED'] } },
        }),
    ]);
    const [dailySales, monthlySales, topProducts, stockMovement] = await Promise.all([
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, COALESCE(SUM(totalAmount), 0) AS total, COUNT(*) AS orders
      FROM orders WHERE retailerId = ${retailerId} AND createdAt >= ${rangeStart}
        AND status IN ('PICKED_UP','COMPLETED')
      GROUP BY DATE(createdAt) ORDER BY day ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COALESCE(SUM(totalAmount), 0) AS total
      FROM orders WHERE retailerId = ${retailerId}
        AND createdAt >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        AND status IN ('PICKED_UP','COMPLETED')
      GROUP BY month ORDER BY month ASC`,
        prisma_1.prisma.$queryRaw `
      SELECT p.id, p.name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.totalAmount), 0) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.orderId
      JOIN products p ON p.id = oi.productId
      WHERE o.retailerId = ${retailerId} AND o.createdAt >= ${rangeStart}
      GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 10`,
        prisma_1.prisma.$queryRaw `
      SELECT DATE(createdAt) AS day, direction, COALESCE(SUM(quantity), 0) AS qty
      FROM inventory_transactions
      WHERE retailerId = ${retailerId} AND createdAt >= ${rangeStart}
        AND direction IN ('IN','OUT')
      GROUP BY DATE(createdAt), direction ORDER BY day ASC`,
    ]);
    return {
        cards: {
            todaysSales: (0, money_1.toNumber)(todaysSalesAgg._sum.totalAmount ?? 0),
            todaysOrders,
            pendingOrders,
            totalProducts,
            currentStock: (stockAgg._sum.quantity ?? 0) + (stockAgg._sum.freeQuantity ?? 0),
            lowStock: Number(lowStock[0]?.count ?? 0),
            expiringProducts,
            pendingPurchases,
        },
        charts: {
            dailySales: dailySales.map((row) => ({
                day: (0, time_1.dayjs)(row.day).format('YYYY-MM-DD'),
                value: Number(row.total),
                orders: Number(row.orders),
            })),
            monthlySales: monthlySales.map((row) => ({ month: row.month, value: Number(row.total) })),
            topProducts: topProducts.map((row) => ({
                id: row.id,
                name: row.name,
                quantity: Number(row.qty),
                revenue: Number(row.revenue),
            })),
            stockMovement: stockMovement.map((row) => ({
                day: (0, time_1.dayjs)(row.day).format('YYYY-MM-DD'),
                direction: row.direction,
                quantity: Number(row.qty),
            })),
        },
    };
}
//# sourceMappingURL=retailer.service.js.map