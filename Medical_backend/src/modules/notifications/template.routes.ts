import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import type { TemplateScope } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { noContent, ok } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { doc } from '../../lib/openapi';
import * as service from './template.service';

const templateUpsertSchema = z.object({
  titleTemplate: z.string().trim().min(1).max(191),
  bodyTemplate: z.string().trim().min(1).max(1000),
  isActive: z.coerce.boolean().default(true),
});

const eventParam = z.object({ event: z.string().trim().min(1).max(60) });

/**
 * Notification-template CRUD (TASKS.md #15), mounted three times with a
 * fixed `scope` — PLATFORM under `/admin`, VENDOR under `/vendor`, RETAILER
 * under `/retailer` — each against the same `notification_templates` table.
 */
export function createTemplateRouter(
  scope: TemplateScope,
  basePath: string,
  resolveOwnerId?: (req: Request) => string,
  guards: { view?: RequestHandler; manage?: RequestHandler } = {},
): Router {
  const router = Router();
  const viewGuard: RequestHandler[] = guards.view ? [guards.view] : [];
  const manageGuard: RequestHandler[] = guards.manage ? [guards.manage] : [];

  router.get(
    '/',
    ...viewGuard,
    asyncHandler(async (req, res) => ok(res, await service.listEffective(scope, resolveOwnerId?.(req)))),
  );

  router.put(
    '/:event',
    ...manageGuard,
    validate({ params: eventParam, body: templateUpsertSchema }),
    asyncHandler(async (req, res) => {
      const ownerId = resolveOwnerId?.(req);
      const template = await service.upsert(scope, ownerId, req.params.event, req.body);
      await auditFromRequest(req, {
        action: 'notification_template.set',
        module: AUDIT_MODULES.SETTING,
        recordId: template.id,
        newValue: { event: req.params.event, scope, ownerId, ...req.body },
      });
      return ok(res, template, 'Message updated');
    }),
  );

  router.delete(
    '/:event',
    ...manageGuard,
    validate({ params: eventParam }),
    asyncHandler(async (req, res) => {
      const ownerId = resolveOwnerId?.(req);
      await service.resetToDefault(scope, ownerId, req.params.event);
      await auditFromRequest(req, {
        action: 'notification_template.reset',
        module: AUDIT_MODULES.SETTING,
        newValue: { event: req.params.event, scope, ownerId },
      });
      return noContent(res, 'Reset to the built-in message');
    }),
  );

  doc('get', `${basePath}/notification-templates`, { tags: ['Notifications'], summary: `List customisable event messages (${scope})` });
  doc('put', `${basePath}/notification-templates/{event}`, { tags: ['Notifications'], summary: `Set a custom message for an event (${scope})`, params: eventParam, body: templateUpsertSchema, status: 200 });
  doc('delete', `${basePath}/notification-templates/{event}`, { tags: ['Notifications'], summary: `Reset an event to the built-in message (${scope})`, params: eventParam });

  return router;
}
