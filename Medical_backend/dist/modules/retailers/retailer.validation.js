"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorProductBrowseQuery = exports.vendorBrowseQuery = exports.retailerProductListQuery = exports.retailerProductUpdateSchema = exports.retailerProductCreateSchema = exports.storeImageSchema = exports.slotStatusSchema = exports.pickupConfigSchema = exports.holidayCreateSchema = exports.businessHoursSchema = exports.temporaryClosureSchema = exports.retailerProfileSchema = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
const vendor_validation_1 = require("../vendors/vendor.validation");
const timeString = zod_1.z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm, e.g. 09:00');
exports.retailerProfileSchema = zod_1.z.object({
    storeName: zod_1.z.string().trim().min(2).max(191).optional(),
    legalName: zod_1.z.string().trim().max(191).optional(),
    ownerName: zod_1.z.string().trim().max(120).optional(),
    email: zod_1.z.string().trim().toLowerCase().email().optional(),
    phone: zod_1.z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
    alternatePhone: zod_1.z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
    gstNumber: vendor_validation_1.gstSchema.optional(),
    panNumber: vendor_validation_1.panSchema.optional(),
    drugLicenseNumber: zod_1.z.string().trim().max(60).optional(),
    drugLicenseExpiry: zod_1.z.coerce.date().optional(),
    logoUrl: zod_1.z.string().url().max(500).optional(),
    description: zod_1.z.string().trim().max(2000).optional(),
    addressLine1: zod_1.z.string().trim().max(255).optional(),
    addressLine2: zod_1.z.string().trim().max(255).optional(),
    landmark: zod_1.z.string().trim().max(255).optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    state: zod_1.z.string().trim().max(100).optional(),
    pincode: vendor_validation_1.pincodeSchema.optional(),
    latitude: vendor_validation_1.latitudeSchema.optional(),
    longitude: vendor_validation_1.longitudeSchema.optional(),
});
exports.temporaryClosureSchema = zod_1.z.object({
    isTemporarilyClosed: zod_1.z.coerce.boolean(),
    closureReason: zod_1.z.string().trim().max(255).optional(),
});
exports.businessHoursSchema = zod_1.z.object({
    hours: zod_1.z
        .array(zod_1.z
        .object({
        dayOfWeek: zod_1.z.coerce.number().int().min(0).max(6),
        isClosed: zod_1.z.coerce.boolean().default(false),
        openTime: timeString.optional(),
        closeTime: timeString.optional(),
        breakStart: timeString.optional(),
        breakEnd: timeString.optional(),
    })
        .superRefine((day, ctx) => {
        if (day.isClosed)
            return;
        if (!day.openTime || !day.closeTime) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['openTime'],
                message: 'Opening and closing time are required for an open day',
            });
            return;
        }
        if (day.openTime >= day.closeTime) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['closeTime'],
                message: 'Closing time must be after opening time',
            });
        }
    }))
        .length(7, 'Provide hours for all seven days'),
});
exports.holidayCreateSchema = zod_1.z
    .object({
    date: zod_1.z.coerce.date(),
    title: zod_1.z.string().trim().max(191).optional(),
    isFullDay: zod_1.z.coerce.boolean().default(true),
    openTime: timeString.optional(),
    closeTime: timeString.optional(),
})
    .superRefine((data, ctx) => {
    if (!data.isFullDay && (!data.openTime || !data.closeTime)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['openTime'],
            message: 'Special opening hours require both an open and a close time',
        });
    }
});
exports.pickupConfigSchema = zod_1.z.object({
    slotDurationMins: zod_1.z.coerce.number().int().min(10).max(240).optional(),
    maxOrdersPerSlot: zod_1.z.coerce.number().int().min(1).max(500).optional(),
    bufferMins: zod_1.z.coerce.number().int().min(0).max(1440).optional(),
    advanceDays: zod_1.z.coerce.number().int().min(1).max(30).optional(),
    isEnabled: zod_1.z.coerce.boolean().optional(),
});
exports.slotStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['AVAILABLE', 'DISABLED']),
});
exports.storeImageSchema = zod_1.z.object({
    caption: zod_1.z.string().trim().max(191).optional(),
    sortOrder: zod_1.z.coerce.number().int().min(0).default(0),
});
// ---------------------------------------------------------------------------
// Retailer catalog
// ---------------------------------------------------------------------------
exports.retailerProductCreateSchema = zod_1.z
    .object({
    productId: zod_1.z.string().uuid(),
    sellingPrice: zod_1.z.coerce.number().positive(),
    mrp: zod_1.z.coerce.number().positive(),
    gstRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    discountPct: zod_1.z.coerce.number().min(0).max(100).default(0),
    minStockAlert: zod_1.z.coerce.number().int().min(0).default(10),
    maxOrderQty: zod_1.z.coerce.number().int().min(1).max(1000).default(50),
    status: query_validation_1.recordStatusEnum.default('ACTIVE'),
})
    .superRefine((data, ctx) => {
    if (data.sellingPrice > data.mrp) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['sellingPrice'],
            message: 'Selling price cannot exceed MRP',
        });
    }
});
exports.retailerProductUpdateSchema = zod_1.z.object({
    sellingPrice: zod_1.z.coerce.number().positive().optional(),
    mrp: zod_1.z.coerce.number().positive().optional(),
    gstRate: zod_1.z.coerce.number().min(0).max(100).optional(),
    discountPct: zod_1.z.coerce.number().min(0).max(100).optional(),
    minStockAlert: zod_1.z.coerce.number().int().min(0).optional(),
    maxOrderQty: zod_1.z.coerce.number().int().min(1).max(1000).optional(),
    status: query_validation_1.recordStatusEnum.optional(),
});
exports.retailerProductListQuery = query_validation_1.paginationQuery.extend({
    status: query_validation_1.recordStatusEnum.optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    inStockOnly: zod_1.z.coerce.boolean().default(false),
    lowStockOnly: zod_1.z.coerce.boolean().default(false),
});
exports.vendorBrowseQuery = query_validation_1.paginationQuery.extend({
    city: zod_1.z.string().trim().max(100).optional(),
    state: zod_1.z.string().trim().max(100).optional(),
});
exports.vendorProductBrowseQuery = query_validation_1.paginationQuery.extend({
    vendorId: zod_1.z.string().uuid().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    manufacturerId: zod_1.z.string().uuid().optional(),
    inStockOnly: zod_1.z.coerce.boolean().default(true),
});
//# sourceMappingURL=retailer.validation.js.map