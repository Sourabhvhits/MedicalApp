"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIT_MODULES = exports.NOTIFICATION_EVENTS = exports.PURCHASE_ORDER_TRANSITIONS = exports.CUSTOMER_CANCELLABLE_STATUSES = exports.ORDER_RESERVED_STATUSES = exports.ORDER_TRANSITIONS = exports.EXPIRY_BUCKETS = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = void 0;
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_PAGE_SIZE = 100;
exports.EXPIRY_BUCKETS = [30, 60, 90];
/** Allowed customer-order status transitions. */
exports.ORDER_TRANSITIONS = {
    PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
    ACCEPTED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
    READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED', 'EXPIRED'],
    PICKED_UP: ['COMPLETED'],
    COMPLETED: [],
    REJECTED: [],
    CANCELLED: [],
    EXPIRED: [],
};
/** Statuses in which reserved stock is still held for a customer order. */
exports.ORDER_RESERVED_STATUSES = [
    'PENDING',
    'ACCEPTED',
    'PREPARING',
    'READY_FOR_PICKUP',
];
/** Statuses a customer may cancel from. */
exports.CUSTOMER_CANCELLABLE_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING'];
/** Allowed purchase-order status transitions (vendor side unless noted). */
exports.PURCHASE_ORDER_TRANSITIONS = {
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
exports.NOTIFICATION_EVENTS = {
    USER_REGISTERED: 'user.registered',
    VENDOR_APPROVED: 'vendor.approved',
    VENDOR_REJECTED: 'vendor.rejected',
    RETAILER_APPROVED: 'retailer.approved',
    RETAILER_REJECTED: 'retailer.rejected',
    ORDER_PLACED: 'order.placed',
    ORDER_ACCEPTED: 'order.accepted',
    ORDER_REJECTED: 'order.rejected',
    ORDER_READY: 'order.ready',
    ORDER_COMPLETED: 'order.completed',
    ORDER_CANCELLED: 'order.cancelled',
    PICKUP_REMINDER: 'order.pickup_reminder',
    PURCHASE_ORDER_PLACED: 'purchase.placed',
    PURCHASE_ORDER_ACCEPTED: 'purchase.accepted',
    PURCHASE_ORDER_REJECTED: 'purchase.rejected',
    PURCHASE_ORDER_DISPATCHED: 'purchase.dispatched',
    LOW_STOCK: 'stock.low',
    EXPIRY_ALERT: 'stock.expiry',
    PAYMENT_UPDATE: 'payment.update',
};
exports.AUDIT_MODULES = {
    AUTH: 'auth',
    USER: 'user',
    VENDOR: 'vendor',
    RETAILER: 'retailer',
    PRODUCT: 'product',
    CATALOG: 'catalog',
    INVENTORY: 'inventory',
    ORDER: 'order',
    PURCHASE: 'purchase',
    FINANCE: 'finance',
    SETTING: 'setting',
};
//# sourceMappingURL=constants.js.map