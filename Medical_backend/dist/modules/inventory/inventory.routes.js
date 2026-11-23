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
exports.createInventoryRouter = createInventoryRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../database/prisma");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const ApiError_1 = require("../../utils/ApiError");
const validate_1 = require("../../middleware/validate");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../lib/audit");
const constants_1 = require("../../config/constants");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const inventory = __importStar(require("./inventory.service"));
const query = __importStar(require("./inventory.query"));
const inventory_validation_1 = require("./inventory.validation");
/**
 * Inventory endpoints are identical for vendors and retailers — only the owner
 * scope differs. Both mount this router with their own scope resolver.
 */
function createInventoryRouter(resolveOwner, tag) {
    const router = (0, express_1.Router)();
    // -------------------------------------------------------------------------
    // Reads
    // -------------------------------------------------------------------------
    router.get('/batches', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, validate_1.validate)({ query: inventory_validation_1.stockListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { items, meta } = await query.listStock(resolveOwner(req), req.query);
        return (0, response_1.paginated)(res, items, meta);
    }));
    router.get('/summary', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, validate_1.validate)({ query: inventory_validation_1.stockSummaryQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { items, meta } = await query.listStockSummary(resolveOwner(req), req.query);
        return (0, response_1.paginated)(res, items, meta);
    }));
    router.get('/valuation', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await query.stockValuation(resolveOwner(req)))));
    router.get('/low-stock', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, validate_1.validate)({ query: zod_1.z.object({ limit: zod_1.z.coerce.number().int().min(1).max(100).default(20) }) }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await query.lowStockItems(resolveOwner(req), Number(req.query.limit ?? 20)))));
    router.get('/expiry-summary', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await query.expirySummary(resolveOwner(req)))));
    router.get('/expiring', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, validate_1.validate)({ query: inventory_validation_1.stockListQuery.extend({ days: zod_1.z.coerce.number().int().min(1).max(365).default(30) }) }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { items, meta } = await query.listExpiring(resolveOwner(req), Number(req.query.days ?? 30), req.query);
        return (0, response_1.paginated)(res, items, meta);
    }));
    router.get('/expired', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, validate_1.validate)({ query: inventory_validation_1.stockListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { items, meta } = await query.listExpired(resolveOwner(req), req.query);
        return (0, response_1.paginated)(res, items, meta);
    }));
    router.get('/transactions', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, validate_1.validate)({ query: inventory_validation_1.transactionListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { items, meta } = await query.listTransactions(resolveOwner(req), req.query);
        return (0, response_1.paginated)(res, items, meta);
    }));
    // -------------------------------------------------------------------------
    // Writes — every one produces an inventory transaction
    // -------------------------------------------------------------------------
    router.post('/batches', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_MANAGE), (0, validate_1.validate)({ body: inventory_validation_1.addStockSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const owner = resolveOwner(req);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({
                where: { id: req.body.productId, deletedAt: null },
                select: { id: true, status: true, isRecalled: true },
            });
            if (!product)
                throw ApiError_1.ApiError.badRequest('Product not found in the master catalogue');
            if (product.status === 'BLOCKED' || product.isRecalled) {
                throw ApiError_1.ApiError.badRequest('This product is blocked or recalled and cannot be stocked');
            }
            const warehouseId = await inventory.resolveWarehouse(tx, owner, req.body.warehouseId);
            return inventory.stockIn(tx, owner, warehouseId, req.body, 'OPENING_STOCK', {
                referenceType: 'MANUAL',
                notes: req.body.notes,
                performedById: req.user.id,
            });
        });
        await (0, audit_1.auditFromRequest)(req, {
            action: 'stock.add',
            module: constants_1.AUDIT_MODULES.INVENTORY,
            recordId: result.batchId,
            newValue: req.body,
        });
        return (0, response_1.created)(res, result, 'Stock added');
    }));
    router.patch('/batches/:id/adjust', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: inventory_validation_1.adjustStockSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const batch = await inventory.adjustBatch(resolveOwner(req), req.params.id, req.body.quantity, req.body.reason, req.user.id);
        await (0, audit_1.auditFromRequest)(req, {
            action: 'stock.adjust',
            module: constants_1.AUDIT_MODULES.INVENTORY,
            recordId: req.params.id,
            newValue: { quantity: req.body.quantity, reason: req.body.reason },
        });
        return (0, response_1.ok)(res, batch, 'Stock adjusted');
    }));
    router.patch('/batches/:id/status', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: inventory_validation_1.batchStatusSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const batch = await inventory.setBatchStatus(resolveOwner(req), req.params.id, req.body.status);
        await (0, audit_1.auditFromRequest)(req, {
            action: 'stock.batch_status',
            module: constants_1.AUDIT_MODULES.INVENTORY,
            recordId: req.params.id,
            newValue: { status: req.body.status },
        });
        return (0, response_1.ok)(res, batch, 'Batch status updated');
    }));
    router.post('/write-off', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_MANAGE), (0, validate_1.validate)({ body: inventory_validation_1.writeOffSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const owner = resolveOwner(req);
        const allocations = await prisma_1.prisma.$transaction(async (tx) => {
            const warehouseId = await inventory.resolveWarehouse(tx, owner, req.body.warehouseId);
            return inventory.stockOut(tx, owner, warehouseId, req.body.productId, req.body.quantity, req.body.type, { referenceType: 'WRITE_OFF', notes: req.body.reason, performedById: req.user.id });
        });
        await (0, audit_1.auditFromRequest)(req, {
            action: `stock.${req.body.type.toLowerCase()}`,
            module: constants_1.AUDIT_MODULES.INVENTORY,
            recordId: req.body.productId,
            newValue: req.body,
        });
        return (0, response_1.ok)(res, allocations, 'Stock written off');
    }));
    // -------------------------------------------------------------------------
    // Warehouses
    // -------------------------------------------------------------------------
    router.get('/warehouses', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_VIEW), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const owner = resolveOwner(req);
        const warehouses = await prisma_1.prisma.warehouse.findMany({
            where: owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
        return (0, response_1.ok)(res, warehouses);
    }));
    router.post('/warehouses', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_MANAGE), (0, validate_1.validate)({ body: inventory_validation_1.warehouseCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const owner = resolveOwner(req);
        const warehouse = await prisma_1.prisma.warehouse.create({
            data: {
                ...req.body,
                ownerType: owner.ownerType,
                vendorId: owner.vendorId ?? null,
                retailerId: owner.retailerId ?? null,
            },
        });
        return (0, response_1.created)(res, warehouse, 'Warehouse created');
    }));
    router.put('/warehouses/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STOCK_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: inventory_validation_1.warehouseUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const owner = resolveOwner(req);
        const existing = await prisma_1.prisma.warehouse.findFirst({
            where: {
                id: req.params.id,
                ...(owner.ownerType === 'VENDOR' ? { vendorId: owner.vendorId } : { retailerId: owner.retailerId }),
            },
            select: { id: true },
        });
        if (!existing)
            throw ApiError_1.ApiError.notFound('Warehouse not found');
        const warehouse = await prisma_1.prisma.warehouse.update({ where: { id: req.params.id }, data: req.body });
        return (0, response_1.ok)(res, warehouse, 'Warehouse updated');
    }));
    // -------------------------------------------------------------------------
    // OpenAPI
    // -------------------------------------------------------------------------
    const base = tag === 'Vendor' ? '/vendor/inventory' : '/retailer/inventory';
    (0, openapi_1.doc)('get', `${base}/batches`, { tags: [tag, 'Inventory'], summary: 'List stock batches', query: inventory_validation_1.stockListQuery, paginated: true });
    (0, openapi_1.doc)('get', `${base}/summary`, { tags: [tag, 'Inventory'], summary: 'Product-wise stock position', query: inventory_validation_1.stockSummaryQuery, paginated: true });
    (0, openapi_1.doc)('get', `${base}/valuation`, { tags: [tag, 'Inventory'], summary: 'Stock valuation totals' });
    (0, openapi_1.doc)('get', `${base}/low-stock`, { tags: [tag, 'Inventory'], summary: 'Products at or below the minimum stock level' });
    (0, openapi_1.doc)('get', `${base}/expiry-summary`, { tags: [tag, 'Inventory'], summary: 'Expired / 30 / 60 / 90 day expiry counts' });
    (0, openapi_1.doc)('get', `${base}/expiring`, { tags: [tag, 'Inventory'], summary: 'Batches expiring within N days', query: inventory_validation_1.stockListQuery, paginated: true });
    (0, openapi_1.doc)('get', `${base}/expired`, { tags: [tag, 'Inventory'], summary: 'Expired batches still holding stock', query: inventory_validation_1.stockListQuery, paginated: true });
    (0, openapi_1.doc)('get', `${base}/transactions`, { tags: [tag, 'Inventory'], summary: 'Stock movement ledger', query: inventory_validation_1.transactionListQuery, paginated: true });
    (0, openapi_1.doc)('post', `${base}/batches`, { tags: [tag, 'Inventory'], summary: 'Add stock into a batch', body: inventory_validation_1.addStockSchema });
    (0, openapi_1.doc)('patch', `${base}/batches/{id}/adjust`, { tags: [tag, 'Inventory'], summary: 'Adjust a batch quantity', params: query_validation_1.idParam, body: inventory_validation_1.adjustStockSchema, status: 200 });
    (0, openapi_1.doc)('patch', `${base}/batches/{id}/status`, { tags: [tag, 'Inventory'], summary: 'Block / unblock a batch', params: query_validation_1.idParam, body: inventory_validation_1.batchStatusSchema, status: 200 });
    (0, openapi_1.doc)('post', `${base}/write-off`, { tags: [tag, 'Inventory'], summary: 'Write off damaged or expired stock', body: inventory_validation_1.writeOffSchema, status: 200 });
    (0, openapi_1.doc)('get', `${base}/warehouses`, { tags: [tag, 'Inventory'], summary: 'List warehouses / store locations' });
    (0, openapi_1.doc)('post', `${base}/warehouses`, { tags: [tag, 'Inventory'], summary: 'Create a warehouse', body: inventory_validation_1.warehouseCreateSchema });
    (0, openapi_1.doc)('put', `${base}/warehouses/{id}`, { tags: [tag, 'Inventory'], summary: 'Update a warehouse', params: query_validation_1.idParam, body: inventory_validation_1.warehouseUpdateSchema, status: 200 });
    return router;
}
//# sourceMappingURL=inventory.routes.js.map