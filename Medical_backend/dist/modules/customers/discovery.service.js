"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nearbyStores = nearbyStores;
exports.getStore = getStore;
exports.storeProducts = storeProducts;
exports.availabilityMap = availabilityMap;
exports.searchProducts = searchProducts;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../database/prisma");
const env_1 = require("../../config/env");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const geo_1 = require("../../utils/geo");
const money_1 = require("../../utils/money");
const pickup_service_1 = require("../retailers/pickup.service");
/**
 * Nearby store search. A bounding box built from the radius lets MySQL use the
 * (latitude, longitude) index, then the exact haversine distance filters and
 * orders the shortlist.
 */
async function nearbyStores(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const hasLocation = query.latitude !== undefined && query.longitude !== undefined;
    if (!hasLocation && !query.pincode && !query.city && !query.search) {
        throw ApiError_1.ApiError.badRequest('Share your location, or search by pincode, city or store name');
    }
    const radius = Math.min(query.radius ?? env_1.env.DEFAULT_SEARCH_RADIUS_KM, env_1.env.MAX_SEARCH_RADIUS_KM);
    const where = {
        deletedAt: null,
        approvalStatus: 'APPROVED',
        isActive: true,
        ...(query.pincode ? { pincode: query.pincode } : {}),
        ...(query.city ? { city: { contains: query.city } } : {}),
        ...(query.search
            ? {
                OR: [
                    { storeName: { contains: query.search } },
                    { addressLine1: { contains: query.search } },
                    { city: { contains: query.search } },
                ],
            }
            : {}),
    };
    if (hasLocation) {
        const box = (0, geo_1.boundingBox)({ latitude: query.latitude, longitude: query.longitude }, radius);
        where.latitude = { gte: box.minLat, lte: box.maxLat };
        where.longitude = { gte: box.minLng, lte: box.maxLng };
    }
    // Only stores that actually list the requested product / category.
    if (query.productId || query.categoryId) {
        where.products = {
            some: {
                deletedAt: null,
                status: 'ACTIVE',
                ...(query.productId ? { productId: query.productId } : {}),
                ...(query.categoryId ? { product: { categoryId: query.categoryId } } : {}),
            },
        };
    }
    const candidates = await prisma_1.prisma.retailer.findMany({
        where,
        select: {
            id: true,
            code: true,
            storeName: true,
            logoUrl: true,
            description: true,
            addressLine1: true,
            addressLine2: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            latitude: true,
            longitude: true,
            ratingAvg: true,
            ratingCount: true,
            isTemporarilyClosed: true,
            images: { select: { url: true }, take: 1, orderBy: { sortOrder: 'asc' } },
            _count: { select: { products: { where: { status: 'ACTIVE', deletedAt: null } } } },
        },
        // Bounded so the distance pass stays cheap even for dense cities.
        take: 500,
    });
    const withDistance = candidates
        .map((store) => {
        const distanceKm = hasLocation && store.latitude !== null && store.longitude !== null
            ? (0, geo_1.haversineKm)({ latitude: query.latitude, longitude: query.longitude }, { latitude: (0, money_1.toNumber)(store.latitude), longitude: (0, money_1.toNumber)(store.longitude) })
            : null;
        return { ...store, distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(2)) };
    })
        .filter((store) => (hasLocation ? store.distanceKm !== null && store.distanceKm <= radius : true));
    const openStates = await Promise.all(withDistance.map(async (store) => ({ id: store.id, state: await (0, pickup_service_1.storeOpenState)({ id: store.id }) })));
    const openById = new Map(openStates.map((entry) => [entry.id, entry.state]));
    let results = withDistance.map((store) => {
        const open = openById.get(store.id);
        return {
            ...store,
            ratingAvg: (0, money_1.toNumber)(store.ratingAvg),
            productCount: store._count.products,
            isOpen: open.isOpen,
            openTime: open.openTime,
            closeTime: open.closeTime,
            closedReason: open.reason,
            imageUrl: store.images[0]?.url ?? null,
        };
    });
    if (query.openNow)
        results = results.filter((store) => store.isOpen);
    results.sort((a, b) => {
        if (query.sortBy === 'rating')
            return b.ratingAvg - a.ratingAvg;
        if (query.sortBy === 'name')
            return a.storeName.localeCompare(b.storeName);
        if (a.distanceKm === null || b.distanceKm === null)
            return 0;
        return a.distanceKm - b.distanceKm;
    });
    return {
        items: results.slice(skip, skip + take),
        meta: (0, response_1.buildMeta)(page, limit, results.length),
    };
}
async function getStore(retailerId) {
    const store = await prisma_1.prisma.retailer.findFirst({
        where: { id: retailerId, deletedAt: null, approvalStatus: 'APPROVED', isActive: true },
        select: {
            id: true,
            code: true,
            storeName: true,
            description: true,
            logoUrl: true,
            phone: true,
            email: true,
            addressLine1: true,
            addressLine2: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            latitude: true,
            longitude: true,
            ratingAvg: true,
            ratingCount: true,
            isTemporarilyClosed: true,
            closureReason: true,
            drugLicenseNumber: true,
            images: { orderBy: { sortOrder: 'asc' } },
            businessHours: { orderBy: { dayOfWeek: 'asc' } },
            holidays: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 30 },
            pickupConfig: { select: { slotDurationMins: true, bufferMins: true, advanceDays: true, isEnabled: true } },
            _count: { select: { products: { where: { status: 'ACTIVE', deletedAt: null } } } },
        },
    });
    if (!store)
        throw ApiError_1.ApiError.notFound('Store not found or not currently available');
    const open = await (0, pickup_service_1.storeOpenState)({ id: store.id });
    return {
        ...store,
        ratingAvg: (0, money_1.toNumber)(store.ratingAvg),
        productCount: store._count.products,
        isOpen: open.isOpen,
        openTime: open.openTime,
        closeTime: open.closeTime,
        closedReason: open.reason,
    };
}
/** Products a specific store currently offers, with live availability. */
async function storeProducts(retailerId, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const store = await prisma_1.prisma.retailer.findFirst({
        where: { id: retailerId, deletedAt: null, approvalStatus: 'APPROVED', isActive: true },
        select: { id: true },
    });
    if (!store)
        throw ApiError_1.ApiError.notFound('Store not found');
    const where = {
        retailerId,
        deletedAt: null,
        status: 'ACTIVE',
        product: {
            deletedAt: null,
            status: 'ACTIVE',
            isRecalled: false,
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
            ...(query.subCategoryId ? { subCategoryId: query.subCategoryId } : {}),
            ...(query.manufacturerId ? { manufacturerId: query.manufacturerId } : {}),
            ...(query.prescriptionRequired !== undefined
                ? { prescriptionRequired: query.prescriptionRequired }
                : {}),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search } },
                        { genericName: { contains: query.search } },
                        { brandName: { contains: query.search } },
                        { composition: { contains: query.search } },
                    ],
                }
                : {}),
        },
        ...(query.minPrice !== undefined || query.maxPrice !== undefined
            ? {
                sellingPrice: {
                    ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
                    ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
                },
            }
            : {}),
    };
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
                        strength: true,
                        dosageForm: true,
                        imageUrl: true,
                        prescriptionRequired: true,
                        composition: true,
                        category: { select: { id: true, name: true } },
                        manufacturer: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { product: { name: 'asc' } },
            skip,
            take,
        }),
        prisma_1.prisma.retailerProduct.count({ where }),
    ]);
    const availability = await availabilityMap(retailerId, rows.map((row) => row.productId));
    const items = rows
        .map((row) => ({
        id: row.id,
        productId: row.productId,
        sellingPrice: (0, money_1.toNumber)(row.sellingPrice),
        mrp: (0, money_1.toNumber)(row.mrp),
        discountPct: (0, money_1.toNumber)(row.discountPct),
        gstRate: (0, money_1.toNumber)(row.gstRate),
        maxOrderQty: row.maxOrderQty,
        availableQty: availability.get(row.productId) ?? 0,
        inStock: (availability.get(row.productId) ?? 0) > 0,
        product: row.product,
    }))
        .filter((item) => (query.inStockOnly === false ? true : item.inStock));
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
/**
 * Sellable quantity per product for a store — excludes reserved, expired and
 * blocked batches so customers never see stock they cannot buy.
 */
