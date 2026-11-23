import { Router } from 'express';
import { z } from 'zod';
import type { ProviderKind } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok, paginated } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { authenticate, requireUserType } from '../../middleware/auth';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { exportQuery, idParam } from '../../common/query.validation';
import { doc } from '../../lib/openapi';
import { sendExport } from '../../utils/export';
import { ApiError } from '../../utils/ApiError';
import { uploader } from '../../middleware/upload';
import { toSignedUrl } from '../../lib/signed-url';
import { documentUpdateSchema, documentUploadSchema } from '../vendors/vendor.validation';
import * as service from './admin.service';
import * as authService from '../auth/auth.service';
import * as providerCredentials from './provider-credential.service';
import mastersRoutes from './masters.routes';
import { createReportRouter } from '../reports/report.routes';
import { adminOrderRouter } from '../orders/order.routes';
import { adminDisputeRouter } from '../disputes/dispute.routes';
import { adminBroadcastRouter } from '../notifications/broadcast.routes';
import { createTemplateRouter } from '../notifications/template.routes';
import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  approvalDecisionSchema,
  approvalListQuery,
  auditLogQuery,
  dashboardQuery,
  kycRequirementCreateSchema,
  kycRequirementUpdateSchema,
  providerCredentialSchema,
  roleCreateSchema,
  roleUpdateSchema,
  settingsUpdateSchema,
  userListQuery,
  userStatusSchema,
} from './admin.validation';

const providerParam = z.object({ provider: z.enum(['SMS', 'EMAIL', 'PAYMENT_GATEWAY']) });

const router = Router();

router.use(authenticate, requireUserType('SUPER_ADMIN', 'ADMIN_STAFF'));

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validate({ query: dashboardQuery }),
  asyncHandler(async (req, res) => ok(res, await service.dashboard(Number(req.query.days ?? 30)))),
);

router.get(
  '/search',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validate({ query: z.object({ q: z.string().trim().min(2).max(120) }) }),
  asyncHandler(async (req, res) => ok(res, await service.globalSearch(req.query.q as string))),
);

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

