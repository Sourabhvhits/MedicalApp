import type { DisputeStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { NOTIFICATION_EVENTS } from '../../config/constants';
import { notify, notifyAdmins } from '../notifications/notification.service';

const DETAIL_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      customerId: true,
      retailerId: true,
      customer: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
      retailer: { select: { userId: true, storeName: true } },
    },
  },
} satisfies Prisma.DisputeInclude;

/**
 * Raised by either side of a completed order. One open dispute per order at
 * a time — a second issue on the same order reuses the existing thread
 * rather than forking it (surfaced as a clear error, not a silent merge).
 */
export async function raiseDispute(
  orderId: string,
  actor: { userId: string; role: 'CUSTOMER' | 'RETAILER'; scopeId: string },
  reason: string,
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(actor.role === 'CUSTOMER' ? { customerId: actor.scopeId } : { retailerId: actor.scopeId }),
    },
    include: {
      customer: { select: { userId: true } },
      retailer: { select: { userId: true, storeName: true } },
    },
  });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'COMPLETED') {
    throw ApiError.badRequest('An issue can only be raised on a completed order');
  }

  const existing = await prisma.dispute.findFirst({
    where: { orderId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
  });
  if (existing) {
    throw ApiError.badRequest('There is already an open issue on this order');
  }

  const dispute = await prisma.dispute.create({
    data: { orderId, raisedById: actor.userId, raisedByRole: actor.role, reason, status: 'OPEN' },
    include: DETAIL_INCLUDE,
  });

  const counterpartyUserId = actor.role === 'CUSTOMER' ? order.retailer.userId : order.customer.userId;
  await notify({
    userId: counterpartyUserId,
    event: NOTIFICATION_EVENTS.DISPUTE_RAISED,
    title: 'An issue was raised on an order',
    body: `Order ${order.orderNumber}: ${reason}`,
    data: { orderId: order.id, disputeId: dispute.id },
    channels: ['IN_APP', 'EMAIL'],
  });
  // Same fan-out helper `register()` already uses for new-business
  // registration notices (`notifyAdmins`, notifies every active SUPER_ADMIN).
  await notifyAdmins({
    event: NOTIFICATION_EVENTS.DISPUTE_RAISED,
    title: 'A new issue was raised',
    body: `Order ${order.orderNumber}: ${reason}`,
    data: { orderId: order.id, disputeId: dispute.id },
    channels: ['IN_APP'],
  }).catch(() => undefined);

  return dispute;
}

export async function listDisputes(
  scope: { customerId?: string; retailerId?: string },
  query: Record<string, unknown>,
) {
  const { page, limit, skip, take } = getPagination(query);

  const orderFilter: Prisma.OrderWhereInput = {
    ...(scope.customerId ? { customerId: scope.customerId } : {}),
    ...(scope.retailerId ? { retailerId: scope.retailerId } : {}),
    ...(query.search ? { orderNumber: { contains: query.search as string } } : {}),
  };

  const where: Prisma.DisputeWhereInput = {
    ...(Object.keys(orderFilter).length ? { order: orderFilter } : {}),
    ...(query.status ? { status: query.status as DisputeStatus } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.dispute.count({ where }),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}

export async function getDispute(id: string, scope: { customerId?: string; retailerId?: string } = {}) {
  const dispute = await prisma.dispute.findFirst({
    where: {
      id,
      ...(scope.customerId ? { order: { customerId: scope.customerId } } : {}),
      ...(scope.retailerId ? { order: { retailerId: scope.retailerId } } : {}),
    },
    include: DETAIL_INCLUDE,
  });
  if (!dispute) throw ApiError.notFound('Dispute not found');
  return dispute;
}

/** Admin-only. Records the outcome; doesn't move money itself — see
 * TASKS.md #13 for the refund workflow this hands off to. */
export async function resolveDispute(
  id: string,
  input: { status: 'RESOLVED' | 'REJECTED'; resolution: string },
  resolverId: string,
) {
  const dispute = await getDispute(id);
  if (dispute.status === 'RESOLVED' || dispute.status === 'REJECTED') {
    throw ApiError.badRequest('This issue has already been resolved');
  }

  const updated = await prisma.dispute.update({
    where: { id },
    data: {
      status: input.status,
      resolution: input.resolution,
      resolvedById: resolverId,
      resolvedAt: new Date(),
    },
    include: DETAIL_INCLUDE,
  });

  const raiserUserId =
    dispute.raisedByRole === 'CUSTOMER' ? dispute.order.customer.userId : dispute.order.retailer.userId;
  await notify({
    userId: raiserUserId,
    event: NOTIFICATION_EVENTS.DISPUTE_RESOLVED,
    title: input.status === 'RESOLVED' ? 'Your issue was resolved' : 'Your issue was reviewed',
    body: `Order ${dispute.order.orderNumber}: ${input.resolution}`,
    data: { orderId: dispute.orderId, disputeId: dispute.id },
    channels: ['IN_APP', 'EMAIL'],
  });

  return updated;
}
