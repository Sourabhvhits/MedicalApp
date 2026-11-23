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
const express_1 = require("express");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../lib/audit");
const constants_1 = require("../../config/constants");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const service = __importStar(require("./product.service"));
const product_validation_1 = require("./product.validation");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
/**
 * The product master is readable by every authenticated business role — vendors
 * and retailers pick from it — but only writable with admin permissions.
 */
router.get('/', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PRODUCT_VIEW), (0, validate_1.validate)({ query: product_validation_1.productListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listProducts(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PRODUCT_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getProduct(req.params.id))));
router.post('/', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PRODUCT_CREATE), (0, validate_1.validate)({ body: product_validation_1.productCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const product = await service.createProduct(req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'product.create',
        module: constants_1.AUDIT_MODULES.PRODUCT,
        recordId: product.id,
        newValue: product,
    });
    return (0, response_1.created)(res, product, 'Product created');
}));
router.put('/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PRODUCT_EDIT), (0, validate_1.validate)({ params: query_validation_1.idParam, body: product_validation_1.productUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const before = await service.getProduct(req.params.id);
    const product = await service.updateProduct(req.params.id, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'product.update',
        module: constants_1.AUDIT_MODULES.PRODUCT,
        recordId: product.id,
        oldValue: before,
        newValue: product,
    });
    return (0, response_1.ok)(res, product, 'Product updated');
}));
router.patch('/:id/status', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PRODUCT_EDIT), (0, validate_1.validate)({ params: query_validation_1.idParam, body: product_validation_1.productStatusSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const before = await service.getProduct(req.params.id);
    const product = await service.setProductStatus(req.params.id, req.body.status);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'product.status',
        module: constants_1.AUDIT_MODULES.PRODUCT,
        recordId: product.id,
        oldValue: { status: before.status },
        newValue: { status: product.status, reason: req.body.reason },
    });
    return (0, response_1.ok)(res, product, 'Product status updated');
}));
router.patch('/:id/recall', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PRODUCT_EDIT), (0, validate_1.validate)({ params: query_validation_1.idParam, body: product_validation_1.productRecallSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const product = await service.setProductRecall(req.params.id, req.body.isRecalled, req.body.recallReason);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'product.recall',
        module: constants_1.AUDIT_MODULES.PRODUCT,
        recordId: product.id,
        newValue: { isRecalled: req.body.isRecalled, reason: req.body.recallReason },
    });
    return (0, response_1.ok)(res, product, req.body.isRecalled ? 'Product recalled' : 'Recall lifted');
}));
router.delete('/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PRODUCT_DELETE), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const before = await service.getProduct(req.params.id);
    await service.deleteProduct(req.params.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'product.delete',
        module: constants_1.AUDIT_MODULES.PRODUCT,
        recordId: req.params.id,
        oldValue: before,
    });
    return (0, response_1.noContent)(res, 'Product deleted');
}));
(0, openapi_1.doc)('get', '/products', { tags: ['Admin Masters'], summary: 'List master products', query: product_validation_1.productListQuery, paginated: true });
(0, openapi_1.doc)('get', '/products/{id}', { tags: ['Admin Masters'], summary: 'Get master product', params: query_validation_1.idParam });
(0, openapi_1.doc)('post', '/products', { tags: ['Admin Masters'], summary: 'Create master product', body: product_validation_1.productCreateSchema });
(0, openapi_1.doc)('put', '/products/{id}', { tags: ['Admin Masters'], summary: 'Update master product', params: query_validation_1.idParam, body: product_validation_1.productUpdateSchema });
(0, openapi_1.doc)('patch', '/products/{id}/status', { tags: ['Admin Masters'], summary: 'Activate / deactivate / block a product', params: query_validation_1.idParam, body: product_validation_1.productStatusSchema });
(0, openapi_1.doc)('patch', '/products/{id}/recall', { tags: ['Admin Masters'], summary: 'Recall or un-recall a product', params: query_validation_1.idParam, body: product_validation_1.productRecallSchema });
(0, openapi_1.doc)('delete', '/products/{id}', { tags: ['Admin Masters'], summary: 'Delete master product', params: query_validation_1.idParam });
exports.default = router;
//# sourceMappingURL=product.routes.js.map