"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkPriceUpdateSchema = exports.vendorProductListQuery = exports.vendorProductUpdateSchema = exports.vendorProductCreateSchema = exports.documentUploadSchema = exports.documentTypeEnum = exports.vendorProfileSchema = exports.longitudeSchema = exports.latitudeSchema = exports.pincodeSchema = exports.panSchema = exports.gstSchema = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
exports.gstSchema = zod_1.z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/, 'Enter a valid 15-character GSTIN');
exports.panSchema = zod_1.z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN');
exports.pincodeSchema = zod_1.z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode');
exports.latitudeSchema = zod_1.z.coerce.number().min(-90).max(90);
exports.longitudeSchema = zod_1.z.coerce.number().min(-180).max(180);
exports.vendorProfileSchema = zod_1.z.object({
    businessName: zod_1.z.string().trim().min(2).max(191).optional(),
    legalName: zod_1.z.string().trim().max(191).optional(),
    contactPerson: zod_1.z.string().trim().max(120).optional(),
    email: zod_1.z.string().trim().toLowerCase().email().optional(),
    phone: zod_1.z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
    alternatePhone: zod_1.z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
    gstNumber: exports.gstSchema.optional(),
    panNumber: exports.panSchema.optional(),
    drugLicenseNumber: zod_1.z.string().trim().max(60).optional(),
    drugLicenseExpiry: zod_1.z.coerce.date().optional(),
    logoUrl: zod_1.z.string().url().max(500).optional(),
    description: zod_1.z.string().trim().max(2000).optional(),
    addressLine1: zod_1.z.string().trim().max(255).optional(),
    addressLine2: zod_1.z.string().trim().max(255).optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    state: zod_1.z.string().trim().max(100).optional(),
    pincode: exports.pincodeSchema.optional(),
    latitude: exports.latitudeSchema.optional(),
    longitude: exports.longitudeSchema.optional(),
    minOrderValue: zod_1.z.coerce.number().nonnegative().optional(),
});
exports.documentTypeEnum = zod_1.z.enum([
    'DRUG_LICENSE',
    'GST_CERTIFICATE',
    'PAN_CARD',
    'AADHAAR',
    'TRADE_LICENSE',
    'SHOP_ESTABLISHMENT',
    'BANK_PROOF',
    'OWNER_PHOTO',
    'STORE_PHOTO',
    'OTHER',
]);
exports.documentUploadSchema = zod_1.z.object({
    type: exports.documentTypeEnum,
    documentNo: zod_1.z.string().trim().max(100).optional(),
    issueDate: zod_1.z.coerce.date().optional(),
    expiryDate: zod_1.z.coerce.date().optional(),
});
// ---------------------------------------------------------------------------
// Vendor catalog
// ---------------------------------------------------------------------------
exports.vendorProductCreateSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid(),
    purchasePrice: zod_1.z.coerce.number().nonnegative().default(0),
    sellingPrice: zod_1.z.coerce.number().positive('Selling price must be greater than zero'),
    mrp: zod_1.z.coerce.number().positive(),
    gstRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    discountPct: zod_1.z.coerce.number().min(0).max(100).default(0),
    minOrderQty: zod_1.z.coerce.number().int().min(1).default(1),
    packQty: zod_1.z.coerce.number().int().min(1).default(1),
    minStockAlert: zod_1.z.coerce.number().int().min(0).default(10),
    status: query_validation_1.recordStatusEnum.default('ACTIVE'),
}).superRefine((data, ctx) => {
    if (data.sellingPrice > data.mrp) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['sellingPrice'],
            message: 'Selling price cannot exceed MRP',
        });
    }
});
exports.vendorProductUpdateSchema = zod_1.z.object({
    purchasePrice: zod_1.z.coerce.number().nonnegative().optional(),
    sellingPrice: zod_1.z.coerce.number().positive().optional(),
    mrp: zod_1.z.coerce.number().positive().optional(),
    gstRate: zod_1.z.coerce.number().min(0).max(100).optional(),
    discountPct: zod_1.z.coerce.number().min(0).max(100).optional(),
    minOrderQty: zod_1.z.coerce.number().int().min(1).optional(),
    packQty: zod_1.z.coerce.number().int().min(1).optional(),
    minStockAlert: zod_1.z.coerce.number().int().min(0).optional(),
    status: query_validation_1.recordStatusEnum.optional(),
});
exports.vendorProductListQuery = query_validation_1.paginationQuery.extend({
    status: query_validation_1.recordStatusEnum.optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    manufacturerId: zod_1.z.string().uuid().optional(),
    inStockOnly: zod_1.z.coerce.boolean().default(false),
});
exports.bulkPriceUpdateSchema = zod_1.z.object({
    items: zod_1.z
        .array(zod_1.z.object({
        vendorProductId: zod_1.z.string().uuid(),
        sellingPrice: zod_1.z.coerce.number().positive().optional(),
        purchasePrice: zod_1.z.coerce.number().nonnegative().optional(),
        discountPct: zod_1.z.coerce.number().min(0).max(100).optional(),
    }))
        .min(1)
        .max(200),
});
//# sourceMappingURL=vendor.validation.js.map