async function availabilityMap(retailerId, productIds) {
    if (productIds.length === 0)
        return new Map();
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT b.productId AS productId,
           COALESCE(SUM(b.quantity + b.freeQuantity - b.reservedQty), 0) AS qty
    FROM inventory_batches b
    WHERE b.retailerId = ${retailerId}
      AND b.status = 'ACTIVE'
      AND b.expiryDate > CURDATE()
      AND b.productId IN (${client_1.Prisma.join(productIds)})
    GROUP BY b.productId`;
    return rows.reduce((map, row) => {
        map.set(row.productId, Math.max(0, Number(row.qty)));
        return map;
    }, new Map());
}
/** Cross-store product search: which nearby stores have this medicine. */
async function searchProducts(query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const hasLocation = query.latitude !== undefined && query.longitude !== undefined;
    const radius = Math.min(query.radius ?? env_1.env.DEFAULT_SEARCH_RADIUS_KM, env_1.env.MAX_SEARCH_RADIUS_KM);
    const retailerWhere = {
        deletedAt: null,
        approvalStatus: 'APPROVED',
        isActive: true,
    };
    if (hasLocation) {
        const box = (0, geo_1.boundingBox)({ latitude: query.latitude, longitude: query.longitude }, radius);
        retailerWhere.latitude = { gte: box.minLat, lte: box.maxLat };
        retailerWhere.longitude = { gte: box.minLng, lte: box.maxLng };
    }
    const where = {
        deletedAt: null,
        status: 'ACTIVE',
        retailer: retailerWhere,
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
                        { composition: { contains: query.search } },
                    ],
                }
                : {}),
        },
    };
    const [rows, total] = await Promise.all([
        prisma_1.prisma.retailerProduct.findMany({
            where,
            include: {
                retailer: {
                    select: {
                        id: true,
                        storeName: true,
                        city: true,
                        pincode: true,
                        latitude: true,
                        longitude: true,
                        ratingAvg: true,
                    },
                },
                product: {
                    select: {
                        id: true,
                        name: true,
                        genericName: true,
                        brandName: true,
                        packSize: true,
                        imageUrl: true,
                        prescriptionRequired: true,
                        manufacturer: { select: { name: true } },
                    },
                },
            },
            orderBy: { sellingPrice: 'asc' },
            skip,
            take,
        }),
        prisma_1.prisma.retailerProduct.count({ where }),
    ]);
    // Availability resolved per store so the listing reflects real stock.
    const byRetailer = new Map();
    for (const row of rows) {
        byRetailer.set(row.retailerId, [...(byRetailer.get(row.retailerId) ?? []), row.productId]);
    }
    const availability = new Map();
    for (const [storeId, productIds] of byRetailer) {
        const map = await availabilityMap(storeId, productIds);
        for (const [productId, qty] of map)
            availability.set(`${storeId}:${productId}`, qty);
    }
    const items = rows
        .map((row) => {
        const distanceKm = hasLocation && row.retailer.latitude !== null && row.retailer.longitude !== null
            ? Number((0, geo_1.haversineKm)({ latitude: query.latitude, longitude: query.longitude }, {
                latitude: (0, money_1.toNumber)(row.retailer.latitude),
                longitude: (0, money_1.toNumber)(row.retailer.longitude),
            }).toFixed(2))
            : null;
        return {
            retailerProductId: row.id,
            sellingPrice: (0, money_1.toNumber)(row.sellingPrice),
            mrp: (0, money_1.toNumber)(row.mrp),
            discountPct: (0, money_1.toNumber)(row.discountPct),
            availableQty: availability.get(`${row.retailerId}:${row.productId}`) ?? 0,
            distanceKm,
            product: row.product,
            store: { ...row.retailer, ratingAvg: (0, money_1.toNumber)(row.retailer.ratingAvg) },
        };
    })
        .filter((item) => item.availableQty > 0 && (hasLocation ? (item.distanceKm ?? 0) <= radius : true));
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
//# sourceMappingURL=discovery.service.js.map