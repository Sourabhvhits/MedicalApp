"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.refreshSchema = exports.verifyOtpSchema = exports.sendOtpSchema = exports.loginSchema = exports.registerSchema = exports.emailSchema = exports.phoneSchema = exports.passwordSchema = void 0;
const zod_1 = require("zod");
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/\d/, 'Password must contain a number');
exports.phoneSchema = zod_1.z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
exports.emailSchema = zod_1.z.string().trim().toLowerCase().email('Enter a valid email address');
exports.registerSchema = zod_1.z
    .object({
    firstName: zod_1.z.string().trim().min(2).max(100),
    lastName: zod_1.z.string().trim().max(100).optional(),
    email: exports.emailSchema.optional(),
    phone: exports.phoneSchema,
    password: exports.passwordSchema,
    userType: zod_1.z.enum(['CUSTOMER', 'VENDOR', 'RETAILER']),
    // Vendor / retailer business name captured at registration
    businessName: zod_1.z.string().trim().min(2).max(191).optional(),
})
    .superRefine((data, ctx) => {
    if (data.userType !== 'CUSTOMER' && !data.businessName) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['businessName'],
            message: 'Business name is required for vendor and retailer accounts',
        });
    }
    if (data.userType !== 'CUSTOMER' && !data.email) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['email'],
            message: 'Email is required for vendor and retailer accounts',
        });
    }
});
exports.loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(3, 'Enter your email or mobile number'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.sendOtpSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(3),
    purpose: zod_1.z.enum(['LOGIN', 'REGISTRATION', 'FORGOT_PASSWORD', 'PHONE_VERIFICATION', 'EMAIL_VERIFICATION']),
});
exports.verifyOtpSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(3),
    purpose: zod_1.z.enum(['LOGIN', 'REGISTRATION', 'FORGOT_PASSWORD', 'PHONE_VERIFICATION', 'EMAIL_VERIFICATION']),
    code: zod_1.z.string().trim().regex(/^\d{4,8}$/, 'Enter the OTP sent to you'),
});
exports.refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(10).optional(),
});
exports.forgotPasswordSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(3),
});
exports.resetPasswordSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(3),
    code: zod_1.z.string().trim().regex(/^\d{4,8}$/),
    newPassword: exports.passwordSchema,
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: exports.passwordSchema,
});
//# sourceMappingURL=auth.validation.js.map