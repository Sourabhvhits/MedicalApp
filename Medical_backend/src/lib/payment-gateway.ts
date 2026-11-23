import { isProviderConfigured, resolvePaymentConfig } from './provider-credentials';
import { logger } from './logger';

/**
 * Online payment seam. No provider is wired by default — same pattern as
 * `sms.ts`: the app works fully on cash/UPI/card-at-store until real keys are
 * set (via an admin-saved credential, TASKS.md #16, or `.env`), at which
 * point implement the three functions below against the chosen provider's
 * SDK (Razorpay and Stripe are the common picks — see TASKS.md #2) without
 * touching any calling code.
 *
 * `checkout()` in `order.service.ts` already refuses `paymentMode: 'ONLINE'`
 * while this reports unconfigured, so an order can never end up stuck in a
 * "pay online" state with no way to actually collect payment.
 */

export async function isPaymentGatewayConfigured(): Promise<boolean> {
  return isProviderConfigured('PAYMENT_GATEWAY', await resolvePaymentConfig());
}

export interface GatewayOrder {
  gatewayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
}

/** Creates a payable order with the provider. `amount` is in rupees. */
export async function createGatewayOrder(_amount: number, _receipt: string): Promise<GatewayOrder> {
  const config = await resolvePaymentConfig();
  if (!isProviderConfigured('PAYMENT_GATEWAY', config)) {
    throw new Error('Online payment gateway is not configured');
  }
  // TODO: call the provider's order-create API (e.g. `razorpay.orders.create`)
  // and return its order id alongside the publishable key id the frontend
  // checkout widget needs.
  throw new Error(`PAYMENT_GATEWAY provider=${config.provider} is set but no adapter is implemented yet`);
}

/** Verifies a webhook payload actually came from the configured provider. */
export async function verifyWebhookSignature(
  _rawBody: Buffer,
  _signatureHeader: string | undefined,
): Promise<boolean> {
  const config = await resolvePaymentConfig();
  if (!config.webhookSecret) {
    logger.warn('Payment webhook received but no webhook secret is configured');
    return false;
  }
  // TODO: HMAC-verify `_rawBody` against `_signatureHeader` using
  // `config.webhookSecret`, per the provider's documented scheme.
  return false;
}
