import { z } from 'zod';
import { paginationQuery, recordStatusEnum } from '../../common/query.validation';

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(191),
  genericName: z.string().trim().max(191).optional(),
  brandName: z.string().trim().max(191).optional(),
  manufacturerId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  subCategoryId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  medicineType: z.string().trim().max(80).optional(),
  composition: z.string().trim().max(2000).optional(),
  strength: z.string().trim().max(80).optional(),
  dosageForm: z.string().trim().max(80).optional(),
  packSize: z.string().trim().max(80).optional(),
  mrp: z.coerce.number().nonnegative().max(10_000_000),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  hsnCode: z.string().trim().max(20).optional(),
  prescriptionRequired: z.coerce.boolean().default(false),
  imageUrl: z.string().url().max(500).optional(),
  description: z.string().trim().max(4000).optional(),
  status: recordStatusEnum.default('ACTIVE'),
  sku: z.string().trim().min(3).max(40).optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productListQuery = paginationQuery.extend({
  status: recordStatusEnum.optional(),
  categoryId: z.string().uuid().optional(),
  subCategoryId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  prescriptionRequired: z.coerce.boolean().optional(),
  minMrp: z.coerce.number().nonnegative().optional(),
  maxMrp: z.coerce.number().nonnegative().optional(),
});

export const productRecallSchema = z.object({
  isRecalled: z.coerce.boolean(),
  recallReason: z.string().trim().max(500).optional(),
});

export const productStatusSchema = z.object({
  status: recordStatusEnum,
  reason: z.string().trim().max(500).optional(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductListQuery = z.infer<typeof productListQuery>;
