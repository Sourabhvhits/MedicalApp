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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../lib/audit");
const constants_1 = require("../../config/constants");
const permissions_1 = require("../../config/permissions");
const query_validation_1 = require("../../common/query.validation");
const openapi_1 = require("../../lib/openapi");
const service = __importStar(require("./admin.service"));
const masters_routes_1 = __importDefault(require("./masters.routes"));
const report_routes_1 = require("../reports/report.routes");
const admin_validation_1 = require("./admin.validation");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.requireUserType)('SUPER_ADMIN', 'ADMIN_STAFF'));
// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
router.get('/dashboard', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.DASHBOARD_VIEW), (0, validate_1.validate)({ query: admin_validation_1.dashboardQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.dashboard(Number(req.query.days ?? 30)))));
// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------
router.get('/vendors', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.VENDOR_VIEW), (0, validate_1.validate)({ query: admin_validation_1.approvalListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listVendors(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/vendors/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.VENDOR_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getVendor(req.params.id))));
router.patch('/vendors/:id/approval', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.VENDOR_APPROVE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: admin_validation_1.approvalDecisionSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const before = await service.getVendor(req.params.id);
    const vendor = await service.decideVendor(req.params.id, req.body.decision, req.body.reason, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: `vendor.${req.body.decision.toLowerCase()}`,
        module: constants_1.AUDIT_MODULES.VENDOR,
        recordId: vendor.id,
        oldValue: { approvalStatus: before.approvalStatus },
        newValue: { approvalStatus: vendor.approvalStatus, reason: req.body.reason },
    });
    return (0, response_1.ok)(res, vendor, `Vendor ${req.body.decision.toLowerCase()}`);
}));
// ---------------------------------------------------------------------------
// Retailers
// ---------------------------------------------------------------------------
router.get('/retailers', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.RETAILER_VIEW), (0, validate_1.validate)({ query: admin_validation_1.approvalListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listRetailers(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/retailers/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.RETAILER_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getRetailer(req.params.id))));
router.patch('/retailers/:id/approval', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.RETAILER_APPROVE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: admin_validation_1.approvalDecisionSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const before = await service.getRetailer(req.params.id);
    const retailer = await service.decideRetailer(req.params.id, req.body.decision, req.body.reason, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: `retailer.${req.body.decision.toLowerCase()}`,
        module: constants_1.AUDIT_MODULES.RETAILER,
        recordId: retailer.id,
        oldValue: { approvalStatus: before.approvalStatus },
        newValue: { approvalStatus: retailer.approvalStatus, reason: req.body.reason },
    });
    return (0, response_1.ok)(res, retailer, `Medical shop ${req.body.decision.toLowerCase()}`);
}));
// ---------------------------------------------------------------------------
// KYC documents
// ---------------------------------------------------------------------------
const documentReviewSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    remarks: zod_1.z.string().trim().max(500).optional(),
});
router.patch('/documents/:ownerType/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.VENDOR_APPROVE, permissions_1.PERMISSIONS.RETAILER_APPROVE), (0, validate_1.validate)({
    params: zod_1.z.object({ ownerType: zod_1.z.enum(['vendor', 'retailer']), id: zod_1.z.string().uuid() }),
    body: documentReviewSchema,
}), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const document = await service.reviewDocument(req.params.ownerType.toUpperCase(), req.params.id, req.body.status, req.body.remarks, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: `document.${req.body.status.toLowerCase()}`,
        module: req.params.ownerType === 'vendor' ? constants_1.AUDIT_MODULES.VENDOR : constants_1.AUDIT_MODULES.RETAILER,
        recordId: document.id,
        newValue: { status: req.body.status, remarks: req.body.remarks },
    });
    return (0, response_1.ok)(res, document, 'Document reviewed');
}));
// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
router.get('/users', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.USER_VIEW), (0, validate_1.validate)({ query: admin_validation_1.userListQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listUsers(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.get('/users/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.USER_VIEW), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.getUser(req.params.id))));
router.post('/users', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.USER_MANAGE), (0, validate_1.validate)({ body: admin_validation_1.adminUserCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = await service.createAdminUser(req.body, req.user.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'user.create',
        module: constants_1.AUDIT_MODULES.USER,
        recordId: user.id,
        newValue: { email: user.email, userType: user.userType },
    });
    return (0, response_1.created)(res, user, 'Admin user created');
}));
router.put('/users/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.USER_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: admin_validation_1.adminUserUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const before = await service.getUser(req.params.id);
    const user = await service.updateUser(req.params.id, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'user.update',
        module: constants_1.AUDIT_MODULES.USER,
        recordId: user.id,
        oldValue: before,
        newValue: user,
    });
    return (0, response_1.ok)(res, user, 'User updated');
}));
router.patch('/users/:id/status', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.USER_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: admin_validation_1.userStatusSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const before = await service.getUser(req.params.id);
    const user = await service.setUserStatus(req.params.id, req.body.status);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'user.status',
        module: constants_1.AUDIT_MODULES.USER,
        recordId: user.id,
        oldValue: { status: before.status },
        newValue: { status: user.status, reason: req.body.reason },
    });
    return (0, response_1.ok)(res, user, 'User status updated');
}));
// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------
router.get('/roles', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ROLE_VIEW), (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, response_1.ok)(res, await service.listRoles())));
router.get('/permissions', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ROLE_VIEW), (0, asyncHandler_1.asyncHandler)(async (_req, res) => (0, response_1.ok)(res, await service.listPermissions())));
router.post('/roles', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ROLE_MANAGE), (0, validate_1.validate)({ body: admin_validation_1.roleCreateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const role = await service.createRole(req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'role.create',
        module: constants_1.AUDIT_MODULES.USER,
        recordId: role.id,
        newValue: role,
    });
    return (0, response_1.created)(res, role, 'Role created');
}));
router.put('/roles/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ROLE_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam, body: admin_validation_1.roleUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const role = await service.updateRole(req.params.id, req.body);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'role.update',
        module: constants_1.AUDIT_MODULES.USER,
        recordId: role.id,
        newValue: role,
    });
    return (0, response_1.ok)(res, role, 'Role updated');
}));
router.delete('/roles/:id', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.ROLE_MANAGE), (0, validate_1.validate)({ params: query_validation_1.idParam }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service.deleteRole(req.params.id);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'role.delete',
        module: constants_1.AUDIT_MODULES.USER,
        recordId: req.params.id,
    });
    return (0, response_1.noContent)(res, 'Role deleted');
}));
// ---------------------------------------------------------------------------
// Settings & audit log
// ---------------------------------------------------------------------------
router.get('/settings', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.SETTING_VIEW), (0, validate_1.validate)({ query: zod_1.z.object({ group: zod_1.z.string().trim().max(60).optional() }) }), (0, asyncHandler_1.asyncHandler)(async (req, res) => (0, response_1.ok)(res, await service.listSettings(req.query.group))));
router.put('/settings', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.SETTING_MANAGE), (0, validate_1.validate)({ body: admin_validation_1.settingsUpdateSchema }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const settings = await service.updateSettings(req.body.settings);
    await (0, audit_1.auditFromRequest)(req, {
        action: 'setting.update',
        module: constants_1.AUDIT_MODULES.SETTING,
        newValue: req.body.settings,
    });
    return (0, response_1.ok)(res, settings, 'Settings updated');
}));
router.get('/audit-logs', (0, rbac_1.requirePermission)(permissions_1.PERMISSIONS.AUDIT_VIEW), (0, validate_1.validate)({ query: admin_validation_1.auditLogQuery }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { items, meta } = await service.listAuditLogs(req.query);
    return (0, response_1.paginated)(res, items, meta);
}));
router.use('/reports', (0, report_routes_1.createReportRouter)(() => ({ ownerType: 'ADMIN' }), 'Admin'));
router.use('/', masters_routes_1.default);
// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------
(0, openapi_1.doc)('get', '/admin/dashboard', { tags: ['Admin'], summary: 'Platform dashboard cards and charts', query: admin_validation_1.dashboardQuery });
(0, openapi_1.doc)('get', '/admin/vendors', { tags: ['Admin'], summary: 'List vendors', query: admin_validation_1.approvalListQuery, paginated: true });
(0, openapi_1.doc)('get', '/admin/vendors/{id}', { tags: ['Admin'], summary: 'Get vendor detail', params: query_validation_1.idParam });
(0, openapi_1.doc)('patch', '/admin/vendors/{id}/approval', { tags: ['Admin'], summary: 'Approve / reject a vendor', params: query_validation_1.idParam, body: admin_validation_1.approvalDecisionSchema, status: 200 });
(0, openapi_1.doc)('get', '/admin/retailers', { tags: ['Admin'], summary: 'List medical shops', query: admin_validation_1.approvalListQuery, paginated: true });
(0, openapi_1.doc)('get', '/admin/retailers/{id}', { tags: ['Admin'], summary: 'Get medical shop detail', params: query_validation_1.idParam });
(0, openapi_1.doc)('patch', '/admin/retailers/{id}/approval', { tags: ['Admin'], summary: 'Approve / reject a medical shop', params: query_validation_1.idParam, body: admin_validation_1.approvalDecisionSchema, status: 200 });
(0, openapi_1.doc)('patch', '/admin/documents/{ownerType}/{id}', { tags: ['Admin'], summary: 'Review a KYC document', body: documentReviewSchema, status: 200 });
(0, openapi_1.doc)('get', '/admin/users', { tags: ['Admin'], summary: 'List platform users', query: admin_validation_1.userListQuery, paginated: true });
(0, openapi_1.doc)('get', '/admin/users/{id}', { tags: ['Admin'], summary: 'Get user detail', params: query_validation_1.idParam });
(0, openapi_1.doc)('post', '/admin/users', { tags: ['Admin'], summary: 'Create an admin staff user', body: admin_validation_1.adminUserCreateSchema });
(0, openapi_1.doc)('put', '/admin/users/{id}', { tags: ['Admin'], summary: 'Update a user', params: query_validation_1.idParam, body: admin_validation_1.adminUserUpdateSchema });
(0, openapi_1.doc)('patch', '/admin/users/{id}/status', { tags: ['Admin'], summary: 'Activate / suspend a user', params: query_validation_1.idParam, body: admin_validation_1.userStatusSchema, status: 200 });
(0, openapi_1.doc)('get', '/admin/roles', { tags: ['Admin'], summary: 'List roles with permissions' });
(0, openapi_1.doc)('get', '/admin/permissions', { tags: ['Admin'], summary: 'List all permissions' });
(0, openapi_1.doc)('post', '/admin/roles', { tags: ['Admin'], summary: 'Create a role', body: admin_validation_1.roleCreateSchema });
(0, openapi_1.doc)('put', '/admin/roles/{id}', { tags: ['Admin'], summary: 'Update a role', params: query_validation_1.idParam, body: admin_validation_1.roleUpdateSchema });
(0, openapi_1.doc)('delete', '/admin/roles/{id}', { tags: ['Admin'], summary: 'Delete a role', params: query_validation_1.idParam });
(0, openapi_1.doc)('get', '/admin/settings', { tags: ['Admin'], summary: 'List platform settings' });
(0, openapi_1.doc)('put', '/admin/settings', { tags: ['Admin'], summary: 'Update platform settings', body: admin_validation_1.settingsUpdateSchema, status: 200 });
(0, openapi_1.doc)('get', '/admin/audit-logs', { tags: ['Admin'], summary: 'Search audit logs', query: admin_validation_1.auditLogQuery, paginated: true });
exports.default = router;
//# sourceMappingURL=admin.routes.js.map