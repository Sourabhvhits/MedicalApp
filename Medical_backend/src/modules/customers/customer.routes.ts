import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok, paginated } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { validate } from '../../middleware/validate';
import { authenticate, optionalAuth, requireUserType } from '../../middleware/auth';
import { customerScope } from '../../middleware/rbac';
import { uploader, publicUrl } from '../../middleware/upload';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import { availableSlots, slotCalendar } from '../retailers/pickup.service';
import * as orders from '../orders/order.service';
import { customerDisputeRouter } from '../disputes/dispute.routes';
import * as discovery from './discovery.service';
import * as cart from './cart.service';
import * as service from './customer.service';
import {
  addToCartSchema,
  addressSchema,
  cancelOrderSchema,
  checkoutSchema,
  customerLocationSchema,
  customerOrderListQuery,
  customerProfileSchema,
  favoriteSchema,
  nearbyStoresQuery,
  productSearchQuery,
  reorderSchema,
  reviewSchema,
  storeProductsQuery,
  updateCartItemSchema,
} from './customer.validation';

const router = Router();
const prescriptionUpload = uploader('prescriptions');

// ---------------------------------------------------------------------------
// Public discovery — browsing works without an account
// ---------------------------------------------------------------------------

router.get(
  '/stores/nearby',
  optionalAuth,
  validate({ query: nearbyStoresQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await discovery.nearbyStores(req.query as never);
    return paginated(res, items, meta);
  }),
);

router.get(
  '/stores/:id',
  optionalAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await discovery.getStore(req.params.id))),
);

router.get(
  '/stores/:id/products',
  optionalAuth,
  validate({ params: idParam, query: storeProductsQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await discovery.storeProducts(
      req.params.id,
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

router.get(
  '/stores/:id/reviews',
  optionalAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await service.listStoreReviews(req.params.id))),
);

router.get(
  '/stores/:id/pickup-slots',
  optionalAuth,
  validate({
    params: idParam,
    query: z.object({
      date: z.coerce.date().optional(),
      days: z.coerce.number().int().min(1).max(30).default(7),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (req.query.date) {
      return ok(res, await availableSlots(req.params.id, req.query.date as unknown as Date));
    }
    return ok(res, await slotCalendar(req.params.id, Number(req.query.days ?? 7)));
  }),
);

router.get(
  '/products/search',
  optionalAuth,
  validate({ query: productSearchQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta, substitutes } = await discovery.searchProducts(req.query as Record<string, unknown>);
    return paginated(res, items, meta, 'Success', { substitutes });
  }),
);

// ---------------------------------------------------------------------------
// Authenticated customer area
// ---------------------------------------------------------------------------

router.use(authenticate, requireUserType('CUSTOMER'));

router.get(
  '/profile',
  asyncHandler(async (req, res) => ok(res, await service.getProfile(customerScope(req)))),
);

router.put(
  '/profile',
  validate({ body: customerProfileSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await service.updateProfile(customerScope(req), req.user!.id, req.body), 'Profile updated'),
  ),
);

router.put(
  '/location',
  validate({ body: customerLocationSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await service.setLocation(customerScope(req), req.body.latitude, req.body.longitude),
      'Location saved',
    ),
  ),
);

router.get(
  '/addresses',
  asyncHandler(async (req, res) => ok(res, await service.listAddresses(customerScope(req)))),
);

router.post(
  '/addresses',
  validate({ body: addressSchema }),
  asyncHandler(async (req, res) =>
    created(res, await service.addAddress(customerScope(req), req.body), 'Address saved'),
  ),
);

router.put(
  '/addresses/:id',
  validate({ params: idParam, body: addressSchema.partial() }),
  asyncHandler(async (req, res) =>
    ok(res, await service.updateAddress(customerScope(req), req.params.id, req.body), 'Address updated'),
  ),
);

router.delete(
  '/addresses/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.deleteAddress(customerScope(req), req.params.id);
    return noContent(res, 'Address removed');
  }),
);

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

router.get(
  '/cart',
  asyncHandler(async (req, res) => ok(res, await cart.summarizeCart(customerScope(req)))),
);

router.post(
  '/cart/items',
  validate({ body: addToCartSchema }),
  asyncHandler(async (req, res) =>
    created(res, await cart.addItem(customerScope(req), req.body), 'Added to cart'),
  ),
);

router.put(
  '/cart/items/:id',
  validate({ params: idParam, body: updateCartItemSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await cart.updateItem(customerScope(req), req.params.id, req.body.quantity), 'Cart updated'),
  ),
);

router.delete(
  '/cart/items/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await cart.removeItem(customerScope(req), req.params.id), 'Item removed'),
  ),
);

router.delete(
  '/cart',
  asyncHandler(async (req, res) => ok(res, await cart.clearCart(customerScope(req)), 'Cart cleared')),
);

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

router.post(
  '/prescriptions',
  prescriptionUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('A prescription file is required');
    return created(
      res,
      { url: publicUrl('prescriptions', req.file.filename) },
      'Prescription uploaded',
    );
  }),
);

router.post(
  '/orders',
  validate({ body: checkoutSchema }),
  asyncHandler(async (req, res) => {
    const order = await orders.checkout(customerScope(req), req.body);
    await auditFromRequest(req, {
      action: 'order.create',
      module: AUDIT_MODULES.ORDER,
      recordId: order.id,
      newValue: { orderNumber: order.orderNumber, total: order.totalAmount },
    });
    return created(res, order, 'Order placed successfully');
  }),
);

