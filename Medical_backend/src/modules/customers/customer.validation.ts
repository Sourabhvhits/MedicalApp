import { z } from 'zod';
import { paginationQuery } from '../../common/query.validation';
import { latitudeSchema, longitudeSchema, pincodeSchema } from '../vendors/vendor.validation';

export const customerProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  dateOfBirth: z.coerce.date().optional(),
  avatarUrl: z.string().url().max(500).optional(),
});

export const customerLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const addressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
  addressLine1: z.string().trim().min(3).max(255),
  addressLine2: z.string().trim().max(255).optional(),
  landmark: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: pincodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  isDefault: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export const nearbyStoresQuery = paginationQuery.extend({
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  radius: z.coerce.number().min(0.5).max(100).optional(),
  pincode: pincodeSchema.optional(),
  city: z.string().trim().max(100).optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  openNow: z.coerce.boolean().default(false),
  sortBy: z.enum(['distance', 'rating', 'name']).default('distance'),
});

export const storeProductsQuery = paginationQuery.extend({
  categoryId: z.string().uuid().optional(),
  subCategoryId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  prescriptionRequired: z.coerce.boolean().optional(),
  inStockOnly: z.coerce.boolean().default(true),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
});

export const productSearchQuery = paginationQuery.extend({
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  radius: z.coerce.number().min(0.5).max(100).optional(),
  categoryId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const addToCartSchema = z.object({
  retailerProductId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  /** Set true to discard the existing cart when switching store. */
  replaceCart: z.coerce.boolean().default(false),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(1000),
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export const checkoutSchema = z
  .object({
    fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
    pickupDate: z.coerce.date().optional(),
    pickupStartTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm')
      .optional(),
    deliveryAddressId: z.string().uuid().optional(),
    paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'ONLINE', 'COD']).default('CASH'),
    customerNote: z.string().trim().max(500).optional(),
    prescriptionUrl: z.string().url().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === 'PICKUP') {
      if (!data.pickupDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pickupDate'], message: 'Choose a pickup date' });
      }
      if (!data.pickupStartTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pickupStartTime'], message: 'Choose a pickup time' });
      }
      if (data.paymentMode === 'COD') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentMode'],
          message: 'Cash on delivery is only available for delivery orders',
        });
      }
    } else if (!data.deliveryAddressId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryAddressId'], message: 'Choose a delivery address' });
    }
  });

export const customerOrderListQuery = paginationQuery.extend({
  status: z
    .enum([
      'PENDING',
      'ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
    ])
    .optional(),
  active: z.coerce.boolean().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const reorderSchema = z.object({
  replaceCart: z.coerce.boolean().default(false),
});

export const favoriteSchema = z
  .object({
    retailerId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
  })
  .refine((data) => data.retailerId || data.productId, {
    message: 'Provide a store or a product to favourite',
  });

export const reviewSchema = z.object({
  retailerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
