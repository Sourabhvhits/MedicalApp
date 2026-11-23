"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitListQuery = exports.unitUpdateSchema = exports.unitCreateSchema = exports.manufacturerListQuery = exports.manufacturerUpdateSchema = exports.manufacturerCreateSchema = exports.subCategoryListQuery = exports.subCategoryUpdateSchema = exports.subCategoryCreateSchema = exports.categoryListQuery = exports.categoryUpdateSchema = exports.categoryCreateSchema = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
exports.categoryCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(120),
    description: zod_1.z.string().trim().max(500).optional(),
    imageUrl: zod_1.z.string().url().max(500).optional(),
    sortOrder: zod_1.z.coerce.number().int().min(0).default(0),
    status: query_validation_1.recordStatusEnum.default('ACTIVE'),
});
exports.categoryUpdateSchema = exports.categoryCreateSchema.partial();
exports.categoryListQuery = query_validation_1.paginationQuery.extend({
    status: query_validation_1.recordStatusEnum.optional(),
    withSubCategories: zod_1.z.coerce.boolean().default(false),
});
// ---------------------------------------------------------------------------
// Sub categories
// ---------------------------------------------------------------------------
exports.subCategoryCreateSchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(2).max(120),
    description: zod_1.z.string().trim().max(500).optional(),
    imageUrl: zod_1.z.string().url().max(500).optional(),
    sortOrder: zod_1.z.coerce.number().int().min(0).default(0),
    status: query_validation_1.recordStatusEnum.default('ACTIVE'),
});
exports.subCategoryUpdateSchema = exports.subCategoryCreateSchema.partial();
exports.subCategoryListQuery = query_validation_1.paginationQuery.extend({
    status: query_validation_1.recordStatusEnum.optional(),
    categoryId: zod_1.z.string().uuid().optional(),
});
// ---------------------------------------------------------------------------
// Manufacturers / companies
// ---------------------------------------------------------------------------
exports.manufacturerCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(191),
    code: zod_1.z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/, 'Use uppercase letters, numbers, - or _'),
    contactPerson: zod_1.z.string().trim().max(120).optional(),
    phone: zod_1.z.string().trim().max(20).optional(),
    email: zod_1.z.string().trim().toLowerCase().email().optional(),
    gstNumber: zod_1.z.string().trim().max(20).optional(),
    licenseNumber: zod_1.z.string().trim().max(60).optional(),
    addressLine1: zod_1.z.string().trim().max(255).optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    state: zod_1.z.string().trim().max(100).optional(),
    pincode: zod_1.z.string().trim().max(12).optional(),
    logoUrl: zod_1.z.string().url().max(500).optional(),
    status: query_validation_1.recordStatusEnum.default('ACTIVE'),
});
exports.manufacturerUpdateSchema = exports.manufacturerCreateSchema.partial();
exports.manufacturerListQuery = query_validation_1.paginationQuery.extend({
    status: query_validation_1.recordStatusEnum.optional(),
});
// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
exports.unitCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(60),
    code: zod_1.z.string().trim().min(1).max(20).regex(/^[A-Z0-9_-]+$/, 'Use uppercase letters, numbers, - or _'),
    status: query_validation_1.recordStatusEnum.default('ACTIVE'),
});
exports.unitUpdateSchema = exports.unitCreateSchema.partial();
exports.unitListQuery = query_validation_1.paginationQuery.extend({
    status: query_validation_1.recordStatusEnum.optional(),
});
//# sourceMappingURL=masters.validation.js.map