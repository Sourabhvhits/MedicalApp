import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission, retailerScope } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { dateRangeQuery, idParam, paginationQuery } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import * as service from './order.service';

const orderListQuery = paginationQuery.merge(dateRangeQuery).extend({
  status: z
    .enum([
      'PENDING',
      'ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
    ])
    .optional(),
  active: z.coerce.boolean().optional(),
  pickupDate: z.coerce.date().optional(),
});

const statusChangeSchema = z.object({
  status: z.enum([
    'ACCEPTED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED',
    'REJECTED',
    'CANCELLED',
  ]),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  deliveryPartnerName: z.string().trim().max(120).optional(),
  deliveryTrackingNumber: z.string().trim().max(100).optional(),
});

const prescriptionReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(500).optional(),
});

const adminOrderListQuery = orderListQuery.extend({
  storeId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

const forceCancelSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const refundOrderSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1, 'Select at least one item to refund'),
});

const reassignSlotSchema = z.object({
  pickupDate: z.coerce.date(),
  pickupStartTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm'),
});

/** Customer orders as seen by the store. Mounted at /retailer/orders. */
export const retailerOrderRouter = Router();

retailerOrderRouter.get(
  '/',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  validate({ query: orderListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listOrders(
      { retailerId: retailerScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

retailerOrderRouter.get(
  '/board',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  asyncHandler(async (req, res) => {
    const retailerId = retailerScope(req);
    const grouped = await prisma.order.groupBy({
      by: ['status'],
      where: { retailerId },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    return ok(
      res,
      grouped.map((row) => ({
        status: row.status,
        count: row._count._all,
        amount: row._sum.totalAmount,
      })),
    );
  }),
);

retailerOrderRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await service.getOrder(req.params.id, { retailerId: retailerScope(req) })),
  ),
);

retailerOrderRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ params: idParam, body: statusChangeSchema }),
  asyncHandler(async (req, res) => {
    // Scope check before the shared state machine runs.
    await service.getOrder(req.params.id, { retailerId: retailerScope(req) });

    const order = await service.changeStatus(
      req.params.id,
      req.body.status,
      { userId: req.user!.id, role: 'RETAILER' },
      {
        reason: req.body.reason,
        notes: req.body.notes,
        deliveryPartnerName: req.body.deliveryPartnerName,
        deliveryTrackingNumber: req.body.deliveryTrackingNumber,
      },
    );

    await auditFromRequest(req, {
      action: `order.${req.body.status.toLowerCase()}`,
      module: AUDIT_MODULES.ORDER,
      recordId: order.id,
      newValue: { status: req.body.status, reason: req.body.reason },
    });
    return ok(res, order, `Order marked ${req.body.status.replace(/_/g, ' ').toLowerCase()}`);
  }),
);

retailerOrderRouter.patch(
  '/:id/prescription',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ params: idParam, body: prescriptionReviewSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.reviewPrescription(
      req.params.id,
      retailerScope(req),
      req.body,
      req.user!.id,
    );

    await auditFromRequest(req, {
      action: `order.prescription_${req.body.status.toLowerCase()}`,
      module: AUDIT_MODULES.ORDER,
      recordId: order.id,
      newValue: { prescriptionStatus: req.body.status, reason: req.body.reason },
    });
    return ok(
      res,
      order,
      req.body.status === 'APPROVED' ? 'Prescription approved' : 'Prescription rejected',
    );
  }),
);

retailerOrderRouter.post(
  '/:id/refund',
  requirePermission(PERMISSIONS.FINANCE_MANAGE),
  validate({ params: idParam, body: refundOrderSchema }),
  asyncHandler(async (req, res) => {
    const record = await service.issueRefund(retailerScope(req), req.params.id, req.body);

    await auditFromRequest(req, {
      action: 'order.refund',
      module: AUDIT_MODULES.ORDER,
      recordId: record.id,
      newValue: record,
    });
    return created(res, record, 'Refund issued');
  }),
);

doc('get', '/retailer/orders',{ tags: ['Retailer'], summary: 'List customer orders', query: orderListQuery, paginated: true });
doc('get', '/retailer/orders/board', { tags: ['Retailer'], summary: 'Order counts and value by status' });
doc('get', '/retailer/orders/{id}', { tags: ['Retailer'], summary: 'Customer order detail with batch allocations', params: idParam });
doc('patch', '/retailer/orders/{id}/status', { tags: ['Retailer'], summary: 'Accept, prepare, ready, hand over or reject an order', params: idParam, body: statusChangeSchema, status: 200 });
doc('patch', '/retailer/orders/{id}/prescription', { tags: ['Retailer'], summary: 'Approve or reject the prescription attached to an order', params: idParam, body: prescriptionReviewSchema, status: 200 });
doc('post', '/retailer/orders/{id}/refund', { tags: ['Retailer'], summary: 'Issue a full or partial refund on a completed order', params: idParam, body: refundOrderSchema, status: 201 });

/**
 * Admin's platform-wide view over every order — same detail shape the
 * retailer sees, plus two override actions gated behind
 * `ORDER_ADMIN_OVERRIDE` (granted to super-admin only by default). Mounted at
 * /admin/orders.
 */
export const adminOrderRouter = Router();

adminOrderRouter.get(
  '/',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  validate({ query: adminOrderListQuery }),
  asyncHandler(async (req, res) => {
    const { storeId, customerId, ...rest } = req.query as Record<string, unknown>;
    const { items, meta } = await service.listOrders(
      { retailerId: storeId as string | undefined, customerId: customerId as string | undefined },
      rest,
    );
    return paginated(res, items, meta);
  }),
);

adminOrderRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await service.getOrder(req.params.id))),
);

adminOrderRouter.patch(
  '/:id/cancel',
  requirePermission(PERMISSIONS.ORDER_ADMIN_OVERRIDE),
  validate({ params: idParam, body: forceCancelSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.adminForceCancel(req.params.id, req.body.reason, req.user!.id);
    await auditFromRequest(req, {
      action: 'order.admin_cancel',
      module: AUDIT_MODULES.ORDER,
      recordId: order.id,
      newValue: { status: 'CANCELLED', reason: req.body.reason },
    });
    return ok(res, order, 'Order cancelled');
  }),
);

adminOrderRouter.patch(
  '/:id/reassign-slot',
  requirePermission(PERMISSIONS.ORDER_ADMIN_OVERRIDE),
  validate({ params: idParam, body: reassignSlotSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.adminReassignSlot(req.params.id, req.body, req.user!.id);
    await auditFromRequest(req, {
      action: 'order.admin_reassign_slot',
      module: AUDIT_MODULES.ORDER,
      recordId: order.id,
      newValue: { pickupDate: req.body.pickupDate, pickupStartTime: req.body.pickupStartTime },
    });
    return ok(res, order, 'Pickup slot reassigned');
  }),
);

doc('get', '/admin/orders', { tags: ['Admin'], summary: 'List every order platform-wide', query: adminOrderListQuery, paginated: true });
doc('get', '/admin/orders/{id}', { tags: ['Admin'], summary: 'Order detail (admin view)', params: idParam });
doc('patch', '/admin/orders/{id}/cancel', { tags: ['Admin'], summary: 'Force-cancel an order', params: idParam, body: forceCancelSchema, status: 200 });
doc('patch', '/admin/orders/{id}/reassign-slot', { tags: ['Admin'], summary: 'Reassign an order to a different pickup slot at the same store', params: idParam, body: reassignSlotSchema, status: 200 });
