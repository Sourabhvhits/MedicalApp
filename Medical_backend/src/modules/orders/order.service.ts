import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { D, round2, toNumber } from '../../utils/money';
import { aggregateTax, computeLineTax } from '../../utils/tax';
import { nextDocumentNumber } from '../../utils/numbering';
import { dayjs, endOfDay, startOfDay, toDateOnly } from '../../utils/time';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  NOTIFICATION_EVENTS,
  ORDER_RESERVED_STATUSES,
  ORDER_TRANSITIONS,
} from '../../config/constants';
import { notify } from '../notifications/notification.service';
import * as inventory from '../inventory/inventory.service';
import * as pickup from '../retailers/pickup.service';
import { createGatewayOrder, isPaymentGatewayConfigured } from '../../lib/payment-gateway';
import { RETAIL_PRICE_INCLUDES_TAX } from '../customers/cart.service';
import { checkInteractions, hasSevereInteraction } from '../safety/safety.service';
import { toSignedUrl } from '../../lib/signed-url';

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
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  salesReturns: { include: { items: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

export async function getOrder(id: string, scope?: { customerId?: string; retailerId?: string }) {
  const order = await prisma.order.findFirst({
    where: {
      id,
      ...(scope?.customerId ? { customerId: scope.customerId } : {}),
      ...(scope?.retailerId ? { retailerId: scope.retailerId } : {}),
    },
    include: DETAIL_INCLUDE,
  });
  if (!order) throw ApiError.notFound('Order not found');
  return { ...order, prescriptionUrl: toSignedUrl(order.prescriptionUrl) ?? order.prescriptionUrl };
}

/**
 * The customer-facing half of the invoice already raised server-side at
 * PICKED_UP/DELIVERED (`createSaleRecord`) — reuses that same row rather
 * than generating a second one. `/vendor/invoices` and `/retailer/invoices`
 * already give the business side a B2B view of the identical record.
 */
export async function getOrderInvoice(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId }, select: { id: true } });
  if (!order) throw ApiError.notFound('Order not found');

  const invoice = await prisma.invoice.findUnique({
    where: { orderId },
    include: {
      order: { include: { items: true } },
      retailer: {
        select: {
          storeName: true,
          gstNumber: true,
          addressLine1: true,
          city: true,
          drugLicenseNumber: true,
        },
      },
    },
  });
  if (!invoice) {
    throw ApiError.notFound('Invoice not available yet — it is generated once your order is fulfilled');
  }
  return invoice;
}

