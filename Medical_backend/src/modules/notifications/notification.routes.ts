import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, buildMeta } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { getPagination } from '../../utils/pagination';
import { idParam, paginationQuery } from '../../common/query.validation';
import { doc } from '../../lib/openapi';

const router = Router();
router.use(authenticate);

const listQuery = paginationQuery.extend({
  unreadOnly: z.coerce.boolean().default(false),
  event: z.string().trim().max(60).optional(),
});

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = getPagination(req.query);
    const where = {
      userId: req.user!.id,
      channel: 'IN_APP' as const,
      ...(req.query.unreadOnly ? { readAt: null } : {}),
      ...(req.query.event ? { event: req.query.event as string } : {}),
    };

    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, channel: 'IN_APP', readAt: null } }),
    ]);

    return res.json({
      success: true,
      message: 'Success',
      data: items,
      meta: buildMeta(page, limit, total),
      unreadCount: unread,
    });
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) =>
    ok(res, {
      unreadCount: await prisma.notification.count({
        where: { userId: req.user!.id, channel: 'IN_APP', readAt: null },
      }),
    }),
  ),
);

router.patch(
  '/:id/read',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    if (result.count === 0) throw ApiError.notFound('Notification not found');
    return ok(res, { read: true }, 'Marked as read');
  }),
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    return ok(res, { updated: result.count }, 'All notifications marked as read');
  }),
);

doc('get', '/notifications', { tags: ['Notifications'], summary: 'In-app notification feed', query: listQuery, paginated: true });
doc('get', '/notifications/unread-count', { tags: ['Notifications'], summary: 'Unread notification count' });
doc('patch', '/notifications/{id}/read', { tags: ['Notifications'], summary: 'Mark one notification read', params: idParam, status: 200 });
doc('patch', '/notifications/read-all', { tags: ['Notifications'], summary: 'Mark every notification read', status: 200 });

export default router;
