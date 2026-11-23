import { z } from 'zod';
import { passwordSchema, phoneSchema } from '../auth/auth.validation';

export const inviteStaffSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema,
  password: passwordSchema,
  roleId: z.string().uuid(),
});

export const staffStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