export async function listOrders(
  scope: { customerId?: string; retailerId?: string },
  query: Record<string, unknown>,
) {
  const { page, limit, skip, take } = getPagination(query);

  const where: Prisma.OrderWhereInput = {
    ...(scope.customerId ? { customerId: scope.customerId } : {}),
    ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
    ...(query.status ? { status: query.status as OrderStatus } : {}),
    ...(query.active ? { status: { in: ORDER_RESERVED_STATUSES } } : {}),
  };

  if (query.search) {
    const search = query.search as string;
    where.OR = [
      { orderNumber: { contains: search } },
      { retailer: { storeName: { contains: search } } },
      { customer: { user: { firstName: { contains: search } } } },
      { customer: { user: { lastName: { contains: search } } } },
      { customer: { user: { phone: { contains: search } } } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: startOfDay(query.dateFrom as Date) } : {}),
      ...(query.dateTo ? { lte: endOfDay(query.dateTo as Date) } : {}),
    };
  }

  if (query.pickupDate) where.pickupDate = toDateOnly(query.pickupDate as Date);

  const [items, total] = await Promise.all([
    prisma.order.findMany({
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
    prisma.order.count({ where }),
  ]);

  return {
    items: items.map((order) => ({
      ...order,
      prescriptionUrl: toSignedUrl(order.prescriptionUrl) ?? order.prescriptionUrl,
    })),
    meta: buildMeta(page, limit, total),
  };
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface CheckoutInput {
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  pickupDate?: Date;
  pickupStartTime?: string;
  deliveryAddressId?: string;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'ONLINE' | 'COD';
  customerNote?: string;
  prescriptionUrl?: string;
}

/**
 * Creates a customer order from the active cart.
 *
 * Everything below — slot validation, FEFO allocation, reservation, order rows
 * and the slot booking — runs inside one database transaction with row locks
 * on the batches, so two customers cannot reserve the same units.
 */
export async function checkout(customerId: string, input: CheckoutInput) {
  const cart = await prisma.cart.findFirst({
    where: { customerId, isActive: true },
    include: {
      retailer: {
        select: {
          id: true,
          storeName: true,
          userId: true,
          approvalStatus: true,
          isActive: true,
          deliveryEnabled: true,
          deliveryChargeAmount: true,
          deliveryFreeAboveAmount: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              packSize: true,
              status: true,
              isRecalled: true,
              prescriptionRequired: true,
              composition: true,
            },
          },
          retailerProduct: { select: { status: true, deletedAt: true, maxOrderQty: true } },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) throw ApiError.badRequest('Your cart is empty');
  if (cart.retailer.approvalStatus !== 'APPROVED' || !cart.retailer.isActive) {
    throw ApiError.badRequest('This store is no longer accepting orders');
  }

  for (const item of cart.items) {
    if (item.retailerProduct.deletedAt || item.retailerProduct.status !== 'ACTIVE') {
      throw ApiError.badRequest(`${item.product.name} is no longer sold by this store`);
    }
    if (item.product.status !== 'ACTIVE' || item.product.isRecalled) {
      throw ApiError.badRequest(`${item.product.name} has been blocked or recalled`);
    }
    if (item.quantity > item.retailerProduct.maxOrderQty) {
      throw ApiError.badRequest(
        `${item.product.name} is limited to ${item.retailerProduct.maxOrderQty} per order`,
      );
    }
  }

  // A severe drug-interaction match routes into the same pharmacist-review
  // gate as a prescription-only product, rather than a second review queue
  // (TASKS.md Priority-1 addition A).
  const interactionWarnings = await checkInteractions(cart.items.map((item) => item.product.composition));
  const needsPrescription =
    cart.items.some((item) => item.product.prescriptionRequired) || hasSevereInteraction(interactionWarnings);
  if (needsPrescription && !input.prescriptionUrl) {
    throw ApiError.badRequest(
      hasSevereInteraction(interactionWarnings)
        ? 'This order combines medicines with a known severe interaction — upload a prescription so the pharmacist can review it before it is accepted'
        : 'This order contains prescription-only medicines — upload a valid prescription to continue',
    );
  }

  if (input.paymentMode === 'ONLINE' && !(await isPaymentGatewayConfigured())) {
    throw ApiError.badRequest('Online payment is not available yet — choose cash, UPI or card at the store');
  }

  // Validated before the transaction so a bad slot/address fails fast and cheaply.
  let slot: Awaited<ReturnType<typeof pickup.validateSlotSelection>> | null = null;
  let deliveryAddress: Prisma.CustomerAddressGetPayload<Record<string, never>> | null = null;

  if (input.fulfillmentType === 'PICKUP') {
    if (!input.pickupDate || !input.pickupStartTime) {
      throw ApiError.badRequest('Choose a pickup date and time');
    }
    if (input.paymentMode === 'COD') {
      throw ApiError.badRequest('Cash on delivery is only available for delivery orders');
    }
    slot = await pickup.validateSlotSelection(cart.retailerId, input.pickupDate, input.pickupStartTime);
  } else {
    if (!cart.retailer.deliveryEnabled) {
      throw ApiError.badRequest('This store does not offer delivery — choose pickup instead');
    }
    if (!input.deliveryAddressId) {
      throw ApiError.badRequest('Choose a delivery address');
    }
    deliveryAddress = await prisma.customerAddress.findFirst({
      where: { id: input.deliveryAddressId, customerId },
    });
    if (!deliveryAddress) throw ApiError.badRequest('That delivery address was not found');
  }

  const lines = cart.items.map((item) => ({
    item,
    tax: computeLineTax({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      gstRate: item.gstRate,
      discountPct: item.discountPct,
      priceIncludesTax: RETAIL_PRICE_INCLUDES_TAX,
    }),
  }));
  const totals = aggregateTax(lines.map((line) => line.tax));

  // Flat, untaxed addition to the order total — deliberately not run through
  // the GST engine (see TASKS.md's delivery item: scoped down rather than
  // guessing a GST treatment for delivery fees that varies by state/slab).
  const deliveryChargeAmount =
    input.fulfillmentType === 'DELIVERY'
      ? cart.retailer.deliveryFreeAboveAmount !== null &&
        toNumber(totals.subtotal) >= toNumber(cart.retailer.deliveryFreeAboveAmount)
        ? D(0)
        : cart.retailer.deliveryChargeAmount
      : D(0);
  const totalAmount = D(totals.totalAmount).plus(deliveryChargeAmount);

  const order = await prisma.$transaction(
    async (tx) => {
      let lockedSlot: Prisma.PickupSlotGetPayload<Record<string, never>> | null = null;
      if (slot) {
        // Re-check slot capacity under the transaction to avoid oversubscription.
        lockedSlot = await tx.pickupSlot.findUnique({ where: { id: slot.id } });
        if (!lockedSlot || lockedSlot.bookedCount >= lockedSlot.capacity) {
          throw ApiError.badRequest('The selected pickup slot was just filled — please choose another');
        }
      }

      const warehouseIds = await inventory.listActiveWarehouseIds(tx, {
        ownerType: 'RETAILER',
        retailerId: cart.retailerId,
      });

      const orderNumber = await nextDocumentNumber(tx, 'order');

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          retailerId: cart.retailerId,
          fulfillmentType: input.fulfillmentType,
          ...(slot
            ? { pickupSlotId: slot.id, pickupDate: toDateOnly(input.pickupDate!), pickupStart: slot.startTime, pickupEnd: slot.endTime }
            : {}),
          ...(deliveryAddress
            ? {
                deliveryContactName: deliveryAddress.contactName,
                deliveryContactPhone: deliveryAddress.contactPhone,
                deliveryAddressLine1: deliveryAddress.addressLine1,
                deliveryAddressLine2: deliveryAddress.addressLine2,
                deliveryLandmark: deliveryAddress.landmark,
                deliveryCity: deliveryAddress.city,
                deliveryState: deliveryAddress.state,
                deliveryPincode: deliveryAddress.pincode,
                deliveryLatitude: deliveryAddress.latitude,
                deliveryLongitude: deliveryAddress.longitude,
                deliveryChargeAmount,
              }
            : {}),
          status: 'PENDING',
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          taxAmount: totals.taxAmount,
          totalAmount,
          paymentMode: input.paymentMode,
          paymentStatus: 'PENDING',
          customerNote: input.customerNote ?? null,
          prescriptionUrl: input.prescriptionUrl ?? null,
          prescriptionStatus: input.prescriptionUrl ? 'PENDING' : 'NOT_REQUIRED',
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

        // FEFO allocation with SELECT ... FOR UPDATE inside this transaction,
        // searched across every warehouse this retailer has — not just the
        // default one, so stock sitting in a non-default location is found.
        const allocations = await inventory.allocateFefo(
          tx,
          warehouseIds,
          item.productId,
          item.quantity,
        );

        await inventory.reserveStock(
          tx,
          { ownerType: 'RETAILER', retailerId: cart.retailerId },
          item.productId,
          allocations,
          { referenceType: 'ORDER', referenceId: createdOrder.id },
        );

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

      if (slot && lockedSlot) {
        await tx.pickupSlot.update({
          where: { id: slot.id },
          data: {
            bookedCount: { increment: 1 },
            ...(lockedSlot.bookedCount + 1 >= lockedSlot.capacity ? { status: 'FULL' as const } : {}),
          },
        });
      }

      await tx.cart.delete({ where: { id: cart.id } });

      return createdOrder;
    },
    { timeout: 20_000, isolationLevel: 'ReadCommitted' },
  );

  await notify({
    userId: cart.retailer.userId,
    event: NOTIFICATION_EVENTS.ORDER_PLACED,
    title: 'New customer order',
    body:
      input.fulfillmentType === 'PICKUP'
        ? `Order ${order.orderNumber} for ₹${toNumber(order.totalAmount).toFixed(2)} — pickup ${dayjs(order.pickupDate).format('DD MMM')} at ${order.pickupStart}.`
        : `Order ${order.orderNumber} for ₹${toNumber(order.totalAmount).toFixed(2)} — for delivery.`,
    data: { orderId: order.id, orderNumber: order.orderNumber },
    channels: ['IN_APP', 'EMAIL'],
  });

  // Only reachable once a real gateway is wired in payment-gateway.ts — the
  // checkout validation above already rejects ONLINE while unconfigured.
  let gatewayOrder = null;
  if (input.paymentMode === 'ONLINE') {
    gatewayOrder = await createGatewayOrder(toNumber(order.totalAmount), order.orderNumber);
    await prisma.order.update({
      where: { id: order.id },
      data: { gatewayOrderId: gatewayOrder.gatewayOrderId },
    });
  }

  return { ...(await getOrder(order.id)), gatewayOrder };
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw ApiError.badRequest(`An order cannot move from ${from} to ${to}`);
  }
}

async function reservedAllocations(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    include: { allocations: { where: { released: false, consumed: false } } },
  });
  return items.map((item) => ({ productId: item.productId, allocations: item.allocations }));
}

/** Releases every still-held reservation for an order back to available stock. */
async function releaseReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
  retailerId: string,
  reason: string,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { allocations: { where: { released: false, consumed: false } } },
  });

  for (const item of items) {
    if (item.allocations.length === 0) continue;

    // Each allocation's own warehouse (read off its batch inside
    // releaseStock) may differ — an order can span more than one warehouse.
    await inventory.releaseStock(
      tx as never,
      { ownerType: 'RETAILER', retailerId },
      item.productId,
      item.allocations.map((allocation) => ({
        batchId: allocation.batchId,
        quantity: allocation.quantity,
      })),
      { referenceType: 'ORDER', referenceId: orderId, notes: reason },
    );

    await tx.orderItemAllocation.updateMany({
      where: { id: { in: item.allocations.map((a) => a.id) } },
      data: { released: true },
    });
  }
}

