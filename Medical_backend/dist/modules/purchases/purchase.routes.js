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
exports.vendorOrderRouter = exports.retailerPurchaseRouter = void 0;
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
const service = __importStar(require("./purchase.service"));
const purchase_validation_1 = require("./purchase.validation");
/**
 * Retailer-facing purchase endpoints. Mounted at /retailer/purchases.
 */
exports.retailerPurchaseRouter = (0, express_1.Router)();
exports.retailerPurchaseRouter.get('/', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_VIEW), (0, validate_1.validate)({ query: purchase_validation_1.purchaseOrderListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listPurchaseOrders({ retailerId: (0, rbac_1.retailerScope)(req) }, req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
exports.retailerPurchaseRouter.get('/returns', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_VIEW), (0, validate_1.validate)({ query: purchase_validation_1.purchaseOrderListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listPurchaseReturns({ retailerId: (0, rbac_1.retailerScope)(req) }, req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
exports.retailerPurchaseRouter.post('/returns', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_CREATE), (0, validate_1.validate)({ body: purchase_validation_1.purchaseReturnSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const record = await service.createPurchaseReturn((0, rbac_1.retailerScope)(req), req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.return',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: record.id,
        newValue: record,
    });
    return (0, response_1.created)(res, record, 'Purchase return recorded');
}));
exports.retailerPurchaseRouter.get('/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getPurchaseOrder(req.params.id, { retailerId: (0, rbac_1.retailerScope)(req) }))));
exports.retailerPurchaseRouter.post('/', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_CREATE), (0, validate_1.validate)({ body: purchase_validation_1.createPurchaseOrderSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.createPurchaseOrder((0, rbac_1.retailerScope)(req), req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.create',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: order.id,
        newValue: { poNumber: order.poNumber, total: order.totalAmount },
    });
    return (0, response_1.created)(res, order, 'Purchase order placed');
}));
exports.retailerPurchaseRouter.post('/:id/receive', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.receivePurchaseOrderSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.receivePurchaseOrder((0, rbac_1.retailerScope)(req), req.params.id, req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.receive',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: order.id,
        newValue: req.body,
    });
    return (0, response_1.ok)(res, order, 'Stock received and added to inventory');
}));
exports.retailerPurchaseRouter.post('/:id/payments', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.recordPaymentSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const payment = await service.recordPurchasePayment((0, rbac_1.retailerScope)(req), req.params.id, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.payment',
        module: constants_1.AUDIT_MODULES.FINANCE,
        recordId: payment.id,
        newValue: { amount: payment.amount, mode: payment.mode },
    });
    return (0, response_1.created)(res, payment, 'Payment recorded');
}));
exports.retailerPurchaseRouter.patch('/:id/status', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.updateStatusSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.updateStatus({ retailerId: (0, rbac_1.retailerScope)(req) }, req.params.id, req.body.status);
    return (0, response_1.ok)(res, order, 'Purchase order updated');
}));
exports.retailerPurchaseRouter.post('/:id/cancel', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.rejectPurchaseOrderSchema.partial() }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.cancelPurchaseOrder((0, rbac_1.retailerScope)(req), req.params.id, req.body.reason);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.cancel',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: order.id,
        newValue: { reason: req.body.reason },
    });
    return (0, response_1.ok)(res, order, 'Purchase order cancelled');
}));
/**
 * Vendor-facing order endpoints. Mounted at /vendor/orders — these are the
 * wholesale orders a vendor receives from retailers.
 */
