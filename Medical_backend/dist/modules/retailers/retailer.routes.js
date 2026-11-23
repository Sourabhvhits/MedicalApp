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
const prisma_1 = require("../../database/prisma");
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
const order_routes_1 = require("../orders/order.routes");
const finance_routes_1 = require("../finance/finance.routes");
const report_routes_1 = require("../reports/report.routes");
const vendor_validation_1 = require("../vendors/vendor.validation");
const service = __importStar(require("./retailer.service"));
const pickup = __importStar(require("./pickup.service"));
const retailer_validation_1 = require("./retailer.validation");
const router = (0, express_1.Router)();
const documentUpload = (0, upload_1.uploader)('shop-documents');
const imageUpload = (0, upload_1.uploader)('store-images');
router.use(auth_1.authenticate, (0, auth_1.requireUserType)('RETAILER'));
const owner = (req) => ({ ownerType: 'RETAILER', retailerId: (0, rbac_1.retailerScope)(req) });
// ---------------------------------------------------------------------------
// Store profile
// ---------------------------------------------------------------------------
router.get('/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getProfile((0, rbac_1.retailerScope)(req)))));
router.put('/profile', (0, validate_1.validate)({ body: retailer_validation_1.retailerProfileSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const retailerId = (0, rbac_1.retailerScope)(req);
    const before = await service.getProfile(retailerId);
    const retailer = await service.updateProfile(retailerId, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'retailer.profile_update',
        module: constants_1.AUDIT_MODULES.RETAILER,
        recordId: retailerId,
        oldValue: before,
        newValue: retailer,
    });
    return (0, response_1.ok)(res, retailer, 'Store profile updated');
}));
router.patch('/profile/closure', (0, validate_1.validate)({ body: retailer_validation_1.temporaryClosureSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const retailer = await service.setTemporaryClosure((0, rbac_1.retailerScope)(req), req.body.isTemporarilyClosed, req.body.closureReason);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'retailer.closure',
        module: constants_1.AUDIT_MODULES.RETAILER,
        recordId: retailer.id,
        newValue: req.body,
    });
    return (0, response_1.ok)(res, retailer, req.body.isTemporarilyClosed ? 'Store marked as closed' : 'Store reopened');
}));
router.post('/documents', documentUpload.single('file'), (0, validate_1.validate)({ body: vendor_validation_1.documentUploadSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw ApiError_1.ApiError.badRequest('A document file is required');
    const document = await service.addDocument((0, rbac_1.retailerScope)(req), req.file, req.body);
    return (0, response_1.created)(res, document, 'Document uploaded');
}));
router.delete('/documents/:id', (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.deleteDocument((0, rbac_1.retailerScope)(req), req.params.id);
    return (0, response_1.noContent)(res, 'Document removed');
}));
router.post('/images', imageUpload.single('file'), (0, validate_1.validate)({ body: retailer_validation_1.storeImageSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw ApiError_1.ApiError.badRequest('An image file is required');
    const image = await service.addImage((0, rbac_1.retailerScope)(req), req.file, req.body);
    return (0, response_1.created)(res, image, 'Store image uploaded');
}));
router.delete('/images/:id', (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.deleteImage((0, rbac_1.retailerScope)(req), req.params.id);
    return (0, response_1.noContent)(res, 'Image removed');
}));
// ---------------------------------------------------------------------------
// Business hours, holidays, pickup slots
// ---------------------------------------------------------------------------
router.get('/business-hours', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await prisma_1.prisma.storeBusinessHour.findMany({
    where: { retailerId: (0, rbac_1.retailerScope)(req) },
    orderBy: { dayOfWeek: 'asc' },
}))));
router.put('/business-hours', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STORE_MANAGE), (0, validate_1.validate)({ body: retailer_validation_1.businessHoursSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const hours = await service.setBusinessHours((0, rbac_1.retailerScope)(req), req.body.hours);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'retailer.business_hours',
        module: constants_1.AUDIT_MODULES.RETAILER,
        recordId: (0, rbac_1.retailerScope)(req),
        newValue: req.body.hours,
    });
    return (0, response_1.ok)(res, hours, 'Business hours updated');
}));
router.get('/holidays', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.listHolidays((0, rbac_1.retailerScope)(req)))));
router.post('/holidays', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STORE_MANAGE), (0, validate_1.validate)({ body: retailer_validation_1.holidayCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await service.addHoliday((0, rbac_1.retailerScope)(req), req.body);
    return (0, response_1.created)(res, result, result.bookedSlotsNeedingAttention > 0
        ? `Holiday saved. ${result.bookedSlotsNeedingAttention} slot(s) already have bookings — contact those customers.`
        : 'Holiday saved');
}));
router.delete('/holidays/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.STORE_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.deleteHoliday((0, rbac_1.retailerScope)(req), req.params.id);
    return (0, response_1.noContent)(res, 'Holiday removed');
}));
router.get('/pickup/config', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await prisma_1.prisma.pickupSlotConfig.findUnique({ where: { retailerId: (0, rbac_1.retailerScope)(req) } }))));
router.put('/pickup/config', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PICKUP_MANAGE), (0, validate_1.validate)({ body: retailer_validation_1.pickupConfigSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const config = await service.updatePickupConfig((0, rbac_1.retailerScope)(req), req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'retailer.pickup_config',
        module: constants_1.AUDIT_MODULES.RETAILER,
        recordId: config.id,
        newValue: req.body,
    });
    return (0, response_1.ok)(res, config, 'Pickup configuration updated');
}));
router.get('/pickup/slots', (0, validate_1.validate)({ query: zod_1.z.object({ days: zod_1.z.coerce.number().int().min(1).max(30).default(7) }) }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await pickup.slotCalendar((0, rbac_1.retailerScope)(req), Number(req.query.days ?? 7)))));
router.patch('/pickup/slots/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PICKUP_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: retailer_validation_1.slotStatusSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const slot = await prisma_1.prisma.pickupSlot.findFirst({
        where: { id: req.params.id, retailerId: (0, rbac_1.retailerScope)(req) },
    });
    if (!slot)
        throw ApiError_1.ApiError.notFound('Pickup slot not found');
    if (req.body.status === 'DISABLED' && slot.bookedCount > 0) {
        throw ApiError_1.ApiError.badRequest(`This slot has ${slot.bookedCount} booked order(s) — cancel or reschedule them before disabling it`);
    }
    const updated = await prisma_1.prisma.pickupSlot.update({
        where: { id: req.params.id },
        data: { status: req.body.status },
    });
    return (0, response_1.ok)(res, updated, 'Pickup slot updated');
}));
// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
router.get('/products', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_VIEW), (0, validate_1.validate)({ query: retailer_validation_1.retailerProductListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listCatalog((0, rbac_1.retailerScope)(req), req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.post('/products', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_MANAGE), (0, validate_1.validate)({ body: retailer_validation_1.retailerProductCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const entry = await service.addCatalogProduct((0, rbac_1.retailerScope)(req), req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'catalog.add',
        module: constants_1.AUDIT_MODULES.CATALOG,
        recordId: entry.id,
        newValue: entry,
    });
    return (0, response_1.created)(res, entry, 'Product added to your store');
}));
router.put('/products/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: retailer_validation_1.retailerProductUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const entry = await service.updateCatalogProduct((0, rbac_1.retailerScope)(req), req.params.id, req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'catalog.update',
        module: constants_1.AUDIT_MODULES.CATALOG,
        recordId: entry.id,
        newValue: entry,
    });
    return (0, response_1.ok)(res, entry, 'Product updated');
}));
router.delete('/products/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.removeCatalogProduct((0, rbac_1.retailerScope)(req), req.params.id);
    return (0, response_1.noContent)(res, 'Product removed from your store');
}));
router.get('/products/:id/price-history', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.CATALOG_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await (0, price_history_1.listPriceHistory)('RETAILER', (0, rbac_1.retailerScope)(req), req.params.id))));
// ---------------------------------------------------------------------------
// Wholesale sourcing
// ---------------------------------------------------------------------------
router.get('/vendors', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_VIEW), (0, validate_1.validate)({ query: retailer_validation_1.vendorBrowseQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listVendors(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/vendor-products', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.PURCHASE_VIEW), (0, validate_1.validate)({ query: retailer_validation_1.vendorProductBrowseQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listVendorProducts(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
// ---------------------------------------------------------------------------
// Inventory & dashboard
// ---------------------------------------------------------------------------
router.use('/inventory', (0, inventory_routes_1.createInventoryRouter)(owner, 'Retailer'));
router.use('/purchases', purchase_routes_1.retailerPurchaseRouter);
router.use('/orders', order_routes_1.retailerOrderRouter);
router.use('/finance', (0, finance_routes_1.createFinanceRouter)((req) => ({ ownerType: 'RETAILER', retailerId: (0, rbac_1.retailerScope)(req) }), 'Retailer'));
router.use('/reports', (0, report_routes_1.createReportRouter)((req) => ({ ownerType: 'RETAILER', retailerId: (0, rbac_1.retailerScope)(req) }), 'Retailer'));
router.get('/dashboard', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.DASHBOARD_VIEW), (0, validate_1.validate)({ query: zod_1.z.object({ days: zod_1.z.coerce.number().int().min(1).max(365).default(30) }) }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.dashboard((0, rbac_1.retailerScope)(req), Number(req.query.days ?? 30)))));
(0, openapi_1.doc)('get', '/retailer/profile', { tags: ['Retailer'], summary: 'Get the signed-in store profile' });
(0, openapi_1.doc)('put', '/retailer/profile', { tags: ['Retailer'], summary: 'Update store details and location', body: retailer_validation_1.retailerProfileSchema, status: 200 });
(0, openapi_1.doc)('patch', '/retailer/profile/closure', { tags: ['Retailer'], summary: 'Temporarily close or reopen the store', body: retailer_validation_1.temporaryClosureSchema, status: 200 });
(0, openapi_1.doc)('post', '/retailer/documents', { tags: ['Retailer'], summary: 'Upload a licence / KYC document', body: vendor_validation_1.documentUploadSchema, multipart: true });
(0, openapi_1.doc)('delete', '/retailer/documents/{id}', { tags: ['Retailer'], summary: 'Remove a pending document', params: query_validation_1.idParam });
(0, openapi_1.doc)('post', '/retailer/images', { tags: ['Retailer'], summary: 'Upload a store photo', body: retailer_validation_1.storeImageSchema, multipart: true });
(0, openapi_1.doc)('delete', '/retailer/images/{id}', { tags: ['Retailer'], summary: 'Delete a store photo', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/retailer/business-hours', { tags: ['Retailer'], summary: 'Get weekly business hours' });
(0, openapi_1.doc)('put', '/retailer/business-hours', { tags: ['Retailer'], summary: 'Set weekly business hours', body: retailer_validation_1.businessHoursSchema, status: 200 });
(0, openapi_1.doc)('get', '/retailer/holidays', { tags: ['Retailer'], summary: 'List store holidays' });
(0, openapi_1.doc)('post', '/retailer/holidays', { tags: ['Retailer'], summary: 'Add a holiday or special hours', body: retailer_validation_1.holidayCreateSchema });
(0, openapi_1.doc)('delete', '/retailer/holidays/{id}', { tags: ['Retailer'], summary: 'Remove a holiday', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/retailer/pickup/config', { tags: ['Retailer'], summary: 'Get pickup slot configuration' });
(0, openapi_1.doc)('put', '/retailer/pickup/config', { tags: ['Retailer'], summary: 'Configure slot duration, capacity and buffer', body: retailer_validation_1.pickupConfigSchema, status: 200 });
(0, openapi_1.doc)('get', '/retailer/pickup/slots', { tags: ['Retailer'], summary: 'Pickup slot calendar' });
(0, openapi_1.doc)('patch', '/retailer/pickup/slots/{id}', { tags: ['Retailer'], summary: 'Enable or disable a pickup slot', params: query_validation_1.idParam, body: retailer_validation_1.slotStatusSchema, status: 200 });
(0, openapi_1.doc)('get', '/retailer/products', { tags: ['Retailer'], summary: 'List the store catalogue', query: retailer_validation_1.retailerProductListQuery, paginated: true });
(0, openapi_1.doc)('post', '/retailer/products', { tags: ['Retailer'], summary: 'Add a master product to the store', body: retailer_validation_1.retailerProductCreateSchema });
(0, openapi_1.doc)('put', '/retailer/products/{id}', { tags: ['Retailer'], summary: 'Update store pricing and status', params: query_validation_1.idParam, body: retailer_validation_1.retailerProductUpdateSchema, status: 200 });
(0, openapi_1.doc)('delete', '/retailer/products/{id}', { tags: ['Retailer'], summary: 'Remove a product from the store', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/retailer/products/{id}/price-history', { tags: ['Retailer'], summary: 'Price change history', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/retailer/vendors', { tags: ['Retailer'], summary: 'Browse approved wholesalers', query: retailer_validation_1.vendorBrowseQuery, paginated: true });
(0, openapi_1.doc)('get', '/retailer/vendor-products', { tags: ['Retailer'], summary: 'Browse wholesale products with live availability', query: retailer_validation_1.vendorProductBrowseQuery, paginated: true });
(0, openapi_1.doc)('get', '/retailer/dashboard', { tags: ['Retailer'], summary: 'Store dashboard cards and charts' });
exports.default = router;
//# sourceMappingURL=retailer.routes.js.map