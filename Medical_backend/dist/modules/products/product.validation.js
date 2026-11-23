"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productStatusSchema = exports.productRecallSchema = exports.productListQuery = exports.productUpdateSchema = exports.productCreateSchema = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
exports.productCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(191),
    genericName: zod_1.z.string().trim().max(191).optional(),
    brandName: zod_1.z.string().trim().max(191).optional(),
    manufacturerId: zod_1.z.string().uuid().optional(),
    categoryId: zod_1.z.string().uuid(),
    subCategoryId: zod_1.z.string().uuid().optional(),
    unitId: zod_1.z.string().uuid().optional(),
    medicineType: zod_1.z.string().trim().max(80).optional(),
    composition: zod_1.z.string().trim().max(2000).optional(),
    strength: zod_1.z.string().trim().max(80).optional(),
    dosageForm: zod_1.z.string().trim().max(80).optional(),
    packSize: zod_1.z.string().trim().max(80).optional(),
    mrp: zod_1.z.coerce.number().nonnegative().max(10_000_000),
    gstRate: zod_1.z.coerce.number().min(0).max(100).default(0),
    hsnCode: zod_1.z.string().trim().max(20).optional(),
    prescriptionRequired: zod_1.z.coerce.boolean().default(false),
    imageUrl: zod_1.z.string().url().max(500).optional(),
    description: zod_1.z.string().trim().max(4000).optional(),
    status: query_validation_1.recordStatusEnum.default('ACTIVE'),
    sku: zod_1.z.string().trim().min(3).max(40).optional(),
});
exports.productUpdateSchema = exports.productCreateSchema.partial();
exports.productListQuery = query_validation_1.paginationQuery.extend({
    status: query_validation_1.recordStatusEnum.optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    subCategoryId: zod_1.z.string().uuid().optional(),
    manufacturerId: zod_1.z.string().uuid().optional(),
    prescriptionRequired: zod_1.z.coerce.boolean().optional(),
    minMrp: zod_1.z.coerce.number().nonnegative().optional(),
    maxMrp: zod_1.z.coerce.number().nonnegative().optional(),
});
exports.productRecallSchema = zod_1.z.object({
    isRecalled: zod_1.z.coerce.boolean(),
    recallReason: zod_1.z.string().trim().max(500).optional(),
});
exports.productStatusSchema = zod_1.z.object({
    status: query_validation_1.recordStatusEnum,
    reason: zod_1.z.string().trim().max(500).optional(),
});
//# sourceMappingURL=product.validation.js.map