/** Consumes reservations and deducts stock — the order is now a completed sale. */
async function consumeReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
  retailerId: string,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { allocations: { where: { released: false, consumed: false } } },
  });

  for (const item of items) {
    if (item.allocations.length === 0) continue;

    // Each allocation's own warehouse (read off its batch inside
    // consumeReserved) may differ — an order can span more than one warehouse.
    await inventory.consumeReserved(
      tx as never,
      { ownerType: 'RETAILER', retailerId },
      item.productId,
      item.allocations.map((allocation) => ({
        batchId: allocation.batchId,
        quantity: allocation.quantity,
      })),
      'SALE',
      { referenceType: 'ORDER', referenceId: orderId },
    );

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

const STATUS_MESSAGES: Partial<Record<OrderStatus, { event: string; title: string; body: (orderNumber: string) => string }>> = {
  ACCEPTED: {
    event: NOTIFICATION_EVENTS.ORDER_ACCEPTED,
    title: 'Order accepted',
    body: (n) => `Your order ${n} has been accepted and is being prepared.`,
  },
  PREPARING: {
    event: NOTIFICATION_EVENTS.ORDER_ACCEPTED,
    title: 'Order is being prepared',
    body: (n) => `Your order ${n} is being prepared.`,
  },
  READY_FOR_PICKUP: {
    event: NOTIFICATION_EVENTS.ORDER_READY,
    title: 'Order ready for pickup',
    body: (n) => `Your order ${n} is ready — collect it during your pickup slot.`,
  },
  OUT_FOR_DELIVERY: {
    event: NOTIFICATION_EVENTS.ORDER_OUT_FOR_DELIVERY,
    title: 'Order out for delivery',
    body: (n) => `Your order ${n} is out for delivery.`,
  },
  DELIVERED: {
    event: NOTIFICATION_EVENTS.ORDER_DELIVERED,
    title: 'Order delivered',
    body: (n) => `Your order ${n} has been delivered.`,
  },
  COMPLETED: {
    event: NOTIFICATION_EVENTS.ORDER_COMPLETED,
    title: 'Order completed',
    body: (n) => `Order ${n} is complete. Thank you!`,
  },
  REJECTED: {
    event: NOTIFICATION_EVENTS.ORDER_REJECTED,
    title: 'Order rejected',
    body: (n) => `Order ${n} was rejected by the store.`,
  },
  CANCELLED: {
    event: NOTIFICATION_EVENTS.ORDER_CANCELLED,
    title: 'Order cancelled',
    body: (n) => `Order ${n} has been cancelled.`,
  },
};

/**
 * Single entry point for every order status change. Handles the stock side
 * effects (release / consume), the pickup slot, the sale + finance records and
 * the customer notification.
 */
export async function changeStatus(
  orderId: string,
  to: OrderStatus,
  actor: { userId: string; role: 'RETAILER' | 'CUSTOMER' | 'SYSTEM' | 'ADMIN' },
  options: { reason?: string; notes?: string; deliveryPartnerName?: string; deliveryTrackingNumber?: string } = {},
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { retailer: { select: { id: true, userId: true, storeName: true } }, customer: { select: { userId: true } } },
  });
  if (!order) throw ApiError.notFound('Order not found');

  assertTransition(order.status, to);

  // PREPARING forks into READY_FOR_PICKUP/OUT_FOR_DELIVERY in ORDER_TRANSITIONS
  // — this is where the fork actually gets pinned to the order's own fulfillment type.
  if (to === 'READY_FOR_PICKUP' && order.fulfillmentType !== 'PICKUP') {
    throw ApiError.badRequest('This is a delivery order — mark it out for delivery instead');
  }
  if (to === 'OUT_FOR_DELIVERY' && order.fulfillmentType !== 'DELIVERY') {
    throw ApiError.badRequest('This is a pickup order — mark it ready for pickup instead');
  }

  if (to === 'CANCELLED' && actor.role === 'CUSTOMER' && !CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
    throw ApiError.badRequest('This order can no longer be cancelled — contact the store');
  }

  if (to === 'ACCEPTED' && order.prescriptionStatus === 'PENDING') {
    throw ApiError.badRequest(
      'Review the uploaded prescription before accepting this order',
    );
  }

  if (to === 'ACCEPTED' && order.paymentMode === 'ONLINE' && order.paymentStatus === 'PENDING') {
    throw ApiError.badRequest('Payment has not been confirmed for this order yet');
  }

  const releasesStock = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(to);
  const consumesStock = to === 'PICKED_UP' || to === 'DELIVERED';

  await prisma.$transaction(
    async (tx) => {
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
          ...(to === 'PICKED_UP' ? { pickedUpAt: new Date(), paymentStatus: 'PAID' as const } : {}),
          ...(to === 'OUT_FOR_DELIVERY'
            ? {
                outForDeliveryAt: new Date(),
                ...(options.deliveryPartnerName !== undefined ? { deliveryPartnerName: options.deliveryPartnerName || null } : {}),
                ...(options.deliveryTrackingNumber !== undefined ? { deliveryTrackingNumber: options.deliveryTrackingNumber || null } : {}),
              }
            : {}),
          ...(to === 'DELIVERED' ? { deliveredAt: new Date(), paymentStatus: 'PAID' as const } : {}),
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
    },
    { timeout: 20_000 },
  );

  const message = STATUS_MESSAGES[to];
  if (message) {
    // An admin override affects both sides — the customer whose order changed
    // and the store whose reservation/stock it changed under — so both are
    // notified, unlike a normal retailer/customer-initiated change which only
    // tells the other party.
    const targets =
      actor.role === 'CUSTOMER'
        ? [order.retailer.userId]
        : actor.role === 'ADMIN'
          ? [order.customer.userId, order.retailer.userId]
          : [order.customer.userId];
    for (const target of targets) {
      await notify({
        userId: target,
        event: message.event,
        title: message.title,
        body: `${message.body(order.orderNumber)}${options.reason ? ` Reason: ${options.reason}` : ''}`,
        data: {
          orderId,
          orderNumber: order.orderNumber,
          storeName: order.retailer.storeName,
          reason: options.reason ?? '',
        },
        channels: ['IN_APP', 'EMAIL'],
        // Only the customer's copy is the store's own customisable wording —
        // the admin-override notice to the store itself isn't a message the
        // store composes for itself.
        scope: target === order.customer.userId ? { retailerId: order.retailerId } : undefined,
      });
    }
  }

  return getOrder(orderId);
}

