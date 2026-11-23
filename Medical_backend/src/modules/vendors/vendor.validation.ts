import { z } from 'zod';
import { paginationQuery, recordStatusEnum } from '../../common/query.validation';

export const gstSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/, 'Enter a valid 15-character GSTIN');

export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN');

export const pincodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode');

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);

export const vendorProfileSchema = z.object({
  businessName: z.string().trim().min(2).max(191).optional(),
  legalName: z.string().trim().max(191).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
  alternatePhone: z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
  gstNumber: gstSchema.optional(),
  panNumber: panSchema.optional(),
  drugLicenseNumber: z.string().trim().max(60).optional(),
  drugLicenseExpiry: z.coerce.date().optional(),
  logoUrl: z.string().url().max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  addressLine1: z.string().trim().max(255).optional(),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: pincodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  minOrderValue: z.coerce.number().nonnegative().optional(),
});

/**
 * Document types used to be a fixed Prisma enum; now admin can define new
 * ones at runtime (TASKS.md follow-up to #20a) via `KycRequirement`, so this
 * only validates shape (matches the `documentType` key format
 * `toDocumentTypeKey()` in `admin.service.ts` produces), not a fixed set.
 */
export const documentTypeEnum = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Z0-9_]+$/, 'Use uppercase letters, numbers and underscores only');

export const documentUploadSchema = z.object({
  type: documentTypeEnum,
  documentNo: z.string().trim().max(100).optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
});

/** Admin metadata edit (TASKS.md #20) — every field optional, only what's sent gets changed. */
export const documentUpdateSchema = z.object({
  type: documentTypeEnum.optional(),
  documentNo: z.string().trim().max(100).optional(),
  issueDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Vendor catalog
// ---------------------------------------------------------------------------

export const vendorProductCreateSchema = z.object({
  productId: z.string().uuid(),
  purchasePrice: z.coerce.number().nonnegative().default(0),
  sellingPrice: z.coerce.number().positive('Selling price must be greater than zero'),
  mrp: z.coerce.number().positive(),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  minOrderQty: z.coerce.number().int().min(1).default(1),
  packQty: z.coerce.number().int().min(1).default(1),
  minStockAlert: z.coerce.number().int().min(0).default(10),
  status: recordStatusEnum.default('ACTIVE'),
}).superRefine((data, ctx) => {
  if (data.sellingPrice > data.mrp) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sellingPrice'],
      message: 'Selling price cannot exceed MRP',
    });
  }
});

/** Same fields as `vendorProductCreateSchema` minus `productId` — a CSV
 * import row identifies the product by SKU instead, resolved separately. */
export const vendorCatalogImportRowSchema = z
  .object({
    purchasePrice: z.coerce.number().nonnegative().default(0),
    sellingPrice: z.coerce.number().positive('Selling price must be greater than zero'),
    mrp: z.coerce.number().positive(),
    gstRate: z.coerce.number().min(0).max(100).default(0),
    discountPct: z.coerce.number().min(0).max(100).default(0),
    minOrderQty: z.coerce.number().int().min(1).default(1),
    packQty: z.coerce.number().int().min(1).default(1),
    minStockAlert: z.coerce.number().int().min(0).default(10),
    status: recordStatusEnum.default('ACTIVE'),
  })
  .superRefine((data, ctx) => {
    if (data.sellingPrice > data.mrp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sellingPrice'],
        message: 'Selling price cannot exceed MRP',
      });
    }
  });

export const vendorProductUpdateSchema = z.object({
  purchasePrice: z.coerce.number().nonnegative().optional(),
  sellingPrice: z.coerce.number().positive().optional(),
  mrp: z.coerce.number().positive().optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  minOrderQty: z.coerce.number().int().min(1).optional(),
  packQty: z.coerce.number().int().min(1).optional(),
  minStockAlert: z.coerce.number().int().min(0).optional(),
  status: recordStatusEnum.optional(),
});

export const vendorProductListQuery = paginationQuery.extend({
  status: recordStatusEnum.optional(),
  categoryId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  inStockOnly: z.coerce.boolean().default(false),
});

export const bulkPriceUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        vendorProductId: z.string().uuid(),
        sellingPrice: z.coerce.number().positive().optional(),
        purchasePrice: z.coerce.number().nonnegative().optional(),
        discountPct: z.coerce.number().min(0).max(100).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const retailerTermsSchema = z.object({
  creditLimit: z.coerce.number().nonnegative().default(0),
  paymentTermsDays: z.coerce.number().int().min(0).max(180).default(0),
});