exports.vendorOrderRouter = (0, express_1.Router)();
exports.vendorOrderRouter.get('/', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_VIEW), (0, validate_1.validate)({ query: purchase_validation_1.purchaseOrderListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listPurchaseOrders({ vendorId: (0, rbac_1.vendorScope)(req) }, req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
exports.vendorOrderRouter.get('/returns', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_VIEW), (0, validate_1.validate)({ query: purchase_validation_1.purchaseOrderListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listPurchaseReturns({ vendorId: (0, rbac_1.vendorScope)(req) }, req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
exports.vendorOrderRouter.get('/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getPurchaseOrder(req.params.id, { vendorId: (0, rbac_1.vendorScope)(req) }))));
exports.vendorOrderRouter.post('/:id/accept', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.acceptPurchaseOrderSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.acceptPurchaseOrder((0, rbac_1.vendorScope)(req), req.params.id, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.accept',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: order.id,
        newValue: { total: order.totalAmount },
    });
    return (0, response_1.ok)(res, order, 'Purchase order accepted');
}));
exports.vendorOrderRouter.post('/:id/reject', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.rejectPurchaseOrderSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.rejectPurchaseOrder((0, rbac_1.vendorScope)(req), req.params.id, req.body.reason);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.reject',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: order.id,
        newValue: { reason: req.body.reason },
    });
    return (0, response_1.ok)(res, order, 'Purchase order rejected');
}));
exports.vendorOrderRouter.patch('/:id/status', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.updateStatusSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.updateStatus({ vendorId: (0, rbac_1.vendorScope)(req) }, req.params.id, req.body.status);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.status',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: order.id,
        newValue: { status: req.body.status },
    });
    return (0, response_1.ok)(res, order, 'Order status updated');
}));
exports.vendorOrderRouter.post('/:id/dispatch', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: purchase_validation_1.dispatchSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await service.dispatchPurchaseOrder((0, rbac_1.vendorScope)(req), req.params.id, req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'purchase.dispatch',
        module: constants_1.AUDIT_MODULES.PURCHASE,
        recordId: order.id,
        newValue: req.body,
    });
    return (0, response_1.ok)(res, order, 'Order dispatched and invoice generated');
}));
exports.vendorOrderRouter.post('/:id/invoice', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.FINANCE_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.getPurchaseOrder(req.params.id, { vendorId: (0, rbac_1.vendorScope)(req) });
    const invoice = await service.createInvoiceForPurchaseOrder(req.params.id);
    return (0, response_1.created)(res, invoice, 'Invoice generated');
}));
(0, openapi_1.doc)('get', '/retailer/purchases', { tags: ['Retailer'], summary: 'List purchase orders', query: purchase_validation_1.purchaseOrderListQuery, paginated: true });
(0, openapi_1.doc)('post', '/retailer/purchases', { tags: ['Retailer'], summary: 'Place a purchase order with a vendor', body: purchase_validation_1.createPurchaseOrderSchema });
(0, openapi_1.doc)('get', '/retailer/purchases/{id}', { tags: ['Retailer'], summary: 'Purchase order detail', params: query_validation_1.idParam });
(0, openapi_1.doc)('post', '/retailer/purchases/{id}/receive', { tags: ['Retailer'], summary: 'Receive stock against a purchase order', params: query_validation_1.idParam, body: purchase_validation_1.receivePurchaseOrderSchema, status: 200 });
(0, openapi_1.doc)('post', '/retailer/purchases/{id}/payments', { tags: ['Retailer'], summary: 'Record a payment to the vendor', params: query_validation_1.idParam, body: purchase_validation_1.recordPaymentSchema });
(0, openapi_1.doc)('patch', '/retailer/purchases/{id}/status', { tags: ['Retailer'], summary: 'Update purchase order status', params: query_validation_1.idParam, body: purchase_validation_1.updateStatusSchema, status: 200 });
(0, openapi_1.doc)('post', '/retailer/purchases/{id}/cancel', { tags: ['Retailer'], summary: 'Cancel a purchase order', params: query_validation_1.idParam, status: 200 });
(0, openapi_1.doc)('get', '/retailer/purchases/returns', { tags: ['Retailer'], summary: 'List purchase returns', paginated: true });
(0, openapi_1.doc)('post', '/retailer/purchases/returns', { tags: ['Retailer'], summary: 'Create a purchase return', body: purchase_validation_1.purchaseReturnSchema });
(0, openapi_1.doc)('get', '/vendor/orders', { tags: ['Vendor'], summary: 'List wholesale orders received', query: purchase_validation_1.purchaseOrderListQuery, paginated: true });
(0, openapi_1.doc)('get', '/vendor/orders/{id}', { tags: ['Vendor'], summary: 'Wholesale order detail', params: query_validation_1.idParam });
(0, openapi_1.doc)('post', '/vendor/orders/{id}/accept', { tags: ['Vendor'], summary: 'Accept an order, optionally trimming quantities', params: query_validation_1.idParam, body: purchase_validation_1.acceptPurchaseOrderSchema, status: 200 });
(0, openapi_1.doc)('post', '/vendor/orders/{id}/reject', { tags: ['Vendor'], summary: 'Reject an order', params: query_validation_1.idParam, body: purchase_validation_1.rejectPurchaseOrderSchema, status: 200 });
(0, openapi_1.doc)('patch', '/vendor/orders/{id}/status', { tags: ['Vendor'], summary: 'Move an order through the fulfilment states', params: query_validation_1.idParam, body: purchase_validation_1.updateStatusSchema, status: 200 });
(0, openapi_1.doc)('post', '/vendor/orders/{id}/dispatch', { tags: ['Vendor'], summary: 'Dispatch with batch details — deducts vendor stock', params: query_validation_1.idParam, body: purchase_validation_1.dispatchSchema, status: 200 });
(0, openapi_1.doc)('post', '/vendor/orders/{id}/invoice', { tags: ['Vendor'], summary: 'Generate the tax invoice', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/vendor/orders/returns', { tags: ['Vendor'], summary: 'List purchase returns raised against this vendor', paginated: true });
//# sourceMappingURL=purchase.routes.js.map