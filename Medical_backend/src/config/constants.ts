import type { OrderStatus, PurchaseOrderStatus } from '@prisma/client';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const EXPIRY_BUCKETS = [30, 60, 90] as const;

/**
 * Allowed customer-order status transitions. PREPARING forks two ways —
 * READY_FOR_PICKUP/PICKED_UP for a PICKUP order, OUT_FOR_DELIVERY/DELIVERED
 * for a DELIVERY order — `changeStatus` (order.service.ts) additionally
 * checks the order's own `fulfillmentType` before allowing either branch, so
 * a PICKUP order can never be pushed into OUT_FOR_DELIVERY or vice versa
 * even though both are technically reachable from PREPARING here.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED', 'EXPIRED'],
  PICKED_UP: ['COMPLETED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/** Statuses in which reserved stock is still held for a customer order. */
export const ORDER_RESERVED_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
];

/** Statuses a customer may cancel from. */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING'];

/** Allowed purchase-order status transitions (vendor side unless noted). */
export const PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['PLACED', 'CANCELLED'],
  PLACED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED: ['RECEIVED'],
  RECEIVED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const NOTIFICATION_EVENTS = {
  USER_REGISTERED: 'user.registered',
  VENDOR_APPROVED: 'vendor.approved',
  VENDOR_REJECTED: 'vendor.rejected',
  RETAILER_APPROVED: 'retailer.approved',
  RETAILER_REJECTED: 'retailer.rejected',
  ORDER_PLACED: 'order.placed',
  ORDER_ACCEPTED: 'order.accepted',
  ORDER_REJECTED: 'order.rejected',
  ORDER_READY: 'order.ready',
  ORDER_OUT_FOR_DELIVERY: 'order.out_for_delivery',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_COMPLETED: 'order.completed',
  ORDER_CANCELLED: 'order.cancelled',
  PRESCRIPTION_APPROVED: 'order.prescription_approved',
  PRESCRIPTION_REJECTED: 'order.prescription_rejected',
  PICKUP_REMINDER: 'order.pickup_reminder',
  ORDER_SLOT_REASSIGNED: 'order.slot_reassigned',
  ORDER_REFUND_ISSUED: 'order.refund_issued',
  DISPUTE_RAISED: 'dispute.raised',
  DISPUTE_RESOLVED: 'dispute.resolved',
  PURCHASE_ORDER_PLACED: 'purchase.placed',
  PURCHASE_ORDER_ACCEPTED: 'purchase.accepted',
  PURCHASE_ORDER_REJECTED: 'purchase.rejected',
  PURCHASE_ORDER_DISPATCHED: 'purchase.dispatched',
  LOW_STOCK: 'stock.low',
  EXPIRY_ALERT: 'stock.expiry',
  PAYMENT_UPDATE: 'payment.update',
  RECURRING_EXPENSE_DUE: 'expense.recurring_due',
  PRODUCT_RECALLED: 'product.recalled',
  BACK_IN_STOCK: 'stock.back_in_stock',
} as const;

export const AUDIT_MODULES = {
  AUTH: 'auth',
  USER: 'user',
  VENDOR: 'vendor',
  RETAILER: 'retailer',
  PRODUCT: 'product',
  CATALOG: 'catalog',
  INVENTORY: 'inventory',
  ORDER: 'order',
  DISPUTE: 'dispute',
  PURCHASE: 'purchase',
  FINANCE: 'finance',
  SETTING: 'setting',
  BROADCAST: 'broadcast',
} as const;