/**
 * Pharmacist review of the prescription attached at checkout. Separate from
 * the main order status machine — approving just clears the gate `changeStatus`
 * checks before letting the order move to `ACCEPTED`; rejecting leaves the
 * retailer to reject the order itself via the normal action if they choose to.
 */
export async function reviewPrescription(
  orderId: string,
  retailerId: string,
  input: { status: 'APPROVED' | 'REJECTED'; reason?: string },
  reviewerId: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, retailerId },
    include: { customer: { select: { userId: true } }, retailer: { select: { storeName: true } } },
  });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.prescriptionStatus !== 'PENDING') {
    throw ApiError.badRequest('This order has no prescription awaiting review');
  }
  if (input.status === 'REJECTED' && !input.reason) {
    throw ApiError.badRequest('A reason is required to reject a prescription');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      prescriptionStatus: input.status,
      prescriptionReviewedById: reviewerId,
      prescriptionReviewedAt: new Date(),
      prescriptionRejectionReason: input.status === 'REJECTED' ? (input.reason ?? null) : null,
    },
  });

  await notify({
    userId: order.customer.userId,
    event:
      input.status === 'APPROVED'
        ? NOTIFICATION_EVENTS.PRESCRIPTION_APPROVED
        : NOTIFICATION_EVENTS.PRESCRIPTION_REJECTED,
    title: input.status === 'APPROVED' ? 'Prescription approved' : 'Prescription rejected',
    body:
      input.status === 'APPROVED'
        ? `Your prescription for order ${order.orderNumber} was approved — the store can now accept it.`
        : `Your prescription for order ${order.orderNumber} was rejected. Reason: ${input.reason}`,
    data: { orderId, orderNumber: order.orderNumber, storeName: order.retailer.storeName, reason: input.reason ?? '' },
    channels: ['IN_APP', 'EMAIL'],
    scope: { retailerId },
  });

  return updated;
}

