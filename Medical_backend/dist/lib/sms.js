"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSms = sendSms;
const env_1 = require("../config/env");
const logger_1 = require("./logger");
/**
 * SMS dispatch seam. No provider is wired by default — messages are logged so
 * OTP flows work end to end in development. Implement the provider call here
 * (MSG91 / Twilio / Gupshup) without touching any calling code.
 */
async function sendSms(to, message) {
    if (!env_1.env.SMS_PROVIDER || !env_1.env.SMS_API_KEY) {
        logger_1.logger.info({ to, message }, '[sms:dev] SMS not sent (provider not configured)');
        return;
    }
    logger_1.logger.warn({ provider: env_1.env.SMS_PROVIDER }, 'SMS provider configured but no adapter implemented');
}
//# sourceMappingURL=sms.js.map