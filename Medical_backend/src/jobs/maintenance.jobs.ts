import { prisma } from '../database/prisma';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { dayjs, toDateOnly } from '../utils/time';
import { toNumber } from '../utils/money';
import { EXPIRY_BUCKETS, NOTIFICATION_EVENTS } from '../config/constants';
import { notify } from '../modules/notifications/notification.service';
import { expireStaleOrders } from '../modules/orders/order.service';
import { ensureSlotsForDate } from '../modules/retailers/pickup.service';
import { generateDueRecurringExpenses } from '../modules/finance/finance.service';
import { schedule } from './index';

/**
 * Flags batches whose expiry has passed. Expired stock must never be sellable,
 * so the batch status change also removes it from availability.
 */
export async function markExpiredBatches(): Promise<number> {
  const expired = await prisma.inventoryBatch.findMany({
    where: { status: 'ACTIVE', expiryDate: { lte: new Date() } },
    select: { id: true, warehouseId: true, productId: true },
  });

  for (const batch of expired) {
    await prisma.inventoryBatch.update({ where: { id: batch.id }, data: { status: 'EXPIRED' } });

    const sellable = await prisma.inventoryBatch.aggregate({
      where: {
        warehouseId: batch.warehouseId,
        productId: batch.productId,
        status: 'ACTIVE',
        expiryDate: { gt: new Date() },
      },
      _sum: { quantity: true, freeQuantity: true, reservedQty: true },
    });

    const available =
      (sellable._sum.quantity ?? 0) + (sellable._sum.freeQuantity ?? 0) - (sellable._sum.reservedQty ?? 0);

    await prisma.inventory.updateMany({
      where: { warehouseId: batch.warehouseId, productId: batch.productId },
      data: { availableQty: Math.max(0, available) },
    });
  }

  if (expired.length > 0) logger.info({ count: expired.length }, 'Marked batches as expired');
  return expired.length;
}

/** Daily expiry digest for every vendor and retailer holding at-risk stock. */
export async function sendExpiryAlerts(): Promise<number> {
  const horizon = dayjs().add(Math.max(...EXPIRY_BUCKETS), 'day').toDate();

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      status: 'ACTIVE',
      quantity: { gt: 0 },
      expiryDate: { gt: new Date(), lte: horizon },
    },
    select: {
      vendorId: true,
      retailerId: true,
      quantity: true,
      freeQuantity: true,
      purchasePrice: true,
      expiryDate: true,
      product: { select: { name: true } },
    },
  });

  const byOwner = new Map<string, { userId?: string; batches: typeof batches; value: number }>();

  for (const batch of batches) {
    const key = batch.vendorId ? `V:${batch.vendorId}` : `R:${batch.retailerId}`;
    const entry = byOwner.get(key) ?? { batches: [], value: 0 };
    entry.batches.push(batch);
    entry.value += toNumber(batch.purchasePrice) * (batch.quantity + batch.freeQuantity);
    byOwner.set(key, entry);
  }

  let sent = 0;
  for (const [key, entry] of byOwner) {
    const [type, id] = key.split(':');
    const owner =
      type === 'V'
        ? await prisma.vendor.findUnique({ where: { id }, select: { userId: true } })
        : await prisma.retailer.findUnique({ where: { id }, select: { userId: true } });
    if (!owner) continue;

    const soonest = entry.batches.reduce((min, batch) => (batch.expiryDate < min ? batch.expiryDate : min), entry.batches[0].expiryDate);

    await notify({
      userId: owner.userId,
      event: NOTIFICATION_EVENTS.EXPIRY_ALERT,
      title: `${entry.batches.length} batch(es) expiring soon`,
      body: `Stock worth ₹${entry.value.toFixed(2)} expires within 90 days. The earliest (${entry.batches[0].product.name}) expires on ${dayjs(soonest).format('DD MMM YYYY')}.`,
      data: { batchCount: entry.batches.length, valueAtRisk: entry.value },
      channels: ['IN_APP', 'EMAIL'],
    });
    sent += 1;
  }

  return sent;
}

/** Low-stock digest driven by each product's configured minimum level. */
export async function sendLowStockAlerts(): Promise<number> {
  const rows = await prisma.$queryRaw<
    { ownerType: string; vendorId: string | null; retailerId: string | null; count: bigint }[]
  >`
    SELECT w.ownerType, w.vendorId, w.retailerId, COUNT(*) AS count
    FROM inventory i
    JOIN warehouses w ON w.id = i.warehouseId
    WHERE i.availableQty <= i.minStockAlert
    GROUP BY w.ownerType, w.vendorId, w.retailerId`;

  let sent = 0;
  for (const row of rows) {
    const owner = row.vendorId
      ? await prisma.vendor.findUnique({ where: { id: row.vendorId }, select: { userId: true } })
      : row.retailerId
        ? await prisma.retailer.findUnique({ where: { id: row.retailerId }, select: { userId: true } })
        : null;
    if (!owner) continue;

    await notify({
      userId: owner.userId,
      event: NOTIFICATION_EVENTS.LOW_STOCK,
      title: 'Low stock alert',
      body: `${Number(row.count)} product(s) are at or below their minimum stock level. Reorder to avoid running out.`,
      data: { productCount: Number(row.count) },
      channels: ['IN_APP'],
    });
    sent += 1;
  }

  return sent;
}

