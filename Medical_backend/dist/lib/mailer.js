"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
exports.renderTemplate = renderTemplate;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const logger_1 = require("./logger");
let transporter = null;
function getTransporter() {
    if (!env_1.env.SMTP_HOST)
        return null;
    if (transporter)
        return transporter;
    transporter = nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: env_1.env.SMTP_PORT,
        secure: env_1.env.SMTP_PORT === 465,
        auth: env_1.env.SMTP_USER ? { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS } : undefined,
    });
    return transporter;
}
/**
 * Sends an email. With no SMTP configured the message is logged instead, so
 * development and tests never depend on an external provider.
 */
async function sendMail(input) {
    const transport = getTransporter();
    if (!transport) {
        logger_1.logger.info({ to: input.to, subject: input.subject }, '[mail:dev] email not sent (SMTP not configured)');
        return;
    }
    await transport.sendMail({ from: env_1.env.MAIL_FROM, ...input });
}
function renderTemplate(title, bodyHtml) {
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
    <h2 style="margin:0 0 16px;font-size:19px;color:#0f766e">${title}</h2>
    <div style="font-size:14px;line-height:1.6">${bodyHtml}</div>
    <p style="margin-top:28px;font-size:12px;color:#64748b">${env_1.env.APP_NAME}</p>
  </div></body></html>`;
}
//# sourceMappingURL=mailer.js.map