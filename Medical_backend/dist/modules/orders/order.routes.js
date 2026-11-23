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
exports.retailerOrderRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../database/prisma");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const validate_1 = require("../../middleware/validate");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../lib/audit");
const constants_1 = require("../../config/constants");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const service = __importStar(require("./order.service"));
const orderListQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    status: zod_1.z
        .enum([
        'PENDING',
        'ACCEPTED',
        'PREPARING',
        'READY_FOR_PICKUP',
        'PICKED_UP',
        'COMPLETED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED',
    ])
        .optional(),
    active: zod_1.z.coerce.boolean().optional(),
    pickupDate: zod_1.z.coerce.date().optional(),
});
const statusChangeSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED', 'REJECTED', 'CANCELLED']),
    reason: zod_1.z.string().trim().max(500).optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
});
/** Customer orders as seen by the store. Mounted at /retailer/orders. */
exports.retailerOrderRouter = (0, express_1.Router)();
exports.retailerOrderRouter.get('/', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_VIEW), (0, validate_1.validate)({ query: orderListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listOrders({ retailerId: (0, rbac_1.retailerScope)(req) }, req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
exports.retailerOrderRouter.get('/board', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_VIEW), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const retailerId = (0, rbac_1.retailerScope)(req);
    const grouped = await prisma_1.prisma.order.groupBy({
        by: ['status'],
        where: { retailerId },
        _count: { _all: true },
        _sum: { totalAmount: true },
    });
    return (0, response_1.ok)(res, grouped.map((row) => ({
        status: row.status,
        count: row._count._all,
        amount: row._sum.totalAmount,
    })));
}));
exports.retailerOrderRouter.get('/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getOrder(req.params.id, { retailerId: (0, rbac_1.retailerScope)(req) }))));
exports.retailerOrderRouter.patch('/:id/status', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ORDER_UPDATE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: statusChangeSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // Scope check before the shared state machine runs.
    await service.getOrder(req.params.id, { retailerId: (0, rbac_1.retailerScope)(req) });
    const order = await service.changeStatus(req.params.id, req.body.status, { userId: req.user.id, role: 'RETAILER' }, { reason: req.body.reason, notes: req.body.notes });
    await (0, audit_1.auditFromRequest)(req, {
        action: `order.${req.body.status.toLowerCase()}`,
        module: constants_1.AUDIT_MODULES.ORDER,
        recordId: order.id,
        newValue: { status: req.body.status, reason: req.body.reason },
    });
    return (0, response_1.ok)(res, order, `Order marked ${req.body.status.replace(/_/g, ' ').toLowerCase()}`);
}));
(0, openapi_1.doc)('get', '/retailer/orders', { tags: ['Retailer'], summary: 'List customer orders', query: orderListQuery, paginated: true });
(0, openapi_1.doc)('get', '/retailer/orders/board', { tags: ['Retailer'], summary: 'Order counts and value by status' });
(0, openapi_1.doc)('get', '/retailer/orders/{id}', { tags: ['Retailer'], summary: 'Customer order detail with batch allocations', params: query_validation_1.idParam });
(0, openapi_1.doc)('patch', '/retailer/orders/{id}/status', { tags: ['Retailer'], summary: 'Accept, prepare, ready, hand over or reject an order', params: query_validation_1.idParam, body: statusChangeSchema, status: 200 });
//# sourceMappingURL=order.routes.js.map