import { z } from 'zod';
import { approvalStatusEnum, dateRangeQuery, paginationQuery } from '../../common/query.validation';
import { passwordSchema, phoneSchema } from '../auth/auth.validation';

export const approvalListQuery = paginationQuery.extend({
  approvalStatus: approvalStatusEnum.optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const approvalDecisionSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED', 'UNDER_REVIEW', 'SUSPENDED']),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.decision === 'REJECTED' || data.decision === 'SUSPENDED') && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A reason is required when rejecting or suspending',
      });
    }
  });

export const userListQuery = paginationQuery.extend({
  userType: z.enum(['SUPER_ADMIN', 'ADMIN_STAFF', 'VENDOR', 'RETAILER', 'CUSTOMER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
});

export const adminUserCreateSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema,
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).min(1, 'Assign at least one role'),
});

export const adminUserUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: phoneSchema.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export const userStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  reason: z.string().trim().max(500).optional(),
});

export const roleCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).optional(),
  scope: z.enum(['SUPER_ADMIN', 'ADMIN_STAFF', 'VENDOR', 'RETAILER', 'CUSTOMER']).default('ADMIN_STAFF'),
  permissionCodes: z.array(z.string().max(80)).default([]),
});

export const roleUpdateSchema = roleCreateSchema.partial();

export const settingsUpdateSchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(120),
        value: z.string().max(5000),
      }),
    )
    .min(1),
});

export const providerCredentialSchema = z.object({
  config: z.record(z.string(), z.string().max(500)),
  isActive: z.coerce.boolean().default(true),
});

export const auditLogQuery = paginationQuery.merge(dateRangeQuery).extend({
  module: z.string().trim().max(60).optional(),
  action: z.string().trim().max(80).optional(),
  userId: z.string().uuid().optional(),
  recordId: z.string().trim().max(64).optional(),
});

export const dashboardQuery = dateRangeQuery.extend({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const kycRequirementUpdateSchema = z.object({
  isRequired: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const kycRequirementCreateSchema = z.object({
  ownerType: z.enum(['VENDOR', 'RETAILER']),
  label: z.string().trim().min(2).max(60),
  isRequired: z.coerce.boolean().default(false),
});