/**
 * Admin force-cancel — the same state machine every other cancellation goes
 * through (`changeStatus`), so stock release and the pickup-slot count are
 * handled identically; `assertTransition` already refuses this once an order
 * is `PICKED_UP` (that's a refund, #13, not a cancellation).
 */
export async function adminForceCancel(orderId: string, reason: string, adminUserId: string) {
  await getOrder(orderId);
  return changeStatus(orderId, 'CANCELLED', { userId: adminUserId, role: 'ADMIN' }, { reason });
}

/**
 * Admin reassigns an order to a different pickup slot at the *same* store.
 * Deliberately scoped this narrowly: reassigning to a *different* store would
 * mean re-running FEFO allocation against another business's stock, its own
 * pricing/GST registration and its own pickup calendar — a cross-tenant
 * operation this backlog hasn't scoped a design for yet (TASKS.md #3).
 */
export async function adminReassignSlot(
  orderId: string,
  input: { pickupDate: Date; pickupStartTime: string },
  adminUserId: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { userId: true } }, retailer: { select: { userId: true } } },
  });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.fulfillmentType !== 'PICKUP') {
    throw ApiError.badRequest('This is a delivery order — it has no pickup slot to reassign');
  }
  if (!ORDER_RESERVED_STATUSES.includes(order.status)) {
    throw ApiError.badRequest('Only an order still awaiting pickup can be reassigned to a different slot');
  }

  const newSlot = await pickup.validateSlotSelection(order.retailerId, input.pickupDate, input.pickupStartTime);
  if (newSlot.id === order.pickupSlotId) {
    throw ApiError.badRequest('This order is already booked into that slot');
  }

  await prisma.$transaction(async (tx) => {
    if (order.pickupSlotId) {
      const oldSlot = await tx.pickupSlot.findUnique({ where: { id: order.pickupSlotId } });
      if (oldSlot) {
        await tx.pickupSlot.update({
          where: { id: order.pickupSlotId },
          data: {
            bookedCount: Math.max(0, oldSlot.bookedCount - 1),
            status: oldSlot.status === 'FULL' ? 'AVAILABLE' : oldSlot.status,
          },
        });
      }
    }

    // Re-checked under the transaction to avoid oversubscribing the new slot.
    const lockedNewSlot = await tx.pickupSlot.findUnique({ where: { id: newSlot.id } });
    if (!lockedNewSlot || lockedNewSlot.bookedCount >= lockedNewSlot.capacity) {
      throw ApiError.badRequest('The selected pickup slot was just filled — please choose another');
    }
    await tx.pickupSlot.update({
      where: { id: newSlot.id },
      data: {
        bookedCount: { increment: 1 },
        ...(lockedNewSlot.bookedCount + 1 >= lockedNewSlot.capacity ? { status: 'FULL' as const } : {}),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        pickupSlotId: newSlot.id,
        pickupDate: toDateOnly(input.pickupDate),
        pickupStart: newSlot.startTime,
        pickupEnd: newSlot.endTime,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        notes: `Pickup slot reassigned by admin to ${dayjs(newSlot.date).format('DD MMM')} ${newSlot.startTime}-${newSlot.endTime}`,
        changedById: adminUserId,
      },
    });
  });

  await notify({
    userId: order.customer.userId,
    event: NOTIFICATION_EVENTS.ORDER_SLOT_REASSIGNED,
    title: 'Your pickup slot changed',
    body: `Order ${order.orderNumber}'s pickup slot was moved to ${dayjs(newSlot.date).format('DD MMM')}, ${newSlot.startTime}-${newSlot.endTime}.`,
    data: { orderId, orderNumber: order.orderNumber },
    channels: ['IN_APP', 'EMAIL'],
  });
  await notify({
    userId: order.retailer.userId,
    event: NOTIFICATION_EVENTS.ORDER_SLOT_REASSIGNED,
    title: 'An order pickup slot changed',
    body: `Order ${order.orderNumber}'s pickup slot was moved by admin to ${dayjs(newSlot.date).format('DD MMM')}, ${newSlot.startTime}-${newSlot.endTime}.`,
    data: { orderId, orderNumber: order.orderNumber },
    channels: ['IN_APP', 'EMAIL'],
  });

  return getOrder(orderId);
}

/**
 * Post-completion refund (TASKS.md #13) — full or partial, on a `COMPLETED`
 * order only. Writes a `SalesReturn` (+ line items) for the audit/GST trail
 * and a `SALE_RETURN` finance transaction so it shows up correctly in the
 * revenue figures `finance.service.ts#summary` already computes (it already
 * subtracts `SALE_RETURN` from revenue — this was previously dead weight
 * with nothing ever creating one). Deliberately does **not** put stock back
 * into sellable inventory: once dispensed, a pharmacy return is not
 * automatically resalable, and TASKS' ask for this item only covers the
 * refund + ledger side, not a stock-reversal policy — `batchNumber` is still
 * recorded per line from the original allocation for traceability if a
 * future item wants to build a "put back after inspection" step on top.
 */
export async function issueRefund(
  retailerId: string,
  orderId: string,
  input: { reason: string; items: { orderItemId: string; quantity: number }[] },
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, retailerId },
    include: {
      items: { include: { allocations: { include: { batch: true } } } },
      customer: { select: { userId: true } },
      retailer: { select: { storeName: true } },
    },
  });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'COMPLETED') {
    throw ApiError.badRequest('Only a completed order can be refunded');
  }
  if (!input.items.length) {
    throw ApiError.badRequest('Select at least one item to refund');
  }

  // How much of each order item has already been refunded, so a second
  // partial refund can't exceed what was actually sold.
  const priorReturns = await prisma.salesReturnItem.findMany({
    where: { salesReturn: { orderId } },
    select: { productId: true, quantity: true },
  });
  const priorRefundedByProduct = new Map<string, number>();
  for (const row of priorReturns) {
    priorRefundedByProduct.set(row.productId, (priorRefundedByProduct.get(row.productId) ?? 0) + row.quantity);
  }

  let totalAmount = D(0);
  let taxAmount = D(0);
  const returnItems = input.items.map((line) => {
    const item = order.items.find((i) => i.id === line.orderItemId);
    if (!item) throw ApiError.badRequest('One of the selected items does not belong to this order');
    if (line.quantity < 1) throw ApiError.badRequest(`Enter a quantity to refund for ${item.productName}`);

    const alreadyRefunded = priorRefundedByProduct.get(item.productId) ?? 0;
    if (alreadyRefunded + line.quantity > item.quantity) {
      throw ApiError.badRequest(
        `Cannot refund ${line.quantity} × ${item.productName} — only ${item.quantity - alreadyRefunded} remaining unrefunded`,
      );
    }

    // Pro-rate off the item's own recorded totals rather than recomputing
    // tax, so a refund can never disagree with what the customer was
    // actually charged.
    const fraction = D(line.quantity).div(item.quantity);
    const lineTotal = round2(D(item.totalAmount).mul(fraction));
    const lineTax = round2(D(item.taxAmount).mul(fraction));
    totalAmount = totalAmount.add(lineTotal);
    taxAmount = taxAmount.add(lineTax);

    return {
      productId: item.productId,
      batchNumber: item.allocations.map((a) => a.batch.batchNumber).join(', ') || null,
      quantity: line.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      totalAmount: lineTotal,
    };
  });

  const created = await prisma.$transaction(async (tx) => {
    const returnNumber = await nextDocumentNumber(tx as never, 'salesReturn');

    const record = await tx.salesReturn.create({
      data: {
        returnNumber,
        retailerId,
        orderId,
        reason: input.reason,
        totalAmount: round2(totalAmount),
        taxAmount: round2(taxAmount),
        status: 'COMPLETED',
        items: { create: returnItems },
      },
      include: { items: true },
    });

    await tx.financeTransaction.create({
      data: {
        ownerType: 'RETAILER',
        retailerId,
        type: 'SALE_RETURN',
        direction: 'OUT',
        amount: round2(totalAmount),
        taxAmount: round2(taxAmount),
        referenceType: 'SALES_RETURN',
        referenceId: record.id,
        description: `Refund ${returnNumber} for order ${order.orderNumber}`,
      },
    });

    // Flip to REFUNDED only once the cumulative refunded amount covers the
    // whole order — a partial refund leaves paymentStatus as PAID, since
    // PaymentStatus has no PARTIALLY_REFUNDED value to represent that state.
    const totalRefundedSoFar = await tx.salesReturn.aggregate({
      where: { orderId },
      _sum: { totalAmount: true },
    });
    if (D(totalRefundedSoFar._sum.totalAmount ?? 0).greaterThanOrEqualTo(D(order.totalAmount))) {
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'REFUNDED' } });
    }

    return record;
  });

  await notify({
    userId: order.customer.userId,
    event: NOTIFICATION_EVENTS.ORDER_REFUND_ISSUED,
    title: 'Refund issued',
    body: `${order.orderNumber}: a refund of ₹${round2(totalAmount)} has been issued. ${input.reason}`,
    data: {
      orderId,
      orderNumber: order.orderNumber,
      refundId: created.id,
      storeName: order.retailer.storeName,
      reason: input.reason,
    },
    channels: ['IN_APP', 'EMAIL'],
    scope: { retailerId },
  });

  return created;
}

