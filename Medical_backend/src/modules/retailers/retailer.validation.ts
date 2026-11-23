import { z } from 'zod';
import { paginationQuery, recordStatusEnum } from '../../common/query.validation';
import { gstSchema, latitudeSchema, longitudeSchema, panSchema, pincodeSchema } from '../vendors/vendor.validation';

const timeString = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm, e.g. 09:00');

export const retailerProfileSchema = z.object({
  storeName: z.string().trim().min(2).max(191).optional(),
  legalName: z.string().trim().max(191).optional(),
  ownerName: z.string().trim().max(120).optional(),
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
  landmark: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: pincodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  deliveryEnabled: z.coerce.boolean().optional(),
  deliveryChargeAmount: z.coerce.number().nonnegative().optional(),
  /** Empty string clears the threshold (no free-delivery cutoff); omit the key to leave it unchanged. */
  deliveryFreeAboveAmount: z.union([z.coerce.number().nonnegative(), z.literal('')]).optional(),
});

export const temporaryClosureSchema = z.object({
  isTemporarilyClosed: z.coerce.boolean(),
  closureReason: z.string().trim().max(255).optional(),
});

export const businessHoursSchema = z.object({
  hours: z
    .array(
      z
        .object({
          dayOfWeek: z.coerce.number().int().min(0).max(6),
          isClosed: z.coerce.boolean().default(false),
          openTime: timeString.optional(),
          closeTime: timeString.optional(),
          breakStart: timeString.optional(),
          breakEnd: timeString.optional(),
        })
        .superRefine((day, ctx) => {
          if (day.isClosed) return;
          if (!day.openTime || !day.closeTime) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['openTime'],
              message: 'Opening and closing time are required for an open day',
            });
            return;
          }
          if (day.openTime >= day.closeTime) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['closeTime'],
              message: 'Closing time must be after opening time',
            });
          }
        }),
    )
    .length(7, 'Provide hours for all seven days'),
});

export const holidayCreateSchema = z
  .object({
    date: z.coerce.date(),
    title: z.string().trim().max(191).optional(),
    isFullDay: z.coerce.boolean().default(true),
    openTime: timeString.optional(),
    closeTime: timeString.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isFullDay && (!data.openTime || !data.closeTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['openTime'],
        message: 'Special opening hours require both an open and a close time',
      });
    }
  });

export const pickupConfigSchema = z.object({
  slotDurationMins: z.coerce.number().int().min(10).max(240).optional(),
  maxOrdersPerSlot: z.coerce.number().int().min(1).max(500).optional(),
  bufferMins: z.coerce.number().int().min(0).max(1440).optional(),
  advanceDays: z.coerce.number().int().min(1).max(30).optional(),
  isEnabled: z.coerce.boolean().optional(),
});

export const slotStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'DISABLED']),
});

export const storeImageSchema = z.object({
  caption: z.string().trim().max(191).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Retailer catalog
// ---------------------------------------------------------------------------

export const retailerProductCreateSchema = z
  .object({
    productId: z.string().uuid(),
    sellingPrice: z.coerce.number().positive(),
    mrp: z.coerce.number().positive(),
    gstRate: z.coerce.number().min(0).max(100).default(0),
    discountPct: z.coerce.number().min(0).max(100).default(0),
    minStockAlert: z.coerce.number().int().min(0).default(10),
    maxOrderQty: z.coerce.number().int().min(1).max(1000).default(50),
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

/** Same fields as `retailerProductCreateSchema` minus `productId` — a CSV
 * import row identifies the product by SKU instead, resolved separately. */
export const retailerCatalogImportRowSchema = z
  .object({
    sellingPrice: z.coerce.number().positive(),
    mrp: z.coerce.number().positive(),
    gstRate: z.coerce.number().min(0).max(100).default(0),
    discountPct: z.coerce.number().min(0).max(100).default(0),
    minStockAlert: z.coerce.number().int().min(0).default(10),
    maxOrderQty: z.coerce.number().int().min(1).max(1000).default(50),
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

export const retailerProductUpdateSchema = z.object({
  sellingPrice: z.coerce.number().positive().optional(),
  mrp: z.coerce.number().positive().optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  minStockAlert: z.coerce.number().int().min(0).optional(),
  maxOrderQty: z.coerce.number().int().min(1).max(1000).optional(),
  status: recordStatusEnum.optional(),
});

export const retailerProductListQuery = paginationQuery.extend({
  status: recordStatusEnum.optional(),
  categoryId: z.string().uuid().optional(),
  inStockOnly: z.coerce.boolean().default(false),
  lowStockOnly: z.coerce.boolean().default(false),
});

export const vendorBrowseQuery = paginationQuery.extend({
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
});

export const vendorProductBrowseQuery = paginationQuery.extend({
  vendorId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  inStockOnly: z.coerce.boolean().default(true),
});
