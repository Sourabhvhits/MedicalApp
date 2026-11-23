import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authLimiter, otpLimiter } from '../../middleware/rateLimit';
import * as controller from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from './auth.validation';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/send-otp', otpLimiter, validate({ body: sendOtpSchema }), controller.sendOtp);
router.post('/verify-otp', authLimiter, validate({ body: verifyOtpSchema }), controller.verifyOtp);
router.post('/refresh', validate({ body: refreshSchema }), controller.refresh);
router.post('/logout', controller.logout);
router.post('/forgot-password', otpLimiter, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);

router.use(authenticate);
router.get('/me', controller.me);
router.post('/change-password', validate({ body: changePasswordSchema }), controller.changePassword);
router.get('/sessions', controller.sessions);
router.delete('/sessions/:id', validate({ params: z.object({ id: z.string().uuid() }) }), controller.revokeSession);

export default router;
