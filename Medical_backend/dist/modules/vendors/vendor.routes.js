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
const zod_1 = require("zod");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const ApiError_1 = require("../../utils/ApiError");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const upload_1 = require("../../middleware/upload");
const audit_1 = require("../../lib/audit");
const constants_1 = require("../../config/constants");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const price_history_1 = require("../../common/price-history");
const openapi_1 = require("../../lib/openapi");
const inventory_routes_1 = require("../inventory/inventory.routes");
const purchase_routes_1 = require("../purchases/purchase.routes");
const finance_routes_1 = require("../finance/finance.routes");
const report_routes_1 = require("../reports/report.routes");
const service = __importStar(require("./vendor.service"));
const vendor_validation_1 = require("./vendor.validation");
const router = (0, express_1.Router)();
const upload = (0, upload_1.uploader)('vendor-documents');
router.use(auth_1.authenticate, (0, auth_1.requireUserType)('VENDOR'));
const owner = (req) => ({ ownerType: 'VENDOR', vendorId: (0, rbac_1.vendorScope)(req) });
// ---------------------------------------------------------------------------
// Profile & KYC
// ---------------------------------------------------------------------------
router.get('/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getProfile((0, rbac_1.vendorScope)(req)))));
router.put('/profile', (0, validate_1.validate)({ body: vendor_validation_1.vendorProfileSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const vendorId = (0, rbac_1.vendorScope)(req);
    const before = await service.getProfile(vendorId);
    const vendor = await service.updateProfile(vendorId, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'vendor.profile_update',
        module: constants_1.AUDIT_MODULES.VENDOR,
        recordId: vendorId,
        oldValue: before,
        newValue: vendor,
    });
    return (0, response_1.ok)(res, vendor, 'Profile updated');
}));
router.post('/documents', upload.single('file'), (0, validate_1.validate)({ body: vendor_validation_1.documentUploadSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw ApiError_1.ApiError.badRequest('A document file is required');
    const document = await service.addDocument((0, rbac_1.vendorScope)(req), req.file, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'vendor.document_upload',
        module: constants_1.AUDIT_MODULES.VENDOR,
        recordId: document.id,
        newValue: { type: document.type, fileName: document.fileName },
    });
    return (0, response_1.created)(res, document, 'Document uploaded');
}));
router.delete('/documents/:id', (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.deleteDocument((0, rbac_1.vendorScope)(req), req.params.id);
    return (0, response_1.noContent)(res, 'Document removed');
}));
// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
router.get('/products', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_VIEW), (0, validate_1.validate)({ query: vendor_validation_1.vendorProductListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listCatalog((0, rbac_1.vendorScope)(req), req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.post('/products', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_MANAGE), (0, validate_1.validate)({ body: vendor_validation_1.vendorProductCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const entry = await service.addCatalogProduct((0, rbac_1.vendorScope)(req), req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'catalog.add',
        module: constants_1.AUDIT_MODULES.CATALOG,
        recordId: entry.id,
        newValue: entry,
    });
    return (0, response_1.created)(res, entry, 'Product added to your catalogue');
}));
router.put('/products/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: vendor_validation_1.vendorProductUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const entry = await service.updateCatalogProduct((0, rbac_1.vendorScope)(req), req.params.id, req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'catalog.update',
        module: constants_1.AUDIT_MODULES.CATALOG,
        recordId: entry.id,
        newValue: entry,
    });
    return (0, response_1.ok)(res, entry, 'Catalogue entry updated');
}));
router.patch('/products/bulk-price', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_MANAGE), (0, validate_1.validate)({ body: vendor_validation_1.bulkPriceUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await service.bulkUpdatePrices((0, rbac_1.vendorScope)(req), req.body.items, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'catalog.bulk_price',
        module: constants_1.AUDIT_MODULES.CATALOG,
        newValue: result,
    });
    return (0, response_1.ok)(res, result, 'Prices updated');
}));
router.delete('/products/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.removeCatalogProduct((0, rbac_1.vendorScope)(req), req.params.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'catalog.remove',
        module: constants_1.AUDIT_MODULES.CATALOG,
        recordId: req.params.id,
    });
    return (0, response_1.noContent)(res, 'Product removed from your catalogue');
}));
router.get('/products/:id/price-history', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await (0, price_history_1.listPriceHistory)('VENDOR', (0, rbac_1.vendorScope)(req), req.params.id))));
// ---------------------------------------------------------------------------
// Inventory & dashboard
// ---------------------------------------------------------------------------
router.use('/inventory', (0, inventory_routes_1.createInventoryRouter)(owner, 'Vendor'));
router.use('/orders', purchase_routes_1.vendorOrderRouter);
router.use('/finance', (0, finance_routes_1.createFinanceRouter)((req) => ({ ownerType: 'VENDOR', vendorId: (0, rbac_1.vendorScope)(req) }), 'Vendor'));
router.use('/reports', (0, report_routes_1.createReportRouter)((req) => ({ ownerType: 'VENDOR', vendorId: (0, rbac_1.vendorScope)(req) }), 'Vendor'));
router.get('/dashboard', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.DASHBOARD_VIEW), (0, validate_1.validate)({ query: zod_1.z.object({ days: zod_1.z.coerce.number().int().min(1).max(365).default(30) }) }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.dashboard((0, rbac_1.vendorScope)(req), Number(req.query.days ?? 30)))));
(0, openapi_1.doc)('get', '/vendor/profile', { tags: ['Vendor'], summary: 'Get the signed-in vendor profile' });
(0, openapi_1.doc)('put', '/vendor/profile', { tags: ['Vendor'], summary: 'Update company and business details', body: vendor_validation_1.vendorProfileSchema, status: 200 });
(0, openapi_1.doc)('post', '/vendor/documents', { tags: ['Vendor'], summary: 'Upload a KYC / licence document', body: vendor_validation_1.documentUploadSchema, multipart: true });
(0, openapi_1.doc)('delete', '/vendor/documents/{id}', { tags: ['Vendor'], summary: 'Remove a pending document', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/vendor/products', { tags: ['Vendor'], summary: 'List the vendor catalogue', query: vendor_validation_1.vendorProductListQuery, paginated: true });
(0, openapi_1.doc)('post', '/vendor/products', { tags: ['Vendor'], summary: 'Add a master product to the catalogue', body: vendor_validation_1.vendorProductCreateSchema });
(0, openapi_1.doc)('put', '/vendor/products/{id}', { tags: ['Vendor'], summary: 'Update catalogue pricing and status', params: query_validation_1.idParam, body: vendor_validation_1.vendorProductUpdateSchema, status: 200 });
(0, openapi_1.doc)('patch', '/vendor/products/bulk-price', { tags: ['Vendor'], summary: 'Bulk update catalogue prices', body: vendor_validation_1.bulkPriceUpdateSchema, status: 200 });
(0, openapi_1.doc)('delete', '/vendor/products/{id}', { tags: ['Vendor'], summary: 'Remove a catalogue entry', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/vendor/products/{id}/price-history', { tags: ['Vendor'], summary: 'Price change history for a product', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/vendor/dashboard', { tags: ['Vendor'], summary: 'Vendor dashboard cards and charts' });
exports.default = router;
//# sourceMappingURL=vendor.routes.js.map