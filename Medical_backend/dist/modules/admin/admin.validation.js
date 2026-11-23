"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardQuery = exports.auditLogQuery = exports.settingsUpdateSchema = exports.roleUpdateSchema = exports.roleCreateSchema = exports.userStatusSchema = exports.adminUserUpdateSchema = exports.adminUserCreateSchema = exports.userListQuery = exports.approvalDecisionSchema = exports.approvalListQuery = void 0;
const zod_1 = require("zod");
const query_validation_1 = require("../../common/query.validation");
const auth_validation_1 = require("../auth/auth.validation");
exports.approvalListQuery = query_validation_1.paginationQuery.extend({
    approvalStatus: query_validation_1.approvalStatusEnum.optional(),
    city: zod_1.z.string().trim().max(100).optional(),
    state: zod_1.z.string().trim().max(100).optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
});
exports.approvalDecisionSchema = zod_1.z
    .object({
    decision: zod_1.z.enum(['APPROVED', 'REJECTED', 'UNDER_REVIEW', 'SUSPENDED']),
    reason: zod_1.z.string().trim().max(500).optional(),
})
    .superRefine((data, ctx) => {
    if ((data.decision === 'REJECTED' || data.decision === 'SUSPENDED') && !data.reason) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['reason'],
            message: 'A reason is required when rejecting or suspending',
        });
    }
});
exports.userListQuery = query_validation_1.paginationQuery.extend({
    userType: zod_1.z.enum(['SUPER_ADMIN', 'ADMIN_STAFF', 'VENDOR', 'RETAILER', 'CUSTOMER']).optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
});
exports.adminUserCreateSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(2).max(100),
    lastName: zod_1.z.string().trim().max(100).optional(),
    email: zod_1.z.string().trim().toLowerCase().email(),
    phone: auth_validation_1.phoneSchema,
    password: auth_validation_1.passwordSchema,
    roleIds: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'Assign at least one role'),
});
exports.adminUserUpdateSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(2).max(100).optional(),
    lastName: zod_1.z.string().trim().max(100).optional(),
    phone: auth_validation_1.phoneSchema.optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    roleIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.userStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
    reason: zod_1.z.string().trim().max(500).optional(),
});
exports.roleCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(80),
    description: zod_1.z.string().trim().max(255).optional(),
    scope: zod_1.z.enum(['SUPER_ADMIN', 'ADMIN_STAFF', 'VENDOR', 'RETAILER', 'CUSTOMER']).default('ADMIN_STAFF'),
    permissionCodes: zod_1.z.array(zod_1.z.string().max(80)).default([]),
});
exports.roleUpdateSchema = exports.roleCreateSchema.partial();
exports.settingsUpdateSchema = zod_1.z.object({
    settings: zod_1.z
        .array(zod_1.z.object({
        key: zod_1.z.string().trim().min(1).max(120),
        value: zod_1.z.string().max(5000),
    }))
        .min(1),
});
exports.auditLogQuery = query_validation_1.paginationQuery.merge(query_validation_1.dateRangeQuery).extend({
    module: zod_1.z.string().trim().max(60).optional(),
    action: zod_1.z.string().trim().max(80).optional(),
    userId: zod_1.z.string().uuid().optional(),
    recordId: zod_1.z.string().trim().max(64).optional(),
});
exports.dashboardQuery = query_validation_1.dateRangeQuery.extend({
    days: zod_1.z.coerce.number().int().min(1).max(365).default(30),
});
//# sourceMappingURL=admin.validation.js.map