import type { NotificationChannel, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { logger } from '../../lib/logger';
import { renderTemplate as renderEmailShell, sendMail } from '../../lib/mailer';
import { sendSms } from '../../lib/sms';
import { NOTIFICATION_EVENTS } from '../../config/constants';

export interface NotifyInput {
  userId: string;
  event: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  channels?: NotificationChannel[];
  /** Whose custom wording (TASKS.md #15) should override the copy above, if any is set. */
  scope?: { vendorId?: string; retailerId?: string };
}

/** Fills `{{key}}` tokens in a template string from a flat data object. Unknown keys are left blank. */
function fillPlaceholders(template: string, data: Prisma.InputJsonValue | undefined): string {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return template;
  const values = data as Record<string, unknown>;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    values[key] === undefined || values[key] === null ? '' : String(values[key]),
  );
}

/**
 * A store's own override for this event beats the platform default; neither
 * existing falls back to the caller-supplied title/body (today's behaviour).
 */
async function resolveCopy(input: NotifyInput): Promise<{ title: string; body: string }> {
  const storeWhere = input.scope?.vendorId
    ? { event: input.event, scope: 'VENDOR' as const, vendorId: input.scope.vendorId, isActive: true }
    : input.scope?.retailerId
      ? { event: input.event, scope: 'RETAILER' as const, retailerId: input.scope.retailerId, isActive: true }
      : null;

  const template =
    (storeWhere ? await prisma.notificationTemplate.findFirst({ where: storeWhere }) : null) ??
    (await prisma.notificationTemplate.findFirst({
      where: { event: input.event, scope: 'PLATFORM', isActive: true },
    }));

  if (!template) return { title: input.title, body: input.body };
  return {
    title: fillPlaceholders(template.titleTemplate, input.data),
    body: fillPlaceholders(template.bodyTemplate, input.data),
  };
}

/**
 * Central notification dispatcher. Always records an in-app notification and
 * fans out to the requested channels. Delivery failures are recorded on the
 * row and never propagate to the calling business flow.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const channels = input.channels?.length ? input.channels : (['IN_APP'] as NotificationChannel[]);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, phone: true, firstName: true },
  });
  if (!user) {
    logger.warn({ userId: input.userId, event: input.event }, 'Notification skipped — user not found');
    return;
  }

  const { title, body } = await resolveCopy(input);

  for (const channel of channels) {
    const record = await prisma.notification.create({
      data: {
        userId: user.id,
        channel,
        event: input.event,
        title,
        body,
        data: input.data,
        status: channel === 'IN_APP' ? 'SENT' : 'QUEUED',
        sentAt: channel === 'IN_APP' ? new Date() : null,
      },
    });

    if (channel === 'IN_APP') continue;

    try {
      if (channel === 'EMAIL' && user.email) {
        await sendMail({
          to: user.email,
          subject: title,
          html: renderEmailShell(title, `<p>Hi ${user.firstName},</p><p>${body}</p>`),
          text: body,
        });
      } else if (channel === 'SMS' && user.phone) {
        await sendSms(user.phone, `${title}: ${body}`);
      } else if (channel === 'PUSH') {
        logger.debug({ userId: user.id }, 'Push channel not configured — stored as in-app only');
      }

      await prisma.notification.update({
        where: { id: record.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (error) {
      logger.error({ err: error, channel, event: input.event }, 'Notification delivery failed');
      await prisma.notification.update({
        where: { id: record.id },
        data: { status: 'FAILED', error: (error as Error).message.slice(0, 500) },
      });
    }
  }
}

/** Fire-and-forget variant for use inside request handlers. */
export function notifyAsync(input: NotifyInput): void {
  void notify(input).catch((error) =>
    logger.error({ err: error, event: input.event }, 'notifyAsync failed'),
  );
}

/** Notifies every super admin — used for approvals and platform-level alerts. */
export async function notifyAdmins(input: Omit<NotifyInput, 'userId'>): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { userType: 'SUPER_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  await Promise.all(admins.map((admin) => notify({ ...input, userId: admin.id })));
}

/**
 * Restock alert (TASKS.md #28) — tells every customer who favourited this
 * product (either generally, or at this exact store) that it's back in
 * stock. Callers are responsible for only calling this on a genuine
 * 0 → positive transition, not on every stock-in.
 */
export async function notifyBackInStock(retailerId: string, productId: string): Promise<void> {
  const favorites = await prisma.favorite.findMany({
    where: { productId, OR: [{ retailerId: null }, { retailerId }] },
    select: { customer: { select: { userId: true } } },
  });
  if (favorites.length === 0) return;

  const [product, retailer] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { name: true } }),
    prisma.retailer.findUnique({ where: { id: retailerId }, select: { storeName: true } }),
  ]);
  if (!product || !retailer) return;

  const userIds = new Set(favorites.map((favorite) => favorite.customer.userId));
  await Promise.all(
    Array.from(userIds).map((userId) =>
      notify({
        userId,
        event: NOTIFICATION_EVENTS.BACK_IN_STOCK,
        title: 'Back in stock',
        body: `${product.name} is back in stock at ${retailer.storeName}.`,
        data: { productId, productName: product.name, retailerId, storeName: retailer.storeName },
        channels: ['IN_APP'],
        scope: { retailerId },
      }),
    ),
  );
}