/** Creates the sale + finance records once an order is physically handed over. */
async function createSaleRecord(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const existing = await tx.sale.findUnique({ where: { orderId } });
  if (existing) return;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { allocations: { include: { batch: true } } } },
      customer: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
    },
  });
  if (!order) return;

  const saleNumber = await nextDocumentNumber(tx as never, 'sale');

  // Cost of goods is taken from the actual batches consumed.
  let costAmount = D(0);
  const saleItems = order.items.map((item) => {
    const itemCost = item.allocations.reduce(
      (sum, allocation) => sum.add(D(allocation.batch.purchasePrice).mul(allocation.quantity)),
      D(0),
    );
    costAmount = costAmount.add(itemCost);

    return {
      productId: item.productId,
      productName: item.productName,
      batchNumber: item.allocations.map((a) => a.batch.batchNumber).join(', ') || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.quantity > 0 ? round2(itemCost.div(item.quantity)) : D(0),
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
      costAmount: round2(costAmount),
      paymentMode: order.paymentMode,
      paymentStatus: 'PAID',
      items: { create: saleItems },
    },
  });

  const invoiceNumber = await nextDocumentNumber(tx as never, 'invoice');
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

export async function cancelByCustomer(customerId: string, orderId: string, reason: string, userId: string) {
  await getOrder(orderId, { customerId });
  return changeStatus(orderId, 'CANCELLED', { userId, role: 'CUSTOMER' }, { reason });
}

/**
 * Expires orders the store never accepted. Reservations are released so the
 * stock returns to the storefront.
 */
export async function expireStaleOrders(hours: number): Promise<number> {
  const cutoff = dayjs().subtract(hours, 'hour').toDate();

  const stale = await prisma.order.findMany({
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

export { reservedAllocations };
