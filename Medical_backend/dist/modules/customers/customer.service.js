"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.setLocation = setLocation;
exports.listAddresses = listAddresses;
exports.addAddress = addAddress;
exports.updateAddress = updateAddress;
exports.deleteAddress = deleteAddress;
exports.listFavorites = listFavorites;
exports.toggleFavorite = toggleFavorite;
exports.addReview = addReview;
exports.listStoreReviews = listStoreReviews;
exports.dashboard = dashboard;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const money_1 = require("../../utils/money");
const constants_1 = require("../../config/constants");
async function getProfile(customerId) {
    const customer = await prisma_1.prisma.customer.findUnique({
        where: { id: customerId },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    avatarUrl: true,
                    emailVerifiedAt: true,
                    phoneVerifiedAt: true,
                },
            },
            addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
        },
    });
    if (!customer)
        throw ApiError_1.ApiError.notFound('Customer profile not found');
    return customer;
}
async function updateProfile(customerId, userId, data) {
    const { firstName, lastName, email, avatarUrl, ...customerFields } = data;
    if (email) {
        const existing = await prisma_1.prisma.user.findFirst({
            where: { email: String(email).toLowerCase(), id: { not: userId } },
            select: { id: true },
        });
        if (existing)
            throw ApiError_1.ApiError.conflict('This email is already used by another account');
    }
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                ...(firstName ? { firstName: String(firstName) } : {}),
                ...(lastName !== undefined ? { lastName: lastName } : {}),
                ...(email ? { email: String(email).toLowerCase(), emailVerifiedAt: null } : {}),
                ...(avatarUrl ? { avatarUrl: String(avatarUrl) } : {}),
            },
        }),
        prisma_1.prisma.customer.update({ where: { id: customerId }, data: customerFields }),
    ]);
    return getProfile(customerId);
}
async function setLocation(customerId, latitude, longitude) {
    return prisma_1.prisma.customer.update({
        where: { id: customerId },
        data: { latitude, longitude },
        select: { id: true, latitude: true, longitude: true },
    });
}
// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------
async function listAddresses(customerId) {
    return prisma_1.prisma.customerAddress.findMany({
        where: { customerId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
}
async function addAddress(customerId, data) {
    const count = await prisma_1.prisma.customerAddress.count({ where: { customerId } });
    const isDefault = Boolean(data.isDefault) || count === 0;
    if (isDefault) {
        await prisma_1.prisma.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
    }
    return prisma_1.prisma.customerAddress.create({ data: { ...data, customerId, isDefault } });
}
async function updateAddress(customerId, id, data) {
    const address = await prisma_1.prisma.customerAddress.findFirst({ where: { id, customerId } });
    if (!address)
        throw ApiError_1.ApiError.notFound('Address not found');
    if (data.isDefault) {
        await prisma_1.prisma.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
    }
    return prisma_1.prisma.customerAddress.update({ where: { id }, data });
}
async function deleteAddress(customerId, id) {
    const address = await prisma_1.prisma.customerAddress.findFirst({ where: { id, customerId } });
    if (!address)
        throw ApiError_1.ApiError.notFound('Address not found');
    await prisma_1.prisma.customerAddress.delete({ where: { id } });
    // Promote another address so the customer always has a default.
    if (address.isDefault) {
        const next = await prisma_1.prisma.customerAddress.findFirst({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
        });
        if (next)
            await prisma_1.prisma.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { deleted: true };
}
// ---------------------------------------------------------------------------
// Favourites & reviews
// ---------------------------------------------------------------------------
async function listFavorites(customerId) {
    const favorites = await prisma_1.prisma.favorite.findMany({
        where: { customerId },
        include: {
            retailer: {
                select: { id: true, storeName: true, logoUrl: true, city: true, ratingAvg: true, isActive: true },
            },
            product: { select: { id: true, name: true, brandName: true, packSize: true, imageUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return {
        stores: favorites
            .filter((favorite) => favorite.retailer)
            .map((favorite) => ({
            favoriteId: favorite.id,
            ...favorite.retailer,
            ratingAvg: (0, money_1.toNumber)(favorite.retailer.ratingAvg),
        })),
        products: favorites
            .filter((favorite) => favorite.product)
            .map((favorite) => ({ favoriteId: favorite.id, ...favorite.product })),
    };
}
async function toggleFavorite(customerId, input) {
    const existing = await prisma_1.prisma.favorite.findFirst({
        where: {
            customerId,
            retailerId: input.retailerId ?? null,
            productId: input.productId ?? null,
        },
    });
    if (existing) {
        await prisma_1.prisma.favorite.delete({ where: { id: existing.id } });
        return { favorited: false };
    }
    await prisma_1.prisma.favorite.create({
        data: {
            customerId,
            retailerId: input.retailerId ?? null,
            productId: input.productId ?? null,
        },
    });
    return { favorited: true };
}
/** Reviews require a completed order at that store — no drive-by ratings. */
async function addReview(customerId, input) {
    const completedOrder = await prisma_1.prisma.order.findFirst({
        where: {
            customerId,
            retailerId: input.retailerId,
            status: 'COMPLETED',
            ...(input.orderId ? { id: input.orderId } : {}),
        },
        select: { id: true },
    });
    if (!completedOrder) {
        throw ApiError_1.ApiError.badRequest('You can review a store only after completing an order there');
    }
    const existing = await prisma_1.prisma.review.findFirst({
        where: { customerId, retailerId: input.retailerId, orderId: completedOrder.id },
    });
    const review = existing
        ? await prisma_1.prisma.review.update({
            where: { id: existing.id },
            data: { rating: input.rating, comment: input.comment ?? null },
        })
        : await prisma_1.prisma.review.create({
            data: {
                customerId,
                retailerId: input.retailerId,
                orderId: completedOrder.id,
                rating: input.rating,
                comment: input.comment ?? null,
            },
        });
    const aggregate = await prisma_1.prisma.review.aggregate({
        where: { retailerId: input.retailerId, isVisible: true },
        _avg: { rating: true },
        _count: true,
    });
    await prisma_1.prisma.retailer.update({
        where: { id: input.retailerId },
        data: {
            ratingAvg: aggregate._avg.rating ?? 0,
            ratingCount: aggregate._count,
        },
    });
    return review;
}
async function listStoreReviews(retailerId) {
    return prisma_1.prisma.review.findMany({
        where: { retailerId, isVisible: true },
        include: { customer: { select: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
}
// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function dashboard(customerId) {
    const [activeOrders, recentOrders, favorites, totalOrders] = await Promise.all([
        prisma_1.prisma.order.findMany({
            where: { customerId, status: { in: constants_1.ORDER_RESERVED_STATUSES } },
            include: {
                retailer: { select: { id: true, storeName: true, phone: true, addressLine1: true, city: true } },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
        prisma_1.prisma.order.findMany({
            where: { customerId, status: { in: ['COMPLETED', 'PICKED_UP', 'CANCELLED', 'REJECTED'] } },
            include: {
                retailer: { select: { id: true, storeName: true } },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
        listFavorites(customerId),
        prisma_1.prisma.order.count({ where: { customerId } }),
    ]);
    return {
        cards: {
            activeOrders: activeOrders.length,
            totalOrders,
            favoriteStores: favorites.stores.length,
            favoriteProducts: favorites.products.length,
        },
        activeOrders,
        recentOrders,
        favorites,
    };
}
//# sourceMappingURL=customer.service.js.map