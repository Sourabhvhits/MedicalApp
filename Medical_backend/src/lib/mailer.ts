import nodemailer from 'nodemailer';
import { isProviderConfigured, resolveEmailConfig } from './provider-credentials';
import { logger } from './logger';
import { env } from '../config/env';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends an email. With no SMTP configured the message is logged instead, so
 * development and tests never depend on an external provider. Config comes
 * from an admin-saved credential (TASKS.md #16) if one exists, else `.env` —
 * resolved fresh per send so an admin's change takes effect immediately,
 * without needing a cached transporter to be invalidated.
 */
export async function sendMail(input: MailInput): Promise<void> {
  const config = await resolveEmailConfig();
  if (!isProviderConfigured('EMAIL', config)) {
    logger.info({ to: input.to, subject: input.subject }, '[mail:dev] email not sent (SMTP not configured)');
    return;
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || 587,
    secure: Number(config.port) === 465,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  await transport.sendMail({ from: config.from, ...input });
}

export function renderTemplate(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
    <h2 style="margin:0 0 16px;font-size:19px;color:#0f766e">${title}</h2>
    <div style="font-size:14px;line-height:1.6">${bodyHtml}</div>
    <p style="margin-top:28px;font-size:12px;color:#64748b">${env.APP_NAME}</p>
  </div></body></html>`;
}
