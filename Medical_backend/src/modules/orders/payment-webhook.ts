import { logger } from '../../lib/logger';
import { verifyWebhookSignature } from '../../lib/payment-gateway';

/**
 * Entry point for the payment gateway's webhook, mounted in `app.ts` ahead of
 * the global `express.json()` parser so `rawBody` is untouched for signature
 * verification. Returns `false` for anything that isn't a genuinely
 * signed request from the configured provider — safe no-op until
 * `lib/payment-gateway.ts` has a real provider wired in.
 */
export async function handlePaymentGatewayWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!(await verifyWebhookSignature(rawBody, signatureHeader))) {
    logger.warn('Rejected payment gateway webhook: signature invalid or gateway not configured');
    return false;
  }

  // TODO: once a provider is chosen (see lib/payment-gateway.ts), parse
  // `rawBody` per its documented webhook event shape, look up the order by
  // `gatewayOrderId` and set `paymentStatus` to PAID/FAILED — reusing the
  // customer notification pattern `reviewPrescription` already uses in
  // order.service.ts, not a new one.
  return true;
}
