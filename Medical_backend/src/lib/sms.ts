import { isProviderConfigured, resolveSmsConfig } from './provider-credentials';
import { logger } from './logger';

/**
 * SMS dispatch seam. No provider is wired by default — messages are logged so
 * OTP flows work end to end in development. Implement the provider call here
 * (MSG91 / Twilio / Gupshup) without touching any calling code. Config comes
 * from an admin-saved credential (TASKS.md #16) if one exists, else `.env`.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  const config = await resolveSmsConfig();
  if (!isProviderConfigured('SMS', config)) {
    logger.info({ to, message }, '[sms:dev] SMS not sent (provider not configured)');
    return;
  }

  logger.warn({ provider: config.provider }, 'SMS provider configured but no adapter implemented');
}