router.get(
  '/vendors',
  requirePermission(PERMISSIONS.VENDOR_VIEW),
  validate({ query: approvalListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listVendors(req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

router.get(
  '/vendors/:id',
  requirePermission(PERMISSIONS.VENDOR_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await service.getVendor(req.params.id))),
);

router.patch(
  '/vendors/:id/approval',
  requirePermission(PERMISSIONS.VENDOR_APPROVE),
  validate({ params: idParam, body: approvalDecisionSchema }),
  asyncHandler(async (req, res) => {
    const before = await service.getVendor(req.params.id);
    const vendor = await service.decideVendor(
      req.params.id,
      req.body.decision,
      req.body.reason,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: `vendor.${req.body.decision.toLowerCase()}`,
      module: AUDIT_MODULES.VENDOR,
      recordId: vendor.id,
      oldValue: { approvalStatus: before.approvalStatus },
      newValue: { approvalStatus: vendor.approvalStatus, reason: req.body.reason },
    });
    return ok(res, vendor, `Vendor ${req.body.decision.toLowerCase()}`);
  }),
);

// ---------------------------------------------------------------------------
// Retailers
// ---------------------------------------------------------------------------

router.get(
  '/retailers',
  requirePermission(PERMISSIONS.RETAILER_VIEW),
  validate({ query: approvalListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listRetailers(req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

router.get(
  '/retailers/:id',
  requirePermission(PERMISSIONS.RETAILER_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await service.getRetailer(req.params.id))),
);

router.patch(
  '/retailers/:id/approval',
  requirePermission(PERMISSIONS.RETAILER_APPROVE),
  validate({ params: idParam, body: approvalDecisionSchema }),
  asyncHandler(async (req, res) => {
    const before = await service.getRetailer(req.params.id);
    const retailer = await service.decideRetailer(
      req.params.id,
      req.body.decision,
      req.body.reason,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: `retailer.${req.body.decision.toLowerCase()}`,
      module: AUDIT_MODULES.RETAILER,
      recordId: retailer.id,
      oldValue: { approvalStatus: before.approvalStatus },
      newValue: { approvalStatus: retailer.approvalStatus, reason: req.body.reason },
    });
    return ok(res, retailer, `Medical shop ${req.body.decision.toLowerCase()}`);
  }),
);

// ---------------------------------------------------------------------------
// KYC documents
// ---------------------------------------------------------------------------

const documentReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().trim().max(500).optional(),
});

const documentOwnerParam = z.object({ ownerType: z.enum(['vendor', 'retailer']), id: z.string().uuid() });
const vendorDocUpload = uploader('vendor-documents');
const shopDocUpload = uploader('shop-documents');

router.patch(
  '/documents/:ownerType/:id',
  // Was `requirePermission(VENDOR_APPROVE, RETAILER_APPROVE)` — AND semantics,
  // so reviewing either document type silently required *both* approve
  // permissions. Real pre-existing bug (masked for super-admin, who bypasses
  // permission checks entirely), fixed here as this exact route was already
  // being touched for #20; `requireAnyPermission` is the helper built for
  // "valid for either owner type".
  requireAnyPermission(PERMISSIONS.VENDOR_APPROVE, PERMISSIONS.RETAILER_APPROVE),
  validate({ params: documentOwnerParam, body: documentReviewSchema }),
  asyncHandler(async (req, res) => {
    const document = await service.reviewDocument(
      req.params.ownerType.toUpperCase() as 'VENDOR' | 'RETAILER',
      req.params.id,
      req.body.status,
      req.body.remarks,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: `document.${req.body.status.toLowerCase()}`,
      module: req.params.ownerType === 'vendor' ? AUDIT_MODULES.VENDOR : AUDIT_MODULES.RETAILER,
      recordId: document.id,
      newValue: { status: req.body.status, remarks: req.body.remarks },
    });
    return ok(res, { ...document, fileUrl: toSignedUrl(document.fileUrl) ?? document.fileUrl }, 'Document reviewed');
  }),
);

const documentCreateParam = z.object({ ownerType: z.enum(['vendor', 'retailer']), ownerId: z.string().uuid() });

router.post(
  '/documents/:ownerType/:ownerId',
  requireAnyPermission(PERMISSIONS.VENDOR_APPROVE, PERMISSIONS.RETAILER_APPROVE),
  (req, res, next) => (req.params.ownerType === 'vendor' ? vendorDocUpload : shopDocUpload).single('file')(req, res, next),
  validate({ params: documentCreateParam, body: documentUploadSchema }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('A document file is required');
    const document = await service.createDocument(
      req.params.ownerType.toUpperCase() as 'VENDOR' | 'RETAILER',
      req.params.ownerId,
      req.file,
      req.body,
    );
    await auditFromRequest(req, {
      action: 'document.create',
      module: req.params.ownerType === 'vendor' ? AUDIT_MODULES.VENDOR : AUDIT_MODULES.RETAILER,
      recordId: document.id,
      newValue: { type: document.type, ownerId: req.params.ownerId },
    });
    return created(res, { ...document, fileUrl: toSignedUrl(document.fileUrl) ?? document.fileUrl }, 'Document added');
  }),
);

router.put(
  '/documents/:ownerType/:id',
  requireAnyPermission(PERMISSIONS.VENDOR_APPROVE, PERMISSIONS.RETAILER_APPROVE),
  validate({ params: documentOwnerParam, body: documentUpdateSchema }),
  asyncHandler(async (req, res) => {
    const document = await service.updateDocumentMeta(
      req.params.ownerType.toUpperCase() as 'VENDOR' | 'RETAILER',
      req.params.id,
      req.body,
    );
    await auditFromRequest(req, {
      action: 'document.update',
      module: req.params.ownerType === 'vendor' ? AUDIT_MODULES.VENDOR : AUDIT_MODULES.RETAILER,
      recordId: document.id,
      newValue: req.body,
    });
    return ok(res, { ...document, fileUrl: toSignedUrl(document.fileUrl) ?? document.fileUrl }, 'Document updated');
  }),
);

router.delete(
  '/documents/:ownerType/:id',
  requireAnyPermission(PERMISSIONS.VENDOR_APPROVE, PERMISSIONS.RETAILER_APPROVE),
  validate({ params: documentOwnerParam }),
  asyncHandler(async (req, res) => {
    await service.removeDocument(req.params.ownerType.toUpperCase() as 'VENDOR' | 'RETAILER', req.params.id);
    await auditFromRequest(req, {
      action: 'document.delete',
      module: req.params.ownerType === 'vendor' ? AUDIT_MODULES.VENDOR : AUDIT_MODULES.RETAILER,
      recordId: req.params.id,
    });
    return noContent(res, 'Document removed');
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

router.get(
  '/users',
  requirePermission(PERMISSIONS.USER_VIEW),
  validate({ query: userListQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listUsers(req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

router.get(
  '/users/:id',
  requirePermission(PERMISSIONS.USER_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await service.getUser(req.params.id))),
);

router.post(
  '/users',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate({ body: adminUserCreateSchema }),
  asyncHandler(async (req, res) => {
    const user = await service.createAdminUser(req.body, req.user!.id);
    await auditFromRequest(req, {
      action: 'user.create',
      module: AUDIT_MODULES.USER,
      recordId: user.id,
      newValue: { email: user.email, userType: user.userType },
    });
    return created(res, user, 'Admin user created');
  }),
);

router.put(
  '/users/:id',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate({ params: idParam, body: adminUserUpdateSchema }),
  asyncHandler(async (req, res) => {
    const before = await service.getUser(req.params.id);
    const user = await service.updateUser(req.params.id, req.body);
    await auditFromRequest(req, {
      action: 'user.update',
      module: AUDIT_MODULES.USER,
      recordId: user.id,
      oldValue: before,
      newValue: user,
    });
    return ok(res, user, 'User updated');
  }),
);

router.patch(
  '/users/:id/status',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate({ params: idParam, body: userStatusSchema }),
  asyncHandler(async (req, res) => {
    const before = await service.getUser(req.params.id);
    const user = await service.setUserStatus(req.params.id, req.body.status);
    await auditFromRequest(req, {
      action: 'user.status',
      module: AUDIT_MODULES.USER,
      recordId: user.id,
      oldValue: { status: before.status },
      newValue: { status: user.status, reason: req.body.reason },
    });
    return ok(res, user, 'User status updated');
  }),
);

router.get(
  '/users/:id/sessions',
  requirePermission(PERMISSIONS.USER_VIEW),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await authService.listSessions(req.params.id))),
);

router.delete(
  '/users/:id/sessions/:sessionId',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate({ params: z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await authService.revokeSession(req.params.id, req.params.sessionId);
    await auditFromRequest(req, {
      action: 'user.session_revoke',
      module: AUDIT_MODULES.USER,
      recordId: req.params.id,
      newValue: { sessionId: req.params.sessionId },
    });
    return noContent(res, 'Session revoked');
  }),
);

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

router.get(
  '/roles',
  requirePermission(PERMISSIONS.ROLE_VIEW),
  asyncHandler(async (_req, res) => ok(res, await service.listRoles())),
);

router.get(
  '/permissions',
  requirePermission(PERMISSIONS.ROLE_VIEW),
  asyncHandler(async (_req, res) => ok(res, await service.listPermissions())),
);

router.post(
  '/roles',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate({ body: roleCreateSchema }),
  asyncHandler(async (req, res) => {
    const role = await service.createRole(req.body);
    await auditFromRequest(req, {
      action: 'role.create',
      module: AUDIT_MODULES.USER,
      recordId: role.id,
      newValue: role,
    });
    return created(res, role, 'Role created');
  }),
);

router.put(
  '/roles/:id',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate({ params: idParam, body: roleUpdateSchema }),
  asyncHandler(async (req, res) => {
    const role = await service.updateRole(req.params.id, req.body);
    await auditFromRequest(req, {
      action: 'role.update',
      module: AUDIT_MODULES.USER,
      recordId: role.id,
      newValue: role,
    });
    return ok(res, role, 'Role updated');
  }),
);

router.delete(
  '/roles/:id',
  requirePermission(PERMISSIONS.ROLE_MANAGE),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.deleteRole(req.params.id);
    await auditFromRequest(req, {
      action: 'role.delete',
      module: AUDIT_MODULES.USER,
      recordId: req.params.id,
    });
    return noContent(res, 'Role deleted');
  }),
);

// ---------------------------------------------------------------------------
// Settings & audit log
// ---------------------------------------------------------------------------

router.get(
  '/settings',
  requirePermission(PERMISSIONS.SETTING_VIEW),
  validate({ query: z.object({ group: z.string().trim().max(60).optional() }) }),
  asyncHandler(async (req, res) => ok(res, await service.listSettings(req.query.group as string | undefined))),
);

router.put(
  '/settings',
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate({ body: settingsUpdateSchema }),
  asyncHandler(async (req, res) => {
    const settings = await service.updateSettings(req.body.settings);
    await auditFromRequest(req, {
      action: 'setting.update',
      module: AUDIT_MODULES.SETTING,
      newValue: req.body.settings,
    });
    return ok(res, settings, 'Settings updated');
  }),
);

router.get(
  '/settings/providers',
  requirePermission(PERMISSIONS.SETTING_VIEW),
  asyncHandler(async (_req, res) => ok(res, await providerCredentials.list())),
);

router.put(
  '/settings/providers/:provider',
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate({ params: providerParam, body: providerCredentialSchema }),
  asyncHandler(async (req, res) => {
    const credential = await providerCredentials.upsert(
      req.params.provider as ProviderKind,
      req.body.config,
      req.body.isActive,
      req.user!.id,
    );
    await auditFromRequest(req, {
      action: 'provider_credential.update',
      module: AUDIT_MODULES.SETTING,
      recordId: credential.id,
      newValue: { provider: req.params.provider, isActive: req.body.isActive },
    });
    return ok(res, { id: credential.id, provider: credential.provider, isActive: credential.isActive }, 'Provider credentials saved');
  }),
);

router.post(
  '/settings/providers/:provider/test',
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate({ params: providerParam }),
  asyncHandler(async (req, res) => {
    const result = await providerCredentials.testConnection(req.params.provider as ProviderKind);
    return ok(res, result, result.ok ? 'Test succeeded' : 'Test failed');
  }),
);

router.get(
  '/kyc-requirements',
  requirePermission(PERMISSIONS.SETTING_VIEW),
  validate({ query: z.object({ ownerType: z.enum(['VENDOR', 'RETAILER']).optional() }) }),
  asyncHandler(async (req, res) =>
    ok(res, await service.listKycRequirements(req.query.ownerType as 'VENDOR' | 'RETAILER' | undefined)),
  ),
);

router.patch(
  '/kyc-requirements/:id',
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate({ params: idParam, body: kycRequirementUpdateSchema }),
  asyncHandler(async (req, res) => {
    const requirement = await service.updateKycRequirement(req.params.id, req.body);
    await auditFromRequest(req, {
      action: 'kyc_requirement.update',
      module: AUDIT_MODULES.SETTING,
      recordId: requirement.id,
      newValue: req.body,
    });
    return ok(res, requirement, 'Requirement updated');
  }),
);

router.post(
  '/kyc-requirements',
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate({ body: kycRequirementCreateSchema }),
  asyncHandler(async (req, res) => {
    const requirement = await service.createKycRequirement(
      req.body.ownerType,
      req.body.label,
      req.body.isRequired,
    );
    await auditFromRequest(req, {
      action: 'kyc_requirement.create',
      module: AUDIT_MODULES.SETTING,
      recordId: requirement.id,
      newValue: requirement,
    });
    return created(res, requirement, 'Document type added');
  }),
);

router.get(
  '/audit-logs',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validate({ query: auditLogQuery }),
  asyncHandler(async (req, res) => {
    const { items, meta } = await service.listAuditLogs(req.query as Record<string, unknown>);
    return paginated(res, items, meta);
  }),
);

router.get(
  '/audit-logs/export',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validate({ query: auditLogQuery.merge(exportQuery) }),
  asyncHandler(async (req, res) => {
    const rows = await service.listAuditLogsForExport(req.query as Record<string, unknown>);
    const handled = await sendExport(res, (req.query.format as 'json' | 'csv' | 'excel' | 'pdf') ?? 'csv', {
      filename: 'audit-log',
      title: 'Audit log',
      columns: service.AUDIT_LOG_EXPORT_COLUMNS,
      rows,
    });
    if (!handled) return ok(res, rows);
  }),
);

router.use('/reports', createReportRouter(() => ({ ownerType: 'ADMIN' }), 'Admin'));
router.use('/orders', adminOrderRouter);
router.use('/disputes', adminDisputeRouter);
router.use('/broadcasts', adminBroadcastRouter);
router.use(
  '/notification-templates',
  createTemplateRouter('PLATFORM', '/admin', undefined, {
    view: requirePermission(PERMISSIONS.SETTING_VIEW),
    manage: requirePermission(PERMISSIONS.SETTING_MANAGE),
  }),
);
router.use('/', mastersRoutes);

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

doc('get', '/admin/dashboard', { tags: ['Admin'], summary: 'Platform dashboard cards and charts', query: dashboardQuery });
doc('get', '/admin/search', { tags: ['Admin'], summary: 'Cross-entity search across products, vendors, retailers, users and orders' });
doc('get', '/admin/vendors', { tags: ['Admin'], summary: 'List vendors', query: approvalListQuery, paginated: true });
doc('get', '/admin/vendors/{id}', { tags: ['Admin'], summary: 'Get vendor detail', params: idParam });
doc('patch', '/admin/vendors/{id}/approval', { tags: ['Admin'], summary: 'Approve / reject a vendor', params: idParam, body: approvalDecisionSchema, status: 200 });
doc('get', '/admin/retailers', { tags: ['Admin'], summary: 'List medical shops', query: approvalListQuery, paginated: true });
doc('get', '/admin/retailers/{id}', { tags: ['Admin'], summary: 'Get medical shop detail', params: idParam });
doc('patch', '/admin/retailers/{id}/approval', { tags: ['Admin'], summary: 'Approve / reject a medical shop', params: idParam, body: approvalDecisionSchema, status: 200 });
doc('patch', '/admin/documents/{ownerType}/{id}', { tags: ['Admin'], summary: 'Review a KYC document', body: documentReviewSchema, status: 200 });
doc('post', '/admin/documents/{ownerType}/{ownerId}', { tags: ['Admin'], summary: 'Add a KYC document on behalf of a business', params: documentCreateParam, body: documentUploadSchema, multipart: true });
doc('put', '/admin/documents/{ownerType}/{id}', { tags: ['Admin'], summary: "Edit a KYC document's metadata", params: documentOwnerParam, body: documentUpdateSchema, status: 200 });
doc('delete', '/admin/documents/{ownerType}/{id}', { tags: ['Admin'], summary: 'Remove a KYC document', params: documentOwnerParam });
doc('get', '/admin/users', { tags: ['Admin'], summary: 'List platform users', query: userListQuery, paginated: true });
doc('get', '/admin/users/{id}', { tags: ['Admin'], summary: 'Get user detail', params: idParam });
doc('post', '/admin/users', { tags: ['Admin'], summary: 'Create an admin staff user', body: adminUserCreateSchema });
doc('put', '/admin/users/{id}', { tags: ['Admin'], summary: 'Update a user', params: idParam, body: adminUserUpdateSchema });
doc('patch', '/admin/users/{id}/status', { tags: ['Admin'], summary: 'Activate / suspend a user', params: idParam, body: userStatusSchema, status: 200 });
doc('get', '/admin/users/{id}/sessions', { tags: ['Admin'], summary: 'List a user\'s active sessions', params: idParam });
doc('delete', '/admin/users/{id}/sessions/{sessionId}', { tags: ['Admin'], summary: 'Revoke one of a user\'s sessions' });
doc('get', '/admin/roles', { tags: ['Admin'], summary: 'List roles with permissions' });
doc('get', '/admin/permissions', { tags: ['Admin'], summary: 'List all permissions' });
doc('post', '/admin/roles', { tags: ['Admin'], summary: 'Create a role', body: roleCreateSchema });
doc('put', '/admin/roles/{id}', { tags: ['Admin'], summary: 'Update a role', params: idParam, body: roleUpdateSchema });
doc('delete', '/admin/roles/{id}', { tags: ['Admin'], summary: 'Delete a role', params: idParam });
doc('get', '/admin/settings', { tags: ['Admin'], summary: 'List platform settings' });
doc('put', '/admin/settings', { tags: ['Admin'], summary: 'Update platform settings', body: settingsUpdateSchema, status: 200 });
doc('get', '/admin/settings/providers', { tags: ['Admin'], summary: 'List SMS/email/payment provider credentials (masked)' });
doc('put', '/admin/settings/providers/{provider}', { tags: ['Admin'], summary: 'Save a provider credential (encrypted at rest)', params: providerParam, body: providerCredentialSchema, status: 200 });
doc('post', '/admin/settings/providers/{provider}/test', { tags: ['Admin'], summary: 'Test a saved provider credential', params: providerParam, status: 200 });
doc('get', '/admin/kyc-requirements', { tags: ['Admin'], summary: 'List which KYC documents each business type needs' });
doc('post', '/admin/kyc-requirements', { tags: ['Admin'], summary: 'Define a new document type', body: kycRequirementCreateSchema });
doc('patch', '/admin/kyc-requirements/{id}', { tags: ['Admin'], summary: 'Toggle a KYC document requirement', params: idParam, body: kycRequirementUpdateSchema, status: 200 });
doc('get', '/admin/audit-logs', { tags: ['Admin'], summary: 'Search audit logs', query: auditLogQuery, paginated: true });
doc('get', '/admin/audit-logs/export', { tags: ['Admin'], summary: 'Export filtered audit logs (CSV/Excel/PDF)', query: auditLogQuery.merge(exportQuery) });

export default router;
