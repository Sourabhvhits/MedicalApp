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
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const pickup_service_1 = require("../retailers/pickup.service");
const orders = __importStar(require("../orders/order.service"));
const discovery = __importStar(require("./discovery.service"));
const cart = __importStar(require("./cart.service"));
const service = __importStar(require("./customer.service"));
const customer_validation_1 = require("./customer.validation");
const router = (0, express_1.Router)();
const prescriptionUpload = (0, upload_1.uploader)('prescriptions');
// ---------------------------------------------------------------------------
// Public discovery — browsing works without an account
// ---------------------------------------------------------------------------
router.get('/stores/nearby', auth_1.optionalAuth, (0, validate_1.validate)({ query: customer_validation_1.nearbyStoresQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await discovery.nearbyStores(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/stores/:id', auth_1.optionalAuth, (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await discovery.getStore(req.params.id))));
router.get('/stores/:id/products', auth_1.optionalAuth, (0, validate_1.validate)({ params: query_validation_1.idParam, query: customer_validation_1.storeProductsQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await discovery.storeProducts(req.params.id, req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/stores/:id/reviews', auth_1.optionalAuth, (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.listStoreReviews(req.params.id))));
router.get('/stores/:id/pickup-slots', auth_1.optionalAuth, (0, validate_1.validate)({
    params: query_validation_1.idParam,
    query: zod_1.z.object({
        date: zod_1.z.coerce.date().optional(),
        days: zod_1.z.coerce.number().int().min(1).max(30).default(7),
    }),
}), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.query.date) {
        return (0, response_1.ok)(res, await (0, pickup_service_1.availableSlots)(req.params.id, req.query.date));
    }
    return (0, response_1.ok)(res, await (0, pickup_service_1.slotCalendar)(req.params.id, Number(req.query.days ?? 7)));
}));
router.get('/products/search', auth_1.optionalAuth, (0, validate_1.validate)({ query: customer_validation_1.productSearchQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await discovery.searchProducts(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
// ---------------------------------------------------------------------------
// Authenticated customer area
// ---------------------------------------------------------------------------
router.use(auth_1.authenticate, (0, auth_1.requireUserType)('CUSTOMER'));
router.get('/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getProfile((0, rbac_1.customerScope)(req)))));
router.put('/profile', (0, validate_1.validate)({ body: customer_validation_1.customerProfileSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.updateProfile((0, rbac_1.customerScope)(req), req.user.id, req.body), 'Profile updated')));
router.put('/location', (0, validate_1.validate)({ body: customer_validation_1.customerLocationSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.setLocation((0, rbac_1.customerScope)(req), req.body.latitude, req.body.longitude), 'Location saved')));
router.get('/addresses', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.listAddresses((0, rbac_1.customerScope)(req)))));
router.post('/addresses', (0, validate_1.validate)({ body: customer_validation_1.addressSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.created)(res, await service.addAddress((0, rbac_1.customerScope)(req), req.body), 'Address saved')));
router.put('/addresses/:id', (0, validate_1.validate)({ params: query_validation_1.idParam, body: customer_validation_1.addressSchema.partial() }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.updateAddress((0, rbac_1.customerScope)(req), req.params.id, req.body), 'Address updated')));
router.delete('/addresses/:id', (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.deleteAddress((0, rbac_1.customerScope)(req), req.params.id);
    return (0, response_1.noContent)(res, 'Address removed');
}));
// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------
router.get('/cart', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await cart.summarizeCart((0, rbac_1.customerScope)(req)))));
router.post('/cart/items', (0, validate_1.validate)({ body: customer_validation_1.addToCartSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.created)(res, await cart.addItem((0, rbac_1.customerScope)(req), req.body), 'Added to cart')));
router.put('/cart/items/:id', (0, validate_1.validate)({ params: query_validation_1.idParam, body: customer_validation_1.updateCartItemSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await cart.updateItem((0, rbac_1.customerScope)(req), req.params.id, req.body.quantity), 'Cart updated')));
router.delete('/cart/items/:id', (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await cart.removeItem((0, rbac_1.customerScope)(req), req.params.id), 'Item removed')));
router.delete('/cart', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await cart.clearCart((0, rbac_1.customerScope)(req)), 'Cart cleared')));
// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
router.post('/prescriptions', prescriptionUpload.single('file'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw ApiError_1.ApiError.badRequest('A prescription file is required');
    return (0, response_1.created)(res, { url: (0, upload_1.publicUrl)('prescriptions', req.file.filename) }, 'Prescription uploaded');
}));
router.post('/orders', (0, validate_1.validate)({ body: customer_validation_1.checkoutSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await orders.checkout((0, rbac_1.customerScope)(req), req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'order.create',
        module: constants_1.AUDIT_MODULES.ORDER,
        recordId: order.id,
        newValue: { orderNumber: order.orderNumber, total: order.totalAmount },
    });
    return (0, response_1.created)(res, order, 'Order placed successfully');
}));
router.get('/orders', (0, validate_1.validate)({ query: customer_validation_1.customerOrderListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await orders.listOrders({ customerId: (0, rbac_1.customerScope)(req) }, req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/orders/:id', (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await orders.getOrder(req.params.id, { customerId: (0, rbac_1.customerScope)(req) }))));
router.post('/orders/:id/cancel', (0, validate_1.validate)({ params: query_validation_1.idParam, body: customer_validation_1.cancelOrderSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const order = await orders.cancelByCustomer((0, rbac_1.customerScope)(req), req.params.id, req.body.reason, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'order.cancel',
        module: constants_1.AUDIT_MODULES.ORDER,
        recordId: order.id,
        newValue: { reason: req.body.reason },
    });
    return (0, response_1.ok)(res, order, 'Order cancelled');
}));
// ---------------------------------------------------------------------------
// Favourites, reviews, dashboard
// ---------------------------------------------------------------------------
router.get('/favorites', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.listFavorites((0, rbac_1.customerScope)(req)))));
router.post('/favorites', (0, validate_1.validate)({ body: customer_validation_1.favoriteSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.toggleFavorite((0, rbac_1.customerScope)(req), req.body), 'Favourites updated')));
router.post('/reviews', (0, validate_1.validate)({ body: customer_validation_1.reviewSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.created)(res, await service.addReview((0, rbac_1.customerScope)(req), req.body), 'Thanks for your review')));
router.get('/dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.dashboard((0, rbac_1.customerScope)(req)))));
(0, openapi_1.doc)('get', '/customers/stores/nearby', { tags: ['Customer'], summary: 'Find nearby medical stores', query: customer_validation_1.nearbyStoresQuery, paginated: true, auth: false });
(0, openapi_1.doc)('get', '/customers/stores/{id}', { tags: ['Customer'], summary: 'Store detail with hours and pickup config', params: query_validation_1.idParam, auth: false });
(0, openapi_1.doc)('get', '/customers/stores/{id}/products', { tags: ['Customer'], summary: 'Products a store currently has in stock', params: query_validation_1.idParam, query: customer_validation_1.storeProductsQuery, paginated: true, auth: false });
(0, openapi_1.doc)('get', '/customers/stores/{id}/reviews', { tags: ['Customer'], summary: 'Store reviews', params: query_validation_1.idParam, auth: false });
(0, openapi_1.doc)('get', '/customers/stores/{id}/pickup-slots', { tags: ['Customer'], summary: 'Selectable pickup slots', params: query_validation_1.idParam, auth: false });
(0, openapi_1.doc)('get', '/customers/products/search', { tags: ['Customer'], summary: 'Search products across nearby stores', query: customer_validation_1.productSearchQuery, paginated: true, auth: false });
(0, openapi_1.doc)('get', '/customers/profile', { tags: ['Customer'], summary: 'Customer profile' });
(0, openapi_1.doc)('put', '/customers/profile', { tags: ['Customer'], summary: 'Update profile', body: customer_validation_1.customerProfileSchema, status: 200 });
(0, openapi_1.doc)('put', '/customers/location', { tags: ['Customer'], summary: 'Save the current location', body: customer_validation_1.customerLocationSchema, status: 200 });
(0, openapi_1.doc)('get', '/customers/addresses', { tags: ['Customer'], summary: 'List saved addresses' });
(0, openapi_1.doc)('post', '/customers/addresses', { tags: ['Customer'], summary: 'Add an address', body: customer_validation_1.addressSchema });
(0, openapi_1.doc)('put', '/customers/addresses/{id}', { tags: ['Customer'], summary: 'Update an address', params: query_validation_1.idParam, body: customer_validation_1.addressSchema, status: 200 });
(0, openapi_1.doc)('delete', '/customers/addresses/{id}', { tags: ['Customer'], summary: 'Delete an address', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/customers/cart', { tags: ['Customer'], summary: 'Get the active cart with live pricing and stock issues' });
(0, openapi_1.doc)('post', '/customers/cart/items', { tags: ['Customer'], summary: 'Add an item (one store per cart)', body: customer_validation_1.addToCartSchema });
(0, openapi_1.doc)('put', '/customers/cart/items/{id}', { tags: ['Customer'], summary: 'Change item quantity', params: query_validation_1.idParam, body: customer_validation_1.updateCartItemSchema, status: 200 });
(0, openapi_1.doc)('delete', '/customers/cart/items/{id}', { tags: ['Customer'], summary: 'Remove a cart item', params: query_validation_1.idParam });
(0, openapi_1.doc)('delete', '/customers/cart', { tags: ['Customer'], summary: 'Clear the cart' });
(0, openapi_1.doc)('post', '/customers/prescriptions', { tags: ['Customer'], summary: 'Upload a prescription file', multipart: true });
(0, openapi_1.doc)('post', '/customers/orders', { tags: ['Customer'], summary: 'Checkout — reserves stock and books the pickup slot', body: customer_validation_1.checkoutSchema });
(0, openapi_1.doc)('get', '/customers/orders', { tags: ['Customer'], summary: 'Order history', query: customer_validation_1.customerOrderListQuery, paginated: true });
(0, openapi_1.doc)('get', '/customers/orders/{id}', { tags: ['Customer'], summary: 'Order detail with status timeline', params: query_validation_1.idParam });
(0, openapi_1.doc)('post', '/customers/orders/{id}/cancel', { tags: ['Customer'], summary: 'Cancel an order and release stock', params: query_validation_1.idParam, body: customer_validation_1.cancelOrderSchema, status: 200 });
(0, openapi_1.doc)('get', '/customers/favorites', { tags: ['Customer'], summary: 'Favourite stores and products' });
(0, openapi_1.doc)('post', '/customers/favorites', { tags: ['Customer'], summary: 'Toggle a favourite', body: customer_validation_1.favoriteSchema, status: 200 });
(0, openapi_1.doc)('post', '/customers/reviews', { tags: ['Customer'], summary: 'Review a store after a completed order', body: customer_validation_1.reviewSchema });
(0, openapi_1.doc)('get', '/customers/dashboard', { tags: ['Customer'], summary: 'Customer dashboard' });
exports.default = router;
//# sourceMappingURL=customer.routes.js.map