import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { customerScope, requirePermission, retailerScope } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import * as service from './dispute.service';
import { disputeListQuery, raiseDisputeSchema, resolveDisputeSchema } from './dispute.validation';

/** Customer's own issues. Mounted at /customers/disputes. */
export const customerDisputeRouter = Router();

customerDisputeRouter.post(
  '/orders/:id',
  validate({ params: idParam, body: raiseDisputeSchema }),
  asyncHandler(async (req, res) => {
    const dispute = await service.raiseDispute(
      req.params.id,
      { userId: req.user!.id, role: 'CUSTOMER', scopeId: customerScope(req) },
      req.body.reason,
    );
    await auditFromRequest(req, {
      action: 'dispute.raise',
      module: AUDIT_MODULES.DISPUTE,
      recordId: dispute.id,
      newValue: { orderId: req.params.id, reason: req.body.reason },
    });
    return created(res, dispute, 'Issue raised — the store has been notified');
  }),
);

customerDisputeRouter.get(
  '/',
  validate({ query: disputeListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listDisputes(
      { customerId: customerScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

customerDisputeRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await service.getDispute(req.params.id, { customerId: customerScope(req) })),
  ),
);

/** Read-only view of issues on a store's own orders. Mounted at /retailer/disputes. */
export const retailerDisputeRouter = Router();

retailerDisputeRouter.get(
  '/',
  requirePermission(PERMISSIONS.DISPUTE_VIEW),
  validate({ query: disputeListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listDisputes(
      { retailerId: retailerScope(req) },
      req.query as Record<string, unknown>,
    );
    return paginated(res, items, meta);
  }),
);

retailerDisputeRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.DISPUTE_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await service.getDispute(req.params.id, { retailerId: retailerScope(req) })),
  ),
);

/** Platform-wide review queue. Mounted at /admin/disputes. */
export const adminDisputeRouter = Router();

adminDisputeRouter.get(
  '/',
  requirePermission(PERMISSIONS.DISPUTE_VIEW),
  validate({ query: disputeListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listDisputes({}, req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

adminDisputeRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.DISPUTE_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await service.getDispute(req.params.id))),
);

adminDisputeRouter.patch(
  '/:id/resolve',
  requirePermission(PERMISSIONS.DISPUTE_MANAGE),
  validate({ params: idParam, body: resolveDisputeSchema }),
  asyncHandler(async (req, res) => {
    const dispute = await service.resolveDispute(req.params.id, req.body, req.user!.id);
    await auditFromRequest(req, {
      action: `dispute.${req.body.status.toLowerCase()}`,
      module: AUDIT_MODULES.DISPUTE,
      recordId: dispute.id,
      newValue: { status: req.body.status, resolution: req.body.resolution },
    });
    return ok(res, dispute, req.body.status === 'RESOLVED' ? 'Issue marked resolved' : 'Issue rejected');
  }),
);

doc('post', '/customers/disputes/orders/{id}', { tags: ['Customer'], summary: 'Raise an issue on a completed order', params: idParam, body: raiseDisputeSchema });
doc('get', '/customers/disputes', { tags: ['Customer'], summary: 'List your raised issues', query: disputeListQuery, paginated: true });
doc('get', '/customers/disputes/{id}', { tags: ['Customer'], summary: 'Issue detail', params: idParam });
doc('get', '/retailer/disputes', { tags: ['Retailer'], summary: 'Issues raised on your orders', query: disputeListQuery, paginated: true });
doc('get', '/retailer/disputes/{id}', { tags: ['Retailer'], summary: 'Issue detail', params: idParam });
doc('get', '/admin/disputes', { tags: ['Admin'], summary: 'Platform-wide issue queue', query: disputeListQuery, paginated: true });
doc('get', '/admin/disputes/{id}', { tags: ['Admin'], summary: 'Issue detail', params: idParam });
doc('patch', '/admin/disputes/{id}/resolve', { tags: ['Admin'], summary: 'Resolve or reject an issue', params: idParam, body: resolveDisputeSchema, status: 200 });
