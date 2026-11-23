import { z } from 'zod';
import { paginationQuery, recordStatusEnum } from '../../common/query.validation';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: recordStatusEnum.default('ACTIVE'),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const categoryListQuery = paginationQuery.extend({
  status: recordStatusEnum.optional(),
  withSubCategories: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Sub categories
// ---------------------------------------------------------------------------

export const subCategoryCreateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: recordStatusEnum.default('ACTIVE'),
});

export const subCategoryUpdateSchema = subCategoryCreateSchema.partial();

export const subCategoryListQuery = paginationQuery.extend({
  status: recordStatusEnum.optional(),
  categoryId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Manufacturers / companies
// ---------------------------------------------------------------------------

export const manufacturerCreateSchema = z.object({
  name: z.string().trim().min(2).max(191),
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/, 'Use uppercase letters, numbers, - or _'),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  gstNumber: z.string().trim().max(20).optional(),
  licenseNumber: z.string().trim().max(60).optional(),
  addressLine1: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(12).optional(),
  logoUrl: z.string().url().max(500).optional(),
  status: recordStatusEnum.default('ACTIVE'),
});

export const manufacturerUpdateSchema = manufacturerCreateSchema.partial();

export const manufacturerListQuery = paginationQuery.extend({
  status: recordStatusEnum.optional(),
});

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export const unitCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  code: z.string().trim().min(1).max(20).regex(/^[A-Z0-9_-]+$/, 'Use uppercase letters, numbers, - or _'),
  status: recordStatusEnum.default('ACTIVE'),
});

export const unitUpdateSchema = unitCreateSchema.partial();

export const unitListQuery = paginationQuery.extend({
  status: recordStatusEnum.optional(),
});

// ---------------------------------------------------------------------------
// Drug interactions (TASKS.md Priority-1 addition A)
// ---------------------------------------------------------------------------

export const drugInteractionCreateSchema = z.object({
  compositionA: z.string().trim().min(2).max(191),
  compositionB: z.string().trim().min(2).max(191),
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE']).default('MODERATE'),
  description: z.string().trim().min(3).max(500),
});

export const drugInteractionUpdateSchema = drugInteractionCreateSchema.partial();

export const drugInteractionListQuery = paginationQuery.extend({
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE']).optional(),
});
