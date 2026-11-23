"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrder = getOrder;
exports.listOrders = listOrders;
exports.checkout = checkout;
exports.changeStatus = changeStatus;
exports.cancelByCustomer = cancelByCustomer;
exports.expireStaleOrders = expireStaleOrders;
exports.reservedAllocations = reservedAllocations;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const pagination_1 = require("../../utils/pagination");
const money_1 = require("../../utils/money");
const tax_1 = require("../../utils/tax");
const numbering_1 = require("../../utils/numbering");
const time_1 = require("../../utils/time");
const constants_1 = require("../../config/constants");
const notification_service_1 = require("../notifications/notification.service");
const inventory = __importStar(require("../inventory/inventory.service"));
const pickup = __importStar(require("../retailers/pickup.service"));
const cart_service_1 = require("../customers/cart.service");
const DETAIL_INCLUDE = {
    customer: {
        select: {
            id: true,
            code: true,
            user: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
    },
    retailer: {
        select: {
            id: true,
            storeName: true,
            code: true,
            phone: true,
            addressLine1: true,
            city: true,
            state: true,
            pincode: true,
            gstNumber: true,
            latitude: true,
            longitude: true,
        },
    },
    items: {
        include: {
            product: { select: { id: true, name: true, packSize: true, imageUrl: true, prescriptionRequired: true } },
            allocations: { include: { batch: { select: { batchNumber: true, expiryDate: true } } } },
        },
    },
    pickupSlot: { select: { id: true, date: true, startTime: true, endTime: true } },
    statusHistory: { orderBy: { createdAt: 'asc' } },
};
async function getOrder(id, scope) {
    const order = await prisma_1.prisma.order.findFirst({
        where: {
            id,
            ...(scope?.customerId ? { customerId: scope.customerId } : {}),
            ...(scope?.retailerId ? { retailerId: scope.retailerId } : {}),
        },
        include: DETAIL_INCLUDE,
    });
    if (!order)
        throw ApiError_1.ApiError.notFound('Order not found');
    return order;
}
async function listOrders(scope, query) {
    const { page, limit, skip, take } = (0, pagination_1.getPagination)(query);
    const where = {
        ...(scope.customerId ? { customerId: scope.customerId } : {}),
        ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.active ? { status: { in: constants_1.ORDER_RESERVED_STATUSES } } : {}),
    };
    if (query.search) {
        where.OR = [
            { orderNumber: { contains: query.search } },
            { retailer: { storeName: { contains: query.search } } },
        ];
    }
    if (query.dateFrom || query.dateTo) {
        where.createdAt = {
            ...(query.dateFrom ? { gte: (0, time_1.startOfDay)(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: (0, time_1.endOfDay)(query.dateTo) } : {}),
        };
    }
    if (query.pickupDate)
        where.pickupDate = (0, time_1.toDateOnly)(query.pickupDate);
    const [items, total] = await Promise.all([
        prisma_1.prisma.order.findMany({
            where,
            include: {
                retailer: { select: { id: true, storeName: true, phone: true, city: true, addressLine1: true } },
                customer: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
                items: {
                    select: { id: true, productName: true, quantity: true, totalAmount: true },
                    take: 5,
                },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
            skip,
            take,
        }),
        prisma_1.prisma.order.count({ where }),
    ]);
    return { items, meta: (0, response_1.buildMeta)(page, limit, total) };
}
/**
 * Creates a customer order from the active cart.
 *
 * Everything below — slot validation, FEFO allocation, reservation, order rows
 * and the slot booking — runs inside one database transaction with row locks
 * on the batches, so two customers cannot reserve the same units.
 */
async function checkout(customerId, input) {
    const cart = await prisma_1.prisma.cart.findFirst({
        where: { customerId, isActive: true },
        include: {
            retailer: { select: { id: true, storeName: true, userId: true, approvalStatus: true, isActive: true } },
            items: {
                include: {
                    product: { select: { id: true, name: true, packSize: true, status: true, isRecalled: true, prescriptionRequired: true } },
                    retailerProduct: { select: { status: true, deletedAt: true, maxOrderQty: true } },
                },
            },
        },
    });
    if (!cart || cart.items.length === 0)
        throw ApiError_1.ApiError.badRequest('Your cart is empty');
    if (cart.retailer.approvalStatus !== 'APPROVED' || !cart.retailer.isActive) {
        throw ApiError_1.ApiError.badRequest('This store is no longer accepting orders');
    }
    for (const item of cart.items) {
        if (item.retailerProduct.deletedAt || item.retailerProduct.status !== 'ACTIVE') {
            throw ApiError_1.ApiError.badRequest(`${item.product.name} is no longer sold by this store`);
        }
        if (item.product.status !== 'ACTIVE' || item.product.isRecalled) {
            throw ApiError_1.ApiError.badRequest(`${item.product.name} has been blocked or recalled`);
        }
        if (item.quantity > item.retailerProduct.maxOrderQty) {
            throw ApiError_1.ApiError.badRequest(`${item.product.name} is limited to ${item.retailerProduct.maxOrderQty} per order`);
        }
    }
    const needsPrescription = cart.items.some((item) => item.product.prescriptionRequired);
    if (needsPrescription && !input.prescriptionUrl) {
        throw ApiError_1.ApiError.badRequest('This order contains prescription-only medicines — upload a valid prescription to continue');
    }
    // Validated before the transaction so a bad slot fails fast and cheaply.
    const slot = await pickup.validateSlotSelection(cart.retailerId, input.pickupDate, input.pickupStartTime);
    const lines = cart.items.map((item) => ({
        item,
        tax: (0, tax_1.computeLineTax)({
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            gstRate: item.gstRate,
            discountPct: item.discountPct,
            priceIncludesTax: cart_service_1.RETAIL_PRICE_INCLUDES_TAX,
        }),
    }));
    const totals = (0, tax_1.aggregateTax)(lines.map((line) => line.tax));
    const order = await prisma_1.prisma.$transaction(async (tx) => {
        // Re-check slot capacity under the transaction to avoid oversubscription.
        const lockedSlot = await tx.pickupSlot.findUnique({ where: { id: slot.id } });
        if (!lockedSlot || lockedSlot.bookedCount >= lockedSlot.capacity) {
            throw ApiError_1.ApiError.badRequest('The selected pickup slot was just filled — please choose another');
        }
        const warehouseId = await inventory.resolveWarehouse(tx, {
            ownerType: 'RETAILER',
            retailerId: cart.retailerId,
        });
        const orderNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'order');
        const createdOrder = await tx.order.create({
            data: {
                orderNumber,
                customerId,
                retailerId: cart.retailerId,
                pickupSlotId: slot.id,
                pickupDate: (0, time_1.toDateOnly)(input.pickupDate),
                pickupStart: slot.startTime,
                pickupEnd: slot.endTime,
                status: 'PENDING',
                subtotal: totals.subtotal,
                discountAmount: totals.discountAmount,
                taxableAmount: totals.taxableAmount,
                cgstAmount: totals.cgstAmount,
                sgstAmount: totals.sgstAmount,
                igstAmount: totals.igstAmount,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
                paymentMode: input.paymentMode,
                paymentStatus: 'PENDING',
                customerNote: input.customerNote ?? null,
                prescriptionUrl: input.prescriptionUrl ?? null,
            },
        });
        for (const { item, tax } of lines) {
            const orderItem = await tx.orderItem.create({
                data: {
                    orderId: createdOrder.id,
                    productId: item.productId,
                    productName: item.product.name,
                    packSize: item.product.packSize,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    mrp: item.mrp,
                    discountPct: item.discountPct,
                    discountAmount: tax.discountAmount,
                    gstRate: item.gstRate,
                    taxableAmount: tax.taxableAmount,
                    taxAmount: tax.taxAmount,
                    totalAmount: tax.totalAmount,
                },
            });
            // FEFO allocation with SELECT ... FOR UPDATE inside this transaction.
            const allocations = await inventory.allocateFefo(tx, warehouseId, item.productId, item.quantity);
            await inventory.reserveStock(tx, { ownerType: 'RETAILER', retailerId: cart.retailerId }, warehouseId, item.productId, allocations, { referenceType: 'ORDER', referenceId: createdOrder.id });
            await tx.orderItemAllocation.createMany({
                data: allocations.map((allocation) => ({
                    orderItemId: orderItem.id,
                    batchId: allocation.batchId,
                    quantity: allocation.quantity,
                })),
            });
        }
        await tx.orderStatusHistory.create({
            data: { orderId: createdOrder.id, toStatus: 'PENDING', notes: 'Order placed by customer' },
        });
        await tx.pickupSlot.update({
            where: { id: slot.id },
            data: {
                bookedCount: { increment: 1 },
                ...(lockedSlot.bookedCount + 1 >= lockedSlot.capacity ? { status: 'FULL' } : {}),
            },
        });
        await tx.cart.delete({ where: { id: cart.id } });
        return createdOrder;
    }, { timeout: 20_000, isolationLevel: 'ReadCommitted' });
    await (0, notification_service_1.notify)({
        userId: cart.retailer.userId,
        event: constants_1.NOTIFICATION_EVENTS.ORDER_PLACED,
        title: 'New customer order',
        body: `Order ${order.orderNumber} for ₹${(0, money_1.toNumber)(order.totalAmount).toFixed(2)} — pickup ${(0, time_1.dayjs)(order.pickupDate).format('DD MMM')} at ${order.pickupStart}.`,
        data: { orderId: order.id, orderNumber: order.orderNumber },
        channels: ['IN_APP', 'EMAIL'],
    });
    return getOrder(order.id);
}
// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------
function assertTransition(from, to) {
    if (!constants_1.ORDER_TRANSITIONS[from].includes(to)) {
        throw ApiError_1.ApiError.badRequest(`An order cannot move from ${from} to ${to}`);
    }
}
async function reservedAllocations(orderId) {
    const items = await prisma_1.prisma.orderItem.findMany({
        where: { orderId },
        include: { allocations: { where: { released: false, consumed: false } } },
    });
    return items.map((item) => ({ productId: item.productId, allocations: item.allocations }));
}
/** Releases every still-held reservation for an order back to available stock. */
async function releaseReservations(tx, orderId, retailerId, reason) {
    const warehouseId = await inventory.resolveWarehouse(tx, {
        ownerType: 'RETAILER',
        retailerId,
    });
    const items = await tx.orderItem.findMany({
        where: { orderId },
        include: { allocations: { where: { released: false, consumed: false } } },
    });
    for (const item of items) {
        if (item.allocations.length === 0)
            continue;
        await inventory.releaseStock(tx, { ownerType: 'RETAILER', retailerId }, warehouseId, item.productId, item.allocations.map((allocation) => ({
            batchId: allocation.batchId,
            quantity: allocation.quantity,
        })), { referenceType: 'ORDER', referenceId: orderId, notes: reason });
        await tx.orderItemAllocation.updateMany({
            where: { id: { in: item.allocations.map((a) => a.id) } },
            data: { released: true },
        });
    }
}
/** Consumes reservations and deducts stock — the order is now a completed sale. */
async function consumeReservations(tx, orderId, retailerId) {
    const warehouseId = await inventory.resolveWarehouse(tx, {
        ownerType: 'RETAILER',
        retailerId,
    });
    const items = await tx.orderItem.findMany({
        where: { orderId },
        include: { allocations: { where: { released: false, consumed: false } } },
    });
    for (const item of items) {
        if (item.allocations.length === 0)
            continue;
        await inventory.consumeReserved(tx, { ownerType: 'RETAILER', retailerId }, warehouseId, item.productId, item.allocations.map((allocation) => ({
            batchId: allocation.batchId,
            quantity: allocation.quantity,
        })), 'SALE', { referenceType: 'ORDER', referenceId: orderId });
        await tx.orderItemAllocation.updateMany({
            where: { id: { in: item.allocations.map((a) => a.id) } },
            data: { consumed: true },
        });
        await tx.orderItem.update({
            where: { id: item.id },
            data: { fulfilledQty: item.quantity },
        });
    }
}
const STATUS_MESSAGES = {
    ACCEPTED: {
        event: constants_1.NOTIFICATION_EVENTS.ORDER_ACCEPTED,
        title: 'Order accepted',
        body: (n) => `Your order ${n} has been accepted and is being prepared.`,
    },
    PREPARING: {
        event: constants_1.NOTIFICATION_EVENTS.ORDER_ACCEPTED,
        title: 'Order is being prepared',
        body: (n) => `Your order ${n} is being prepared.`,
    },
    READY_FOR_PICKUP: {
        event: constants_1.NOTIFICATION_EVENTS.ORDER_READY,
        title: 'Order ready for pickup',
        body: (n) => `Your order ${n} is ready — collect it during your pickup slot.`,
    },
    COMPLETED: {
        event: constants_1.NOTIFICATION_EVENTS.ORDER_COMPLETED,
        title: 'Order completed',
        body: (n) => `Order ${n} is complete. Thank you!`,
    },
    REJECTED: {
        event: constants_1.NOTIFICATION_EVENTS.ORDER_REJECTED,
        title: 'Order rejected',
        body: (n) => `Order ${n} was rejected by the store.`,
    },
    CANCELLED: {
        event: constants_1.NOTIFICATION_EVENTS.ORDER_CANCELLED,
        title: 'Order cancelled',
        body: (n) => `Order ${n} has been cancelled.`,
    },
};
/**
 * Single entry point for every order status change. Handles the stock side
 * effects (release / consume), the pickup slot, the sale + finance records and
 * the customer notification.
 */
async function changeStatus(orderId, to, actor, options = {}) {
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: orderId },
        include: { retailer: { select: { id: true, userId: true, storeName: true } }, customer: { select: { userId: true } } },
    });
    if (!order)
        throw ApiError_1.ApiError.notFound('Order not found');
    assertTransition(order.status, to);
    if (to === 'CANCELLED' && actor.role === 'CUSTOMER' && !constants_1.CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
        throw ApiError_1.ApiError.badRequest('This order can no longer be cancelled — contact the store');
    }
    const releasesStock = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(to);
    const consumesStock = to === 'PICKED_UP';
    await prisma_1.prisma.$transaction(async (tx) => {
        if (releasesStock) {
            await releaseReservations(tx, orderId, order.retailerId, `Order ${to.toLowerCase()}`);
            if (order.pickupSlotId) {
                const slot = await tx.pickupSlot.findUnique({ where: { id: order.pickupSlotId } });
                if (slot) {
                    await tx.pickupSlot.update({
                        where: { id: order.pickupSlotId },
                        data: {
                            bookedCount: Math.max(0, slot.bookedCount - 1),
                            status: slot.status === 'FULL' ? 'AVAILABLE' : slot.status,
                        },
                    });
                }
            }
        }
        if (consumesStock) {
            await consumeReservations(tx, orderId, order.retailerId);
            await createSaleRecord(tx, orderId);
        }
        const result = await tx.order.update({
            where: { id: orderId },
            data: {
                status: to,
                ...(to === 'ACCEPTED' ? { acceptedAt: new Date() } : {}),
                ...(to === 'READY_FOR_PICKUP' ? { readyAt: new Date() } : {}),
                ...(to === 'PICKED_UP' ? { pickedUpAt: new Date(), paymentStatus: 'PAID' } : {}),
                ...(to === 'COMPLETED' ? { completedAt: new Date() } : {}),
                ...(to === 'REJECTED' ? { rejectionReason: options.reason ?? null } : {}),
                ...(to === 'CANCELLED'
                    ? {
                        cancelledAt: new Date(),
                        cancellationReason: options.reason ?? null,
                        cancelledBy: actor.role,
                    }
                    : {}),
            },
        });
        await tx.orderStatusHistory.create({
            data: {
                orderId,
                fromStatus: order.status,
                toStatus: to,
                notes: options.notes ?? options.reason ?? null,
                changedById: actor.userId,
            },
        });
        return result;
    }, { timeout: 20_000 });
    const message = STATUS_MESSAGES[to];
    if (message) {
        const target = actor.role === 'CUSTOMER' ? order.retailer.userId : order.customer.userId;
        await (0, notification_service_1.notify)({
            userId: target,
            event: message.event,
            title: message.title,
            body: `${message.body(order.orderNumber)}${options.reason ? ` Reason: ${options.reason}` : ''}`,
            data: { orderId, orderNumber: order.orderNumber },
            channels: ['IN_APP', 'EMAIL'],
        });
    }
    return getOrder(orderId);
}
/** Creates the sale + finance records once an order is physically handed over. */
async function createSaleRecord(tx, orderId) {
    const existing = await tx.sale.findUnique({ where: { orderId } });
    if (existing)
        return;
    const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
            items: { include: { allocations: { include: { batch: true } } } },
            customer: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
        },
    });
    if (!order)
        return;
    const saleNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'sale');
    // Cost of goods is taken from the actual batches consumed.
    let costAmount = (0, money_1.D)(0);
    const saleItems = order.items.map((item) => {
        const itemCost = item.allocations.reduce((sum, allocation) => sum.add((0, money_1.D)(allocation.batch.purchasePrice).mul(allocation.quantity)), (0, money_1.D)(0));
        costAmount = costAmount.add(itemCost);
        return {
            productId: item.productId,
            productName: item.productName,
            batchNumber: item.allocations.map((a) => a.batch.batchNumber).join(', ') || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.quantity > 0 ? (0, money_1.round2)(itemCost.div(item.quantity)) : (0, money_1.D)(0),
            discountAmount: item.discountAmount,
            gstRate: item.gstRate,
            taxableAmount: item.taxableAmount,
            taxAmount: item.taxAmount,
            totalAmount: item.totalAmount,
        };
    });
    await tx.sale.create({
        data: {
            saleNumber,
            retailerId: order.retailerId,
            orderId,
            customerId: order.customerId,
            customerName: `${order.customer.user.firstName} ${order.customer.user.lastName ?? ''}`.trim(),
            customerPhone: order.customer.user.phone,
            subtotal: order.subtotal,
            discountAmount: order.discountAmount,
            taxableAmount: order.taxableAmount,
            taxAmount: order.taxAmount,
            totalAmount: order.totalAmount,
            costAmount: (0, money_1.round2)(costAmount),
            paymentMode: order.paymentMode,
            paymentStatus: 'PAID',
            items: { create: saleItems },
        },
    });
    const invoiceNumber = await (0, numbering_1.nextDocumentNumber)(tx, 'invoice');
    await tx.invoice.create({
        data: {
            invoiceNumber,
            type: 'SALES',
            ownerType: 'RETAILER',
            retailerId: order.retailerId,
            orderId,
            billToName: `${order.customer.user.firstName} ${order.customer.user.lastName ?? ''}`.trim(),
            subtotal: order.subtotal,
            discountAmount: order.discountAmount,
            taxableAmount: order.taxableAmount,
            cgstAmount: order.cgstAmount,
            sgstAmount: order.sgstAmount,
            igstAmount: order.igstAmount,
            totalAmount: order.totalAmount,
            paidAmount: order.totalAmount,
            status: 'PAID',
        },
    });
    await tx.financeTransaction.create({
        data: {
            ownerType: 'RETAILER',
            retailerId: order.retailerId,
            type: 'SALE',
            direction: 'IN',
            amount: order.totalAmount,
            taxAmount: order.taxAmount,
            referenceType: 'ORDER',
            referenceId: orderId,
            partyName: `${order.customer.user.firstName} ${order.customer.user.lastName ?? ''}`.trim(),
            description: `Customer order ${order.orderNumber}`,
        },
    });
}
async function cancelByCustomer(customerId, orderId, reason, userId) {
    await getOrder(orderId, { customerId });
    return changeStatus(orderId, 'CANCELLED', { userId, role: 'CUSTOMER' }, { reason });
}
/**
 * Expires orders the store never accepted. Reservations are released so the
 * stock returns to the storefront.
 */
async function expireStaleOrders(hours) {
    const cutoff = (0, time_1.dayjs)().subtract(hours, 'hour').toDate();
    const stale = await prisma_1.prisma.order.findMany({
        where: { status: 'PENDING', createdAt: { lt: cutoff } },
        select: { id: true },
    });
    for (const order of stale) {
        await changeStatus(order.id, 'EXPIRED', { userId: 'system', role: 'SYSTEM' }, {
            reason: 'The store did not accept this order in time',
        }).catch(() => undefined);
    }
    return stale.length;
}
//# sourceMappingURL=order.service.js.map