import type { TemplateScope } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { NOTIFICATION_EVENTS } from '../../config/constants';

/** Events a wholesaler can customise the wording for — sent about their own dispatch decisions. */
export const VENDOR_TEMPLATE_EVENTS = [
  NOTIFICATION_EVENTS.PURCHASE_ORDER_ACCEPTED,
  NOTIFICATION_EVENTS.PURCHASE_ORDER_REJECTED,
  NOTIFICATION_EVENTS.PURCHASE_ORDER_DISPATCHED,
];

/** Events a medical shop can customise — sent to its own customers about their orders. */
export const RETAILER_TEMPLATE_EVENTS = [
  NOTIFICATION_EVENTS.ORDER_ACCEPTED,
  NOTIFICATION_EVENTS.ORDER_READY,
  NOTIFICATION_EVENTS.ORDER_OUT_FOR_DELIVERY,
  NOTIFICATION_EVENTS.ORDER_DELIVERED,
  NOTIFICATION_EVENTS.ORDER_COMPLETED,
  NOTIFICATION_EVENTS.ORDER_REJECTED,
  NOTIFICATION_EVENTS.ORDER_CANCELLED,
  NOTIFICATION_EVENTS.PRESCRIPTION_APPROVED,
  NOTIFICATION_EVENTS.PRESCRIPTION_REJECTED,
  NOTIFICATION_EVENTS.PICKUP_REMINDER,
  NOTIFICATION_EVENTS.ORDER_REFUND_ISSUED,
];

/** Every catalogued event admin can set a platform-wide default for (broadcasts are free-typed per send, not templated). */
export const PLATFORM_TEMPLATE_EVENTS: string[] = Object.values(NOTIFICATION_EVENTS);

function eventsForScope(scope: TemplateScope): string[] {
  if (scope === 'VENDOR') return VENDOR_TEMPLATE_EVENTS;
  if (scope === 'RETAILER') return RETAILER_TEMPLATE_EVENTS;
  return PLATFORM_TEMPLATE_EVENTS;
}

function ownerWhere(scope: TemplateScope, ownerId?: string) {
  if (scope === 'VENDOR') return { scope: 'VENDOR' as const, vendorId: ownerId };
  if (scope === 'RETAILER') return { scope: 'RETAILER' as const, retailerId: ownerId };
  return { scope: 'PLATFORM' as const, vendorId: null, retailerId: null };
}

export interface TemplateRow {
  event: string;
  isCustomized: boolean;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
}

/**
 * The events this scope may customise, each paired with its current override
 * if one exists. An event with no row is shown blank — the caller is still
 * getting the platform's built-in message for it, this just means nobody has
 * replaced that wording yet.
 */
export async function listEffective(scope: TemplateScope, ownerId?: string): Promise<TemplateRow[]> {
  const events = eventsForScope(scope);
  const rows = await prisma.notificationTemplate.findMany({ where: ownerWhere(scope, ownerId) });
  const byEvent = new Map(rows.map((row) => [row.event, row]));

  return events.map((event) => {
    const row = byEvent.get(event);
    return {
      event,
      isCustomized: Boolean(row),
      titleTemplate: row?.titleTemplate ?? '',
      bodyTemplate: row?.bodyTemplate ?? '',
      isActive: row?.isActive ?? true,
    };
  });
}

export async function upsert(
  scope: TemplateScope,
  ownerId: string | undefined,
  event: string,
  input: { titleTemplate: string; bodyTemplate: string; isActive: boolean },
) {
  if (!eventsForScope(scope).includes(event)) {
    throw ApiError.badRequest('This event cannot be customised at this level');
  }

  const where = { ...ownerWhere(scope, ownerId), event };
  const existing = await prisma.notificationTemplate.findFirst({ where });
  if (existing) {
    return prisma.notificationTemplate.update({
      where: { id: existing.id },
      data: { titleTemplate: input.titleTemplate, bodyTemplate: input.bodyTemplate, isActive: input.isActive },
    });
  }
  return prisma.notificationTemplate.create({
    data: { ...where, titleTemplate: input.titleTemplate, bodyTemplate: input.bodyTemplate, isActive: input.isActive },
  });
}

/** Deletes the override so this event goes back to the platform's built-in message. */
export async function resetToDefault(scope: TemplateScope, ownerId: string | undefined, event: string): Promise<void> {
  const where = { ...ownerWhere(scope, ownerId), event };
  const result = await prisma.notificationTemplate.deleteMany({ where });
  if (result.count === 0) throw ApiError.notFound('No custom message set for this event');
}
