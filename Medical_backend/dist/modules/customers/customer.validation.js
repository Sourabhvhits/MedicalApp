"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewSchema = exports.favoriteSchema = exports.cancelOrderSchema = exports.customerOrderListQuery = exports.checkoutSchema = exports.updateCartItemSchema = exports.addToCartSchema = exports.productSearchQuery = exports.storeProductsQuery = exports.nearbyStoresQuery = exports.addressSchema = exports.customerLocationSchema = exports.customerProfileSchema = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
const vendor_validation_1 = require("../vendors/vendor.validation");
exports.customerProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(2).max(100).optional(),
    lastName: zod_1.z.string().trim().max(100).optional(),
    email: zod_1.z.string().trim().toLowerCase().email().optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
    dateOfBirth: zod_1.z.coerce.date().optional(),
    avatarUrl: zod_1.z.string().url().max(500).optional(),
});
exports.customerLocationSchema = zod_1.z.object({
    latitude: vendor_validation_1.latitudeSchema,
    longitude: vendor_validation_1.longitudeSchema,
});
exports.addressSchema = zod_1.z.object({
    label: zod_1.z.string().trim().max(50).optional(),
    contactName: zod_1.z.string().trim().max(120).optional(),
    contactPhone: zod_1.z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
    addressLine1: zod_1.z.string().trim().min(3).max(255),
    addressLine2: zod_1.z.string().trim().max(255).optional(),
    landmark: zod_1.z.string().trim().max(255).optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    state: zod_1.z.string().trim().max(100).optional(),
    pincode: vendor_validation_1.pincodeSchema.optional(),
    latitude: vendor_validation_1.latitudeSchema.optional(),
    longitude: vendor_validation_1.longitudeSchema.optional(),
    isDefault: zod_1.z.coerce.boolean().default(false),
});
// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
exports.nearbyStoresQuery = query_validation_1.paginationQuery.extend({
    latitude: vendor_validation_1.latitudeSchema.optional(),
    longitude: vendor_validation_1.longitudeSchema.optional(),
    radius: zod_1.z.coerce.number().min(0.5).max(100).optional(),
    pincode: vendor_validation_1.pincodeSchema.optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    productId: zod_1.z.string().uuid().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    openNow: zod_1.z.coerce.boolean().default(false),
    sortBy: zod_1.z.enum(['distance', 'rating', 'name']).default('distance'),
});
exports.storeProductsQuery = query_validation_1.paginationQuery.extend({
    categoryId: zod_1.z.string().uuid().optional(),
    subCategoryId: zod_1.z.string().uuid().optional(),
    manufacturerId: zod_1.z.string().uuid().optional(),
    prescriptionRequired: zod_1.z.coerce.boolean().optional(),
    inStockOnly: zod_1.z.coerce.boolean().default(true),
    minPrice: zod_1.z.coerce.number().nonnegative().optional(),
    maxPrice: zod_1.z.coerce.number().nonnegative().optional(),
});
exports.productSearchQuery = query_validation_1.paginationQuery.extend({
    latitude: vendor_validation_1.latitudeSchema.optional(),
    longitude: vendor_validation_1.longitudeSchema.optional(),
    radius: zod_1.z.coerce.number().min(0.5).max(100).optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    manufacturerId: zod_1.z.string().uuid().optional(),
});
// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------
exports.addToCartSchema = zod_1.z.object({
    retailerProductId: zod_1.z.string().uuid(),
    quantity: zod_1.z.coerce.number().int().min(1).max(1000).default(1),
    /** Set true to discard the existing cart when switching store. */
    replaceCart: zod_1.z.coerce.boolean().default(false),
});
exports.updateCartItemSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number().int().min(0).max(1000),
});
// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
exports.checkoutSchema = zod_1.z.object({
    pickupDate: zod_1.z.coerce.date(),
    pickupStartTime: zod_1.z
        .string()
        .trim()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm'),
    paymentMode: zod_1.z.enum(['CASH', 'UPI', 'CARD', 'ONLINE']).default('CASH'),
    customerNote: zod_1.z.string().trim().max(500).optional(),
    prescriptionUrl: zod_1.z.string().url().max(500).optional(),
});
exports.customerOrderListQuery = query_validation_1.paginationQuery.extend({
    status: zod_1.z
        .enum([
        'PENDING',
        'ACCEPTED',
        'PREPARING',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED',
    ])
        .optional(),
    active: zod_1.z.coerce.boolean().optional(),
});
exports.cancelOrderSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3).max(500),
});
exports.favoriteSchema = zod_1.z
    .object({
    retailerId: zod_1.z.string().uuid().optional(),
    productId: zod_1.z.string().uuid().optional(),
})
    .refine((data) => data.retailerId || data.productId, {
    message: 'Provide a store or a product to favourite',
});
exports.reviewSchema = zod_1.z.object({
    retailerId: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid().optional(),
    rating: zod_1.z.coerce.number().int().min(1).max(5),
    comment: zod_1.z.string().trim().max(1000).optional(),
});
//# sourceMappingURL=customer.validation.js.map