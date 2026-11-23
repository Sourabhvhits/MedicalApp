import { Router, type Request } from 'express';
import type { UserType } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import type { StockOwner } from '../inventory/inventory.service';
import * as service from './staff.service';
import { inviteStaffSchema, staffStatusSchema } from './staff.validation';

/**
 * Staff sub-account management, shared between the vendor and retailer
 * routers — same factory pattern as `createInventoryRouter`/
 * `createFinanceRouter`. Mounted at /vendor/staff and /retailer/staff.
 */
export function createStaffRouter(resolveOwner: (req: Request) => StockOwner, roleScope: UserType, tag: string): Router {
  const router = Router();

  router.get(
    '/roles',
    requirePermission(PERMISSIONS.STAFF_VIEW),
    asyncHandler(async (_req, res) => ok(res, await service.listAvailableRoles(roleScope))),
  );

  router.get(
    '/',
    requirePermission(PERMISSIONS.STAFF_VIEW),
    asyncHandler(async (req, res) => ok(res, await service.listStaff(resolveOwner(req)))),
  );

  router.post(
    '/',
    requirePermission(PERMISSIONS.STAFF_MANAGE),
    validate({ body: inviteStaffSchema }),
    asyncHandler(async (req, res) => {
      const staff = await service.inviteStaff(resolveOwner(req), req.body, req.user!.id);
      await auditFromRequest(req, {
        action: 'staff.invite',
        module: AUDIT_MODULES.USER,
        recordId: staff.id,
        newValue: { email: staff.email, roleId: req.body.roleId },
      });
      return created(res, staff, 'Staff member invited');
    }),
  );

  router.patch(
    '/:id/status',
    requirePermission(PERMISSIONS.STAFF_MANAGE),
    validate({ params: idParam, body: staffStatusSchema }),
    asyncHandler(async (req, res) => {
      const staff = await service.setStaffStatus(resolveOwner(req), req.params.id, req.body.status);
      await auditFromRequest(req, {
        action: 'staff.status',
        module: AUDIT_MODULES.USER,
        recordId: staff.id,
        newValue: { status: req.body.status },
      });
      return ok(res, staff, req.body.status === 'ACTIVE' ? 'Staff member activated' : 'Staff member deactivated');
    }),
  );

  doc('get', `/${tag.toLowerCase()}/staff/roles`, { tags: [tag], summary: 'Roles available to offer staff' });
  doc('get', `/${tag.toLowerCase()}/staff`, { tags: [tag], summary: 'List staff sub-accounts' });
  doc('post', `/${tag.toLowerCase()}/staff`, { tags: [tag], summary: 'Invite a staff sub-account', body: inviteStaffSchema });
  doc('patch', `/${tag.toLowerCase()}/staff/{id}/status`, { tags: [tag], summary: 'Activate / deactivate a staff sub-account', params: idParam, body: staffStatusSchema, status: 200 });

  return router;
}
