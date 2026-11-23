import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().max(100).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema,
    password: passwordSchema,
    userType: z.enum(['CUSTOMER', 'VENDOR', 'RETAILER']),
    // Vendor / retailer business name captured at registration
    businessName: z.string().trim().min(2).max(191).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.userType !== 'CUSTOMER' && !data.businessName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['businessName'],
        message: 'Business name is required for vendor and retailer accounts',
      });
    }
    if (data.userType !== 'CUSTOMER' && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Email is required for vendor and retailer accounts',
      });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile number'),
  password: z.string().min(1, 'Password is required'),
});

export const sendOtpSchema = z.object({
  identifier: z.string().trim().min(3),
  purpose: z.enum(['LOGIN', 'REGISTRATION', 'FORGOT_PASSWORD', 'PHONE_VERIFICATION', 'EMAIL_VERIFICATION']),
});

export const verifyOtpSchema = z.object({
  identifier: z.string().trim().min(3),
  purpose: z.enum(['LOGIN', 'REGISTRATION', 'FORGOT_PASSWORD', 'PHONE_VERIFICATION', 'EMAIL_VERIFICATION']),
  code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the OTP sent to you'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3),
});

export const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(3),
  code: z.string().trim().regex(/^\d{4,8}$/),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
