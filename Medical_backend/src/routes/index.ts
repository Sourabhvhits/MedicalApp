import { Router } from 'express';
import { z } from 'zod';
import { isPaymentGatewayConfigured } from '../lib/payment-gateway';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import { getActiveKycRequirements } from '../modules/admin/admin.service';
import authRoutes from '../modules/auth/auth.routes';
import adminRoutes from '../modules/admin/admin.routes';
import productRoutes from '../modules/products/product.routes';
import vendorRoutes from '../modules/vendors/vendor.routes';
import retailerRoutes from '../modules/retailers/retailer.routes';
import customerRoutes from '../modules/customers/customer.routes';
import notificationRoutes from '../modules/notifications/notification.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API is healthy', data: { uptime: process.uptime() } });
});

// Lets the frontend know whether to offer "Pay online" at checkout without
// exposing any secret — see lib/payment-gateway.ts.
router.get(
  '/config/public',
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      message: 'Success',
      data: { onlinePaymentEnabled: await isPaymentGatewayConfigured() },
    });
  }),
);

// Lets the vendor/retailer profile pages know which KYC documents to ask for
// without a business-scoped login — admin-configurable, see TASKS.md #20a.
router.get(
  '/config/kyc-requirements',
  validate({ query: z.object({ ownerType: z.enum(['VENDOR', 'RETAILER']) }) }),
  asyncHandler(async (req, res) => {
    const requirements = await getActiveKycRequirements(req.query.ownerType as 'VENDOR' | 'RETAILER');
    res.json({ success: true, message: 'Success', data: requirements });
  }),
);

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/products', productRoutes);
router.use('/vendor', vendorRoutes);
router.use('/retailer', retailerRoutes);
router.use('/customers', customerRoutes);
router.use('/notifications', notificationRoutes);

export default router;
