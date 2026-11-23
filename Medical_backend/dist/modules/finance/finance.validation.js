"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualPaymentSchema = exports.paymentListQuery = exports.invoiceListQuery = exports.expenseUpdateSchema = exports.expenseCreateSchema = exports.expenseListQuery = exports.financeTxnQuery = exports.financePeriodQuery = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
exports.financePeriodQuery = query_validation_1.dateRangeQuery;
exports.financeTxnQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    type: zod_1.z
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
exports.expenseListQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    category: zod_1.z.string().trim().max(80).optional(),
});
exports.expenseCreateSchema = zod_1.z.object({
    category: zod_1.z.string().trim().min(2).max(80),
    title: zod_1.z.string().trim().min(2).max(191),
    amount: zod_1.z.coerce.number().positive(),
    taxAmount: zod_1.z.coerce.number().nonnegative().default(0),
    expenseDate: zod_1.z.coerce.date(),
    paymentMode: zod_1.z
        .enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE'])
        .default('CASH'),
    notes: zod_1.z.string().trim().max(500).optional(),
    attachmentUrl: zod_1.z.string().url().max(500).optional(),
});
exports.expenseUpdateSchema = exports.expenseCreateSchema.partial();
exports.invoiceListQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    type: zod_1.z.enum(['SALES', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN']).optional(),
    status: zod_1.z.enum(['PENDING', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']).optional(),
});
exports.paymentListQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    direction: zod_1.z.enum(['IN', 'OUT']).optional(),
    mode: zod_1.z
        .enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE'])
        .optional(),
});
exports.manualPaymentSchema = zod_1.z.object({
    direction: zod_1.z.enum(['IN', 'OUT']),
    amount: zod_1.z.coerce.number().positive(),
    mode: zod_1.z
        .enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT', 'ONLINE'])
        .default('CASH'),
    partyName: zod_1.z.string().trim().max(191).optional(),
    referenceNo: zod_1.z.string().trim().max(120).optional(),
    paidAt: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
});
//# sourceMappingURL=finance.validation.js.map