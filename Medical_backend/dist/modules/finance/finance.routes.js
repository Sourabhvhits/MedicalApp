"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFinanceRouter = createFinanceRouter;
const express_1 = require("express");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const validate_1 = require("../../middleware/validate");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../lib/audit");
const constants_1 = require("../../config/constants");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const service = __importStar(require("./finance.service"));
const finance_validation_1 = require("./finance.validation");
/**
 * Finance endpoints are identical for vendors and retailers; each mounts this
 * router with its own scope resolver.
 */
function createFinanceRouter(resolveScope, tag) {
    const router = (0, express_1.Router)();
    router.get('/summary', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_VIEW), (0, validate_1.validate)({ query: finance_validation_1.financePeriodQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.summary(resolveScope(req), req.query))));
    router.get('/transactions', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_VIEW), (0, validate_1.validate)({ query: finance_validation_1.financeTxnQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const result = await service.listTransactions(resolveScope(req), req.query);
        return res.json({
            success: true,
            message: 'Success',
            data: result.items,
            meta: result.meta,
            totals: result.totals,
        });
    }));
    router.get('/gst', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_VIEW), (0, validate_1.validate)({ query: finance_validation_1.financePeriodQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.gstReport(resolveScope(req), req.query))));
    // -------------------------------------------------------------------------
    // Expenses
    // -------------------------------------------------------------------------
    router.get('/expenses', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_VIEW), (0, validate_1.validate)({ query: finance_validation_1.expenseListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const result = await service.listExpenses(resolveScope(req), req.query);
        return res.json({
            success: true,
            message: 'Success',
            data: result.items,
            meta: result.meta,
            byCategory: result.byCategory,
        });
    }));
    router.post('/expenses', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_MANAGE), (0, validate_1.validate)({ body: finance_validation_1.expenseCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const expense = await service.createExpense(resolveScope(req), req.body, req.user.id);
        await (0, audit_1.auditFromRequest)(req, {
            action: 'expense.create',
            module: constants_1.AUDIT_MODULES.FINANCE,
            recordId: expense.id,
            newValue: expense,
        });
        return (0, response_1.created)(res, expense, 'Expense recorded');
    }));
    router.put('/expenses/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: finance_validation_1.expenseUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const expense = await service.updateExpense(resolveScope(req), req.params.id, req.body);
        await (0, audit_1.auditFromRequest)(req, {
            action: 'expense.update',
            module: constants_1.AUDIT_MODULES.FINANCE,
            recordId: expense.id,
            newValue: expense,
        });
        return (0, response_1.ok)(res, expense, 'Expense updated');
    }));
    router.delete('/expenses/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        await service.deleteExpense(resolveScope(req), req.params.id);
        await (0, audit_1.auditFromRequest)(req, {
            action: 'expense.delete',
            module: constants_1.AUDIT_MODULES.FINANCE,
            recordId: req.params.id,
        });
        return (0, response_1.noContent)(res, 'Expense deleted');
    }));
    // -------------------------------------------------------------------------
    // Invoices & payments
    // -------------------------------------------------------------------------
    router.get('/invoices', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_VIEW), (0, validate_1.validate)({ query: finance_validation_1.invoiceListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { items, meta } = await service.listInvoices(resolveScope(req), req.query);
        return (0, response_1.paginated)(res, items, meta);
    }));
    router.get('/invoices/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getInvoice(resolveScope(req), req.params.id))));
    router.get('/payments', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_VIEW), (0, validate_1.validate)({ query: finance_validation_1.paymentListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const result = await service.listPayments(resolveScope(req), req.query);
        return res.json({
            success: true,
            message: 'Success',
            data: result.items,
            meta: result.meta,
            totals: result.totals,
        });
    }));
    router.post('/payments', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_MANAGE), (0, validate_1.validate)({ body: finance_validation_1.manualPaymentSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const payment = await service.recordPayment(resolveScope(req), req.body);
        await (0, audit_1.auditFromRequest)(req, {
            action: 'payment.record',
            module: constants_1.AUDIT_MODULES.FINANCE,
            recordId: payment.id,
            newValue: { amount: payment.amount, direction: payment.direction },
        });
        return (0, response_1.created)(res, payment, 'Payment recorded');
    }));
    const base = tag === 'Vendor' ? '/vendor/finance' : '/retailer/finance';
    (0, openapi_1.doc)('get', `${base}/summary`, { tags: [tag], summary: 'Finance summary with profit & loss', query: finance_validation_1.financePeriodQuery });
    (0, openapi_1.doc)('get', `${base}/transactions`, { tags: [tag], summary: 'Finance ledger', query: finance_validation_1.financeTxnQuery, paginated: true });
    (0, openapi_1.doc)('get', `${base}/gst`, { tags: [tag], summary: 'GST summary (outward, inward, net payable)', query: finance_validation_1.financePeriodQuery });
    (0, openapi_1.doc)('get', `${base}/expenses`, { tags: [tag], summary: 'List expenses with category totals', query: finance_validation_1.expenseListQuery, paginated: true });
    (0, openapi_1.doc)('post', `${base}/expenses`, { tags: [tag], summary: 'Record an expense', body: finance_validation_1.expenseCreateSchema });
    (0, openapi_1.doc)('put', `${base}/expenses/{id}`, { tags: [tag], summary: 'Update an expense', params: query_validation_1.idParam, body: finance_validation_1.expenseUpdateSchema, status: 200 });
    (0, openapi_1.doc)('delete', `${base}/expenses/{id}`, { tags: [tag], summary: 'Delete an expense', params: query_validation_1.idParam });
    (0, openapi_1.doc)('get', `${base}/invoices`, { tags: [tag], summary: 'List invoices', query: finance_validation_1.invoiceListQuery, paginated: true });
    (0, openapi_1.doc)('get', `${base}/invoices/{id}`, { tags: [tag], summary: 'Invoice detail for printing', params: query_validation_1.idParam });
    (0, openapi_1.doc)('get', `${base}/payments`, { tags: [tag], summary: 'List payments in and out', query: finance_validation_1.paymentListQuery, paginated: true });
    (0, openapi_1.doc)('post', `${base}/payments`, { tags: [tag], summary: 'Record a standalone payment', body: finance_validation_1.manualPaymentSchema });
    return router;
}
//# sourceMappingURL=finance.routes.js.map