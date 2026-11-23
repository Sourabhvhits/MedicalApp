import { z } from 'zod';

export const posSaleSchema = z.object({
  customerName: z.string().trim().max(191).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER']).default('CASH'),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1, 'Add at least one item to the sale'),
});