router.get(
  '/orders',
  validate({ query: customerOrderListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await orders.listOrders(
      { customerId: customerScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

router.get(
  '/orders/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await orders.getOrder(req.params.id, { customerId: customerScope(req) })),
  ),
);

router.get(
  '/orders/:id/invoice',
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await orders.getOrderInvoice(customerScope(req), req.params.id)),
  ),
);

router.post(
  '/orders/:id/cancel',
  validate({ params: idParam, body: cancelOrderSchema }),
  asyncHandler(async (req, res) => {
    const order = await orders.cancelByCustomer(
      customerScope(req),
      req.params.id,
      req.body.reason,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: 'order.cancel',
      module: AUDIT_MODULES.ORDER,
      recordId: order.id,
      newValue: { reason: req.body.reason },
    });
    return ok(res, order, 'Order cancelled');
  }),
);

router.post(
  '/orders/:id/reorder',
  validate({ params: idParam, body: reorderSchema }),
  asyncHandler(async (req, res) => {
    const result = await cart.reorder(customerScope(req), req.params.id, req.body.replaceCart);
    const message =
      result.dropped.length > 0
        ? `Added to cart — ${result.dropped.length} item(s) could not be reordered`
        : 'Added to cart';
    return ok(res, result, message);
  }),
);

router.use('/disputes', customerDisputeRouter);

// ---------------------------------------------------------------------------
// Favourites, reviews, dashboard
// ---------------------------------------------------------------------------

router.get(
  '/favorites',
  asyncHandler(async (req, res) => ok(res, await service.listFavorites(customerScope(req)))),
);

router.post(
  '/favorites',
  validate({ body: favoriteSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await service.toggleFavorite(customerScope(req), req.body), 'Favourites updated'),
  ),
);

router.post(
  '/reviews',
  validate({ body: reviewSchema }),
  asyncHandler(async (req, res) =>
    created(res, await service.addReview(customerScope(req), req.body), 'Thanks for your review'),
  ),
);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => ok(res, await service.dashboard(customerScope(req)))),
);

doc('get', '/customers/stores/nearby', { tags: ['Customer'], summary: 'Find nearby medical stores', query: nearbyStoresQuery, paginated: true, auth: false });
doc('get', '/customers/stores/{id}', { tags: ['Customer'], summary: 'Store detail with hours and pickup config', params: idParam, auth: false });
doc('get', '/customers/stores/{id}/products', { tags: ['Customer'], summary: 'Products a store currently has in stock', params: idParam, query: storeProductsQuery, paginated: true, auth: false });
doc('get', '/customers/stores/{id}/reviews', { tags: ['Customer'], summary: 'Store reviews', params: idParam, auth: false });
doc('get', '/customers/stores/{id}/pickup-slots', { tags: ['Customer'], summary: 'Selectable pickup slots', params: idParam, auth: false });
doc('get', '/customers/products/search', { tags: ['Customer'], summary: 'Search products across nearby stores', query: productSearchQuery, paginated: true, auth: false });
doc('get', '/customers/profile', { tags: ['Customer'], summary: 'Customer profile' });
doc('put', '/customers/profile', { tags: ['Customer'], summary: 'Update profile', body: customerProfileSchema, status: 200 });
doc('put', '/customers/location', { tags: ['Customer'], summary: 'Save the current location', body: customerLocationSchema, status: 200 });
doc('get', '/customers/addresses', { tags: ['Customer'], summary: 'List saved addresses' });
doc('post', '/customers/addresses', { tags: ['Customer'], summary: 'Add an address', body: addressSchema });
doc('put', '/customers/addresses/{id}', { tags: ['Customer'], summary: 'Update an address', params: idParam, body: addressSchema, status: 200 });
doc('delete', '/customers/addresses/{id}', { tags: ['Customer'], summary: 'Delete an address', params: idParam });
doc('get', '/customers/cart', { tags: ['Customer'], summary: 'Get the active cart with live pricing and stock issues' });
doc('post', '/customers/cart/items', { tags: ['Customer'], summary: 'Add an item (one store per cart)', body: addToCartSchema });
doc('put', '/customers/cart/items/{id}', { tags: ['Customer'], summary: 'Change item quantity', params: idParam, body: updateCartItemSchema, status: 200 });
doc('delete', '/customers/cart/items/{id}', { tags: ['Customer'], summary: 'Remove a cart item', params: idParam });
doc('delete', '/customers/cart', { tags: ['Customer'], summary: 'Clear the cart' });
doc('post', '/customers/prescriptions', { tags: ['Customer'], summary: 'Upload a prescription file', multipart: true });
doc('post', '/customers/orders', { tags: ['Customer'], summary: 'Checkout — reserves stock and books the pickup slot', body: checkoutSchema });
doc('get', '/customers/orders', { tags: ['Customer'], summary: 'Order history', query: customerOrderListQuery, paginated: true });
doc('get', '/customers/orders/{id}', { tags: ['Customer'], summary: 'Order detail with status timeline', params: idParam });
doc('get', '/customers/orders/{id}/invoice', { tags: ['Customer'], summary: 'GST invoice for a fulfilled order', params: idParam });
doc('post', '/customers/orders/{id}/cancel', { tags: ['Customer'], summary: 'Cancel an order and release stock', params: idParam, body: cancelOrderSchema, status: 200 });
doc('post', '/customers/orders/{id}/reorder', { tags: ['Customer'], summary: 'Rebuild the cart from a past order', params: idParam, body: reorderSchema });
doc('get', '/customers/favorites', { tags: ['Customer'], summary: 'Favourite stores and products' });
doc('post', '/customers/favorites', { tags: ['Customer'], summary: 'Toggle a favourite', body: favoriteSchema, status: 200 });
doc('post', '/customers/reviews', { tags: ['Customer'], summary: 'Review a store after a completed order', body: reviewSchema });
doc('get', '/customers/dashboard', { tags: ['Customer'], summary: 'Customer dashboard' });

export default router;
