import { z } from 'zod';
import { dateRangeQuery, paginationQuery } from '../../common/query.validation';

export const financePeriodQuery = dateRangeQuery;

export const financeTxnQuery = paginationQuery.merge(dateRangeQuery).extend({
  type: z
    .enum([
      'SALE',
      'PURCHASE',
      'SALE_RETURN',
      'PURCHASE_RETURN',
      'PAYMENT_IN',
      'PAYMENT_OUT',
      'EXPENSE',
      'ADJUSTMENT',
    ])
    .optional(),
});

export const expenseListQuery = paginationQuery.merge(dateRangeQuery).extend({
  category: z.string().trim().max(80).optional(),
  status: z.enum(['PENDING', 'PAID']).optional(),
});

export const expenseCreateSchema = z
  .object({
    category: z.string().trim().min(2).max(80),
    title: z.string().trim().min(2).max(191),
    amount: z.coerce.number().positive(),
    taxAmount: z.coerce.number().nonnegative().default(0),
    expenseDate: z.coerce.date(),
    paymentMode: z
      .enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE'])
      .default('CASH'),
    notes: z.string().trim().max(500).optional(),
    attachmentUrl: z.string().url().max(500).optional(),
    isRecurring: z.coerce.boolean().default(false),
    recurrenceInterval: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurrenceInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceInterval'],
        message: 'Choose how often this expense repeats',
      });
    }
  });

export const expenseUpdateSchema = z
  .object({
    category: z.string().trim().min(2).max(80).optional(),
    title: z.string().trim().min(2).max(191).optional(),
    amount: z.coerce.number().positive().optional(),
    taxAmount: z.coerce.number().nonnegative().optional(),
    expenseDate: z.coerce.date().optional(),
    paymentMode: z
      .enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE'])
      .optional(),
    notes: z.string().trim().max(500).optional(),
    attachmentUrl: z.string().url().max(500).optional(),
    isRecurring: z.coerce.boolean().optional(),
    recurrenceInterval: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurrenceInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceInterval'],
        message: 'Choose how often this expense repeats',
      });
    }
  });

export const invoiceListQuery = paginationQuery.merge(dateRangeQuery).extend({
  type: z.enum(['SALES', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN']).optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']).optional(),
});

export const paymentListQuery = paginationQuery.merge(dateRangeQuery).extend({
  direction: z.enum(['IN', 'OUT']).optional(),
  mode: z
    .enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE'])
    .optional(),
});

export const manualPaymentSchema = z.object({
  direction: z.enum(['IN', 'OUT']),
  amount: z.coerce.number().positive(),
  mode: z
    .enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE'])
    .default('CASH'),
  partyName: z.string().trim().max(191).optional(),
  referenceNo: z.string().trim().max(120).optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});