/** Reminds customers a few hours before their pickup window opens. */
export async function sendPickupReminders(): Promise<number> {
  const today = toDateOnly(new Date());
  const nowMinutes = dayjs().hour() * 60 + dayjs().minute();

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] },
      pickupDate: today,
    },
    select: {
      id: true,
      retailerId: true,
      orderNumber: true,
      pickupStart: true,
      pickupEnd: true,
      customer: { select: { userId: true } },
      retailer: { select: { storeName: true } },
    },
  });

  let sent = 0;
  for (const order of orders) {
    if (!order.pickupStart) continue;
    const [hour, minute] = order.pickupStart.split(':').map(Number);
    const startMinutes = hour * 60 + minute;
    const minutesAway = startMinutes - nowMinutes;

    // One reminder inside the hour before the slot opens.
    if (minutesAway <= 60 && minutesAway > 0) {
      const already = await prisma.notification.count({
        where: {
          userId: order.customer.userId,
          event: NOTIFICATION_EVENTS.PICKUP_REMINDER,
          createdAt: { gte: dayjs().startOf('day').toDate() },
          body: { contains: order.orderNumber },
        },
      });
      if (already > 0) continue;

      await notify({
        userId: order.customer.userId,
        event: NOTIFICATION_EVENTS.PICKUP_REMINDER,
        title: 'Pickup reminder',
        body: `Your order ${order.orderNumber} can be collected from ${order.retailer.storeName} between ${order.pickupStart} and ${order.pickupEnd}.`,
        data: { orderId: order.id, orderNumber: order.orderNumber, storeName: order.retailer.storeName },
        channels: ['IN_APP', 'SMS'],
        scope: { retailerId: order.retailerId },
      });
      sent += 1;
    }
  }

  return sent;
}

/** Pre-generates pickup slots so the customer app never waits on slot creation. */
export async function generateUpcomingSlots(): Promise<number> {
  const retailers = await prisma.retailer.findMany({
    where: { approvalStatus: 'APPROVED', isActive: true, deletedAt: null },
    select: { id: true, pickupConfig: { select: { advanceDays: true, isEnabled: true } } },
  });

  let generated = 0;
  for (const retailer of retailers) {
    if (!retailer.pickupConfig?.isEnabled) continue;
    for (let offset = 0; offset < retailer.pickupConfig.advanceDays; offset += 1) {
      await ensureSlotsForDate(retailer.id, dayjs().add(offset, 'day').toDate());
      generated += 1;
    }
  }
  return generated;
}

/** Clears sessions and OTPs that can no longer be used. */
export async function cleanupExpiredTokens(): Promise<number> {
  const [sessions, otps] = await Promise.all([
    prisma.userSession.deleteMany({ where: { expiresAt: { lt: dayjs().subtract(7, 'day').toDate() } } }),
    prisma.otpToken.deleteMany({ where: { expiresAt: { lt: dayjs().subtract(1, 'day').toDate() } } }),
  ]);
  return sessions.count + otps.count;
}

export function registerMaintenanceJobs(): void {
  // Expiry housekeeping and alerts — early morning, before trading starts.
  schedule('mark-expired-batches', '5 0 * * *', async () => {
    await markExpiredBatches();
  });

  schedule('expiry-alerts', '0 8 * * *', async () => {
    await sendExpiryAlerts();
  });

  schedule('low-stock-alerts', '30 8 * * *', async () => {
    await sendLowStockAlerts();
  });

  // Pickup reminders run every 15 minutes across the trading day.
  schedule('pickup-reminders', '*/15 6-23 * * *', async () => {
    await sendPickupReminders();
  });

  schedule('expire-stale-orders', '*/30 * * * *', async () => {
    await expireStaleOrders(env.ORDER_AUTO_EXPIRE_HOURS);
  });

  schedule('generate-pickup-slots', '15 1 * * *', async () => {
    await generateUpcomingSlots();
  });

  schedule('cleanup-tokens', '45 2 * * *', async () => {
    await cleanupExpiredTokens();
  });

  // Recurring expenses (rent, subscriptions, etc.) — generate this period's
  // PENDING occurrence once its due date arrives.
  schedule('generate-recurring-expenses', '0 1 * * *', async () => {
    await generateDueRecurringExpenses();
  });
}
