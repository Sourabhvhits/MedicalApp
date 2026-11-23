'use client';

import { humanize } from '@/lib/utils';
import type { ApprovalStatus, OrderStatus, PurchaseOrderStatus, RecordStatus } from '@/lib/types';
import { Badge, type BadgeTone } from './index';

const ORDER_TONES: Record<OrderStatus, BadgeTone> = {
  PENDING: 'warning',
  ACCEPTED: 'info',
  PREPARING: 'info',
  READY_FOR_PICKUP: 'brand',
  PICKED_UP: 'success',
  OUT_FOR_DELIVERY: 'brand',
  DELIVERED: 'success',
  COMPLETED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

const PURCHASE_TONES: Record<PurchaseOrderStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PLACED: 'warning',
  ACCEPTED: 'info',
  PROCESSING: 'info',
  READY_FOR_DELIVERY: 'brand',
  DISPATCHED: 'brand',
  DELIVERED: 'brand',
  RECEIVED: 'success',
  COMPLETED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

const APPROVAL_TONES: Record<ApprovalStatus, BadgeTone> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
};

const RECORD_TONES: Record<RecordStatus, BadgeTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  BLOCKED: 'danger',
};

const PAYMENT_TONES: Record<string, BadgeTone> = {
  PENDING: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  CANCELLED: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONES[status] ?? 'neutral'}>{humanize(status)}</Badge>;
}

export function PurchaseStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge tone={PURCHASE_TONES[status] ?? 'neutral'}>{humanize(status)}</Badge>;
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return <Badge tone={APPROVAL_TONES[status] ?? 'neutral'}>{humanize(status)}</Badge>;
}

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  return <Badge tone={RECORD_TONES[status] ?? 'neutral'}>{humanize(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_TONES[status] ?? 'neutral'}>{humanize(status)}</Badge>;
}

/** Colour-codes remaining shelf life so near-expiry stock is unmissable. */
export function ExpiryBadge({ days }: { days: number }) {
  if (days < 0) return <Badge tone="danger">Expired</Badge>;
  if (days <= 30) return <Badge tone="danger">{days}d left</Badge>;
  if (days <= 90) return <Badge tone="warning">{days}d left</Badge>;
  return <Badge tone="success">{days}d left</Badge>;
}

export function StockBadge({ available, minimum }: { available: number; minimum?: number }) {
  if (available <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (minimum !== undefined && available <= minimum) return <Badge tone="warning">Low stock</Badge>;
  return <Badge tone="success">In stock</Badge>;
}
