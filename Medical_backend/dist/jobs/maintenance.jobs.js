"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markExpiredBatches = markExpiredBatches;
exports.sendExpiryAlerts = sendExpiryAlerts;
exports.sendLowStockAlerts = sendLowStockAlerts;
exports.sendPickupReminders = sendPickupReminders;
exports.generateUpcomingSlots = generateUpcomingSlots;
exports.cleanupExpiredTokens = cleanupExpiredTokens;
exports.registerMaintenanceJobs = registerMaintenanceJobs;
const prisma_1 = require("../database/prisma");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const time_1 = require("../utils/time");
const money_1 = require("../utils/money");
const constants_1 = require("../config/constants");
const notification_service_1 = require("../modules/notifications/notification.service");
const order_service_1 = require("../modules/orders/order.service");
const pickup_service_1 = require("../modules/retailers/pickup.service");
const index_1 = require("./index");
/**
 * Flags batches whose expiry has passed. Expired stock must never be sellable,
 * so the batch status change also removes it from availability.
 */
async function markExpiredBatches() {
    const expired = await prisma_1.prisma.inventoryBatch.findMany({
        where: { status: 'ACTIVE', expiryDate: { lte: new Date() } },
        select: { id: true, warehouseId: true, productId: true },
    });
    for (const batch of expired) {
        await prisma_1.prisma.inventoryBatch.update({ where: { id: batch.id }, data: { status: 'EXPIRED' } });
        const sellable = await prisma_1.prisma.inventoryBatch.aggregate({
            where: {
                warehouseId: batch.warehouseId,
                productId: batch.productId,
                status: 'ACTIVE',
                expiryDate: { gt: new Date() },
            },
            _sum: { quantity: true, freeQuantity: true, reservedQty: true },
        });
        const available = (sellable._sum.quantity ?? 0) + (sellable._sum.freeQuantity ?? 0) - (sellable._sum.reservedQty ?? 0);
        await prisma_1.prisma.inventory.updateMany({
            where: { warehouseId: batch.warehouseId, productId: batch.productId },
            data: { availableQty: Math.max(0, available) },
        });
    }
    if (expired.length > 0)
        logger_1.logger.info({ count: expired.length }, 'Marked batches as expired');
    return expired.length;
}
/** Daily expiry digest for every vendor and retailer holding at-risk stock. */
async function sendExpiryAlerts() {
    const horizon = (0, time_1.dayjs)().add(Math.max(...constants_1.EXPIRY_BUCKETS), 'day').toDate();
    const batches = await prisma_1.prisma.inventoryBatch.findMany({
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
    const byOwner = new Map();
    for (const batch of batches) {
        const key = batch.vendorId ? `V:${batch.vendorId}` : `R:${batch.retailerId}`;
        const entry = byOwner.get(key) ?? { batches: [], value: 0 };
        entry.batches.push(batch);
        entry.value += (0, money_1.toNumber)(batch.purchasePrice) * (batch.quantity + batch.freeQuantity);
        byOwner.set(key, entry);
    }
    let sent = 0;
    for (const [key, entry] of byOwner) {
        const [type, id] = key.split(':');
        const owner = type === 'V'
            ? await prisma_1.prisma.vendor.findUnique({ where: { id }, select: { userId: true } })
            : await prisma_1.prisma.retailer.findUnique({ where: { id }, select: { userId: true } });
        if (!owner)
            continue;
        const soonest = entry.batches.reduce((min, batch) => (batch.expiryDate < min ? batch.expiryDate : min), entry.batches[0].expiryDate);
        await (0, notification_service_1.notify)({
            userId: owner.userId,
            event: constants_1.NOTIFICATION_EVENTS.EXPIRY_ALERT,
            title: `${entry.batches.length} batch(es) expiring soon`,
            body: `Stock worth ₹${entry.value.toFixed(2)} expires within 90 days. The earliest (${entry.batches[0].product.name}) expires on ${(0, time_1.dayjs)(soonest).format('DD MMM YYYY')}.`,
            data: { batchCount: entry.batches.length, valueAtRisk: entry.value },
            channels: ['IN_APP', 'EMAIL'],
        });
        sent += 1;
    }
    return sent;
}
/** Low-stock digest driven by each product's configured minimum level. */
async function sendLowStockAlerts() {
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT w.ownerType, w.vendorId, w.retailerId, COUNT(*) AS count
    FROM inventory i
    JOIN warehouses w ON w.id = i.warehouseId
    WHERE i.availableQty <= i.minStockAlert
    GROUP BY w.ownerType, w.vendorId, w.retailerId`;
    let sent = 0;
    for (const row of rows) {
        const owner = row.vendorId
            ? await prisma_1.prisma.vendor.findUnique({ where: { id: row.vendorId }, select: { userId: true } })
            : row.retailerId
                ? await prisma_1.prisma.retailer.findUnique({ where: { id: row.retailerId }, select: { userId: true } })
                : null;
        if (!owner)
            continue;
        await (0, notification_service_1.notify)({
            userId: owner.userId,
            event: constants_1.NOTIFICATION_EVENTS.LOW_STOCK,
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
async function sendPickupReminders() {
    const today = (0, time_1.toDateOnly)(new Date());
    const nowMinutes = (0, time_1.dayjs)().hour() * 60 + (0, time_1.dayjs)().minute();
    const orders = await prisma_1.prisma.order.findMany({
        where: {
            status: { in: ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] },
            pickupDate: today,
        },
        select: {
            id: true,
            orderNumber: true,
            pickupStart: true,
            pickupEnd: true,
            customer: { select: { userId: true } },
            retailer: { select: { storeName: true } },
        },
    });
    let sent = 0;
    for (const order of orders) {
        if (!order.pickupStart)
            continue;
        const [hour, minute] = order.pickupStart.split(':').map(Number);
        const startMinutes = hour * 60 + minute;
        const minutesAway = startMinutes - nowMinutes;
        // One reminder inside the hour before the slot opens.
        if (minutesAway <= 60 && minutesAway > 0) {
            const already = await prisma_1.prisma.notification.count({
                where: {
                    userId: order.customer.userId,
                    event: constants_1.NOTIFICATION_EVENTS.PICKUP_REMINDER,
                    createdAt: { gte: (0, time_1.dayjs)().startOf('day').toDate() },
                    body: { contains: order.orderNumber },
                },
            });
            if (already > 0)
                continue;
            await (0, notification_service_1.notify)({
                userId: order.customer.userId,
                event: constants_1.NOTIFICATION_EVENTS.PICKUP_REMINDER,
                title: 'Pickup reminder',
                body: `Your order ${order.orderNumber} can be collected from ${order.retailer.storeName} between ${order.pickupStart} and ${order.pickupEnd}.`,
                data: { orderId: order.id },
                channels: ['IN_APP', 'SMS'],
            });
            sent += 1;
        }
    }
    return sent;
}
/** Pre-generates pickup slots so the customer app never waits on slot creation. */
async function generateUpcomingSlots() {
    const retailers = await prisma_1.prisma.retailer.findMany({
        where: { approvalStatus: 'APPROVED', isActive: true, deletedAt: null },
        select: { id: true, pickupConfig: { select: { advanceDays: true, isEnabled: true } } },
    });
    let generated = 0;
    for (const retailer of retailers) {
        if (!retailer.pickupConfig?.isEnabled)
            continue;
        for (let offset = 0; offset < retailer.pickupConfig.advanceDays; offset += 1) {
            await (0, pickup_service_1.ensureSlotsForDate)(retailer.id, (0, time_1.dayjs)().add(offset, 'day').toDate());
            generated += 1;
        }
    }
    return generated;
}
/** Clears sessions and OTPs that can no longer be used. */
async function cleanupExpiredTokens() {
    const [sessions, otps] = await Promise.all([
        prisma_1.prisma.userSession.deleteMany({ where: { expiresAt: { lt: (0, time_1.dayjs)().subtract(7, 'day').toDate() } } }),
        prisma_1.prisma.otpToken.deleteMany({ where: { expiresAt: { lt: (0, time_1.dayjs)().subtract(1, 'day').toDate() } } }),
    ]);
    return sessions.count + otps.count;
}
function registerMaintenanceJobs() {
    // Expiry housekeeping and alerts — early morning, before trading starts.
    (0, index_1.schedule)('mark-expired-batches', '5 0 * * *', async () => {
        await markExpiredBatches();
    });
    (0, index_1.schedule)('expiry-alerts', '0 8 * * *', async () => {
        await sendExpiryAlerts();
    });
    (0, index_1.schedule)('low-stock-alerts', '30 8 * * *', async () => {
        await sendLowStockAlerts();
    });
    // Pickup reminders run every 15 minutes across the trading day.
    (0, index_1.schedule)('pickup-reminders', '*/15 6-23 * * *', async () => {
        await sendPickupReminders();
    });
    (0, index_1.schedule)('expire-stale-orders', '*/30 * * * *', async () => {
        await (0, order_service_1.expireStaleOrders)(env_1.env.ORDER_AUTO_EXPIRE_HOURS);
    });
    (0, index_1.schedule)('generate-pickup-slots', '15 1 * * *', async () => {
        await generateUpcomingSlots();
    });
    (0, index_1.schedule)('cleanup-tokens', '45 2 * * *', async () => {
        await cleanupExpiredTokens();
    });
}
//# sourceMappingURL=maintenance.jobs.js.map