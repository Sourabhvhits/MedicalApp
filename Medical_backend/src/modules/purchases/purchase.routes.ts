import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission, retailerScope, vendorScope } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import * as service from './purchase.service';
import {
  acceptPurchaseOrderSchema,
  createPurchaseOrderSchema,
  dispatchSchema,
  purchaseOrderListQuery,
  purchaseReturnSchema,
  receivePurchaseOrderSchema,
  recordPaymentSchema,
  rejectPurchaseOrderSchema,
  updateStatusSchema,
} from './purchase.validation';

/**
 * Retailer-facing purchase endpoints. Mounted at /retailer/purchases.
 */
export const retailerPurchaseRouter = Router();

retailerPurchaseRouter.get(
  '/',
  requirePermission(PERMISSIONS.PURCHASE_VIEW),
  validate({ query: purchaseOrderListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listPurchaseOrders(
      { retailerId: retailerScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

retailerPurchaseRouter.get(
  '/returns',
  requirePermission(PERMISSIONS.PURCHASE_VIEW),
  validate({ query: purchaseOrderListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listPurchaseReturns(
      { retailerId: retailerScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

retailerPurchaseRouter.post(
  '/returns',
  requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate({ body: purchaseReturnSchema }),
  asyncHandler(async (req, res) => {
    const record = await service.createPurchaseReturn(retailerScope(req), req.body, req.user!.id);
    await auditFromRequest(req, {
      action: 'purchase.return',
      module: AUDIT_MODULES.PURCHASE,
      recordId: record.id,
      newValue: record,
    });
    return created(res, record, 'Purchase return recorded');
  }),
);

retailerPurchaseRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PURCHASE_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await service.getPurchaseOrder(req.params.id, { retailerId: retailerScope(req) })),
  ),
);

retailerPurchaseRouter.post(
  '/',
  requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate({ body: createPurchaseOrderSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.createPurchaseOrder(retailerScope(req), req.body);
    await auditFromRequest(req, {
      action: 'purchase.create',
      module: AUDIT_MODULES.PURCHASE,
      recordId: order.id,
      newValue: { poNumber: order.poNumber, total: order.totalAmount },
    });
    return created(res, order, 'Purchase order placed');
  }),
);

retailerPurchaseRouter.post(
  '/:id/receive',
  requirePermission(PERMISSIONS.PURCHASE_UPDATE),
  validate({ params: idParam, body: receivePurchaseOrderSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.receivePurchaseOrder(
      retailerScope(req),
      req.params.id,
      req.body,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: 'purchase.receive',
      module: AUDIT_MODULES.PURCHASE,
      recordId: order.id,
      newValue: req.body,
    });
    return ok(res, order, 'Stock received and added to inventory');
  }),
);

retailerPurchaseRouter.post(
  '/:id/payments',
  requirePermission(PERMISSIONS.FINANCE_MANAGE),
  validate({ params: idParam, body: recordPaymentSchema }),
  asyncHandler(async (req, res) => {
    const payment = await service.recordPurchasePayment(retailerScope(req), req.params.id, req.body);
    await auditFromRequest(req, {
      action: 'purchase.payment',
      module: AUDIT_MODULES.FINANCE,
      recordId: payment.id,
      newValue: { amount: payment.amount, mode: payment.mode },
    });
    return created(res, payment, 'Payment recorded');
  }),
);

retailerPurchaseRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.PURCHASE_UPDATE),
  validate({ params: idParam, body: updateStatusSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.updateStatus(
      { retailerId: retailerScope(req) },
      req.params.id,
      req.body.status,
    );
    return ok(res, order, 'Purchase order updated');
  }),
);

retailerPurchaseRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.PURCHASE_UPDATE),
  validate({ params: idParam, body: rejectPurchaseOrderSchema.partial() }),
  asyncHandler(async (req, res) => {
    const order = await service.cancelPurchaseOrder(retailerScope(req), req.params.id, req.body.reason);
    await auditFromRequest(req, {
      action: 'purchase.cancel',
      module: AUDIT_MODULES.PURCHASE,
      recordId: order.id,
      newValue: { reason: req.body.reason },
    });
    return ok(res, order, 'Purchase order cancelled');
  }),
);

/**
 * Vendor-facing order endpoints. Mounted at /vendor/orders — these are the
 * wholesale orders a vendor receives from retailers.
 */
export const vendorOrderRouter = Router();

vendorOrderRouter.get(
  '/',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  validate({ query: purchaseOrderListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listPurchaseOrders(
      { vendorId: vendorScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

vendorOrderRouter.get(
  '/returns',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  validate({ query: purchaseOrderListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listPurchaseReturns(
      { vendorId: vendorScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

vendorOrderRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await service.getPurchaseOrder(req.params.id, { vendorId: vendorScope(req) })),
  ),
);

vendorOrderRouter.post(
  '/:id/accept',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ params: idParam, body: acceptPurchaseOrderSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.acceptPurchaseOrder(vendorScope(req), req.params.id, req.body);
    await auditFromRequest(req, {
      action: 'purchase.accept',
      module: AUDIT_MODULES.PURCHASE,
      recordId: order.id,
      newValue: { total: order.totalAmount },
    });
    return ok(res, order, 'Purchase order accepted');
  }),
);

vendorOrderRouter.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ params: idParam, body: rejectPurchaseOrderSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.rejectPurchaseOrder(vendorScope(req), req.params.id, req.body.reason);
    await auditFromRequest(req, {
      action: 'purchase.reject',
      module: AUDIT_MODULES.PURCHASE,
      recordId: order.id,
      newValue: { reason: req.body.reason },
    });
    return ok(res, order, 'Purchase order rejected');
  }),
);

vendorOrderRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ params: idParam, body: updateStatusSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.updateStatus({ vendorId: vendorScope(req) }, req.params.id, req.body.status);
    await auditFromRequest(req, {
      action: 'purchase.status',
      module: AUDIT_MODULES.PURCHASE,
      recordId: order.id,
      newValue: { status: req.body.status },
    });
    return ok(res, order, 'Order status updated');
  }),
);

vendorOrderRouter.post(
  '/:id/dispatch',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ params: idParam, body: dispatchSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.dispatchPurchaseOrder(
      vendorScope(req),
      req.params.id,
      req.body,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: 'purchase.dispatch',
      module: AUDIT_MODULES.PURCHASE,
      recordId: order.id,
      newValue: req.body,
    });
    return ok(res, order, 'Order dispatched and invoice generated');
  }),
);

vendorOrderRouter.post(
  '/:id/invoice',
  requirePermission(PERMISSIONS.FINANCE_MANAGE),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.getPurchaseOrder(req.params.id, { vendorId: vendorScope(req) });
    const invoice = await service.createInvoiceForPurchaseOrder(req.params.id);
    return created(res, invoice, 'Invoice generated');
  }),
);

doc('get', '/retailer/purchases', { tags: ['Retailer'], summary: 'List purchase orders', query: purchaseOrderListQuery, paginated: true });
doc('post', '/retailer/purchases', { tags: ['Retailer'], summary: 'Place a purchase order with a vendor', body: createPurchaseOrderSchema });
doc('get', '/retailer/purchases/{id}', { tags: ['Retailer'], summary: 'Purchase order detail', params: idParam });
doc('post', '/retailer/purchases/{id}/receive', { tags: ['Retailer'], summary: 'Receive stock against a purchase order', params: idParam, body: receivePurchaseOrderSchema, status: 200 });
doc('post', '/retailer/purchases/{id}/payments', { tags: ['Retailer'], summary: 'Record a payment to the vendor', params: idParam, body: recordPaymentSchema });
doc('patch', '/retailer/purchases/{id}/status', { tags: ['Retailer'], summary: 'Update purchase order status', params: idParam, body: updateStatusSchema, status: 200 });
doc('post', '/retailer/purchases/{id}/cancel', { tags: ['Retailer'], summary: 'Cancel a purchase order', params: idParam, status: 200 });
doc('get', '/retailer/purchases/returns', { tags: ['Retailer'], summary: 'List purchase returns', paginated: true });
doc('post', '/retailer/purchases/returns', { tags: ['Retailer'], summary: 'Create a purchase return', body: purchaseReturnSchema });
doc('get', '/vendor/orders', { tags: ['Vendor'], summary: 'List wholesale orders received', query: purchaseOrderListQuery, paginated: true });
doc('get', '/vendor/orders/{id}', { tags: ['Vendor'], summary: 'Wholesale order detail', params: idParam });
doc('post', '/vendor/orders/{id}/accept', { tags: ['Vendor'], summary: 'Accept an order, optionally trimming quantities', params: idParam, body: acceptPurchaseOrderSchema, status: 200 });
doc('post', '/vendor/orders/{id}/reject', { tags: ['Vendor'], summary: 'Reject an order', params: idParam, body: rejectPurchaseOrderSchema, status: 200 });
doc('patch', '/vendor/orders/{id}/status', { tags: ['Vendor'], summary: 'Move an order through the fulfilment states', params: idParam, body: updateStatusSchema, status: 200 });
doc('post', '/vendor/orders/{id}/dispatch', { tags: ['Vendor'], summary: 'Dispatch with batch details — deducts vendor stock', params: idParam, body: dispatchSchema, status: 200 });
doc('post', '/vendor/orders/{id}/invoice', { tags: ['Vendor'], summary: 'Generate the tax invoice', params: idParam });
doc('get', '/vendor/orders/returns', { tags: ['Vendor'], summary: 'List purchase returns raised against this vendor', paginated: true });
