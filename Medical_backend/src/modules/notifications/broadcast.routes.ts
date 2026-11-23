import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { paginationQuery } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import * as service from './broadcast.service';

const broadcastCreateSchema = z.object({
  segment: z.enum(['ALL_VENDORS', 'ALL_RETAILERS', 'ALL_CUSTOMERS', 'EVERYONE']),
  title: z.string().trim().min(3).max(191),
  body: z.string().trim().min(3).max(2000),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SMS'])).min(1).default(['IN_APP']),
});

/** Mounted at /admin/broadcasts. */
export const adminBroadcastRouter = Router();

adminBroadcastRouter.get(
  '/',
  requirePermission(PERMISSIONS.BROADCAST_VIEW),
  validate({ query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listBroadcasts(req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

adminBroadcastRouter.post(
  '/',
  requirePermission(PERMISSIONS.BROADCAST_SEND),
  validate({ body: broadcastCreateSchema }),
  asyncHandler(async (req, res) => {
    const broadcast = await service.sendBroadcast(req.body, req.user!.id);
    await auditFromRequest(req, {
      action: 'broadcast.send',
      module: AUDIT_MODULES.BROADCAST,
      recordId: broadcast.id,
      newValue: { segment: broadcast.segment, title: broadcast.title, recipientCount: broadcast.recipientCount },
    });
    return created(res, broadcast, `Sent to ${broadcast.recipientCount} recipients`);
  }),
);

doc('get', '/admin/broadcasts', { tags: ['Admin'], summary: 'Broadcast history', query: paginationQuery, paginated: true });
doc('post', '/admin/broadcasts', { tags: ['Admin'], summary: 'Send a broadcast to a segment', body: broadcastCreateSchema });
