import type { PickupSlot, Retailer } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { buildSlots, dayjs, dayOfWeek, minutesToTime, timeToMinutes, toDateOnly } from '../../utils/time';

export interface StoreOpenState {
  isOpen: boolean;
  reason?: string;
  openTime?: string | null;
  closeTime?: string | null;
}

/**
 * Effective opening hours for one date: the weekly schedule, overridden by any
 * holiday entry and by a temporary closure.
 */
export async function hoursForDate(
  retailerId: string,
  date: Date,
): Promise<{ isClosed: boolean; openTime: string | null; closeTime: string | null; reason?: string }> {
  const [holiday, weekly, retailer] = await Promise.all([
    prisma.storeHoliday.findUnique({
      where: { retailerId_date: { retailerId, date: toDateOnly(date) } },
    }),
    prisma.storeBusinessHour.findUnique({
      where: { retailerId_dayOfWeek: { retailerId, dayOfWeek: dayOfWeek(date) } },
    }),
    prisma.retailer.findUnique({
      where: { id: retailerId },
      select: { isTemporarilyClosed: true, closureReason: true, isActive: true, approvalStatus: true },
    }),
  ]);

  if (!retailer || retailer.approvalStatus !== 'APPROVED' || !retailer.isActive) {
    return { isClosed: true, openTime: null, closeTime: null, reason: 'Store is not active' };
  }

  if (retailer.isTemporarilyClosed) {
    return {
      isClosed: true,
      openTime: null,
      closeTime: null,
      reason: retailer.closureReason ?? 'Store is temporarily closed',
    };
  }

  if (holiday) {
    if (holiday.isFullDay || !holiday.openTime || !holiday.closeTime) {
      return { isClosed: true, openTime: null, closeTime: null, reason: holiday.title ?? 'Store holiday' };
    }
    // Special opening hours declared for the holiday.
    return { isClosed: false, openTime: holiday.openTime, closeTime: holiday.closeTime };
  }

  if (!weekly || weekly.isClosed || !weekly.openTime || !weekly.closeTime) {
    return { isClosed: true, openTime: null, closeTime: null, reason: 'Closed on this day' };
  }

  return { isClosed: false, openTime: weekly.openTime, closeTime: weekly.closeTime };
}

/** Live open/closed state used by the customer store listing. */
export async function storeOpenState(retailer: Pick<Retailer, 'id'>, at = new Date()): Promise<StoreOpenState> {
  const hours = await hoursForDate(retailer.id, at);
  if (hours.isClosed) return { isOpen: false, reason: hours.reason, openTime: null, closeTime: null };

  const nowMinutes = dayjs(at).hour() * 60 + dayjs(at).minute();
  const isOpen =
    nowMinutes >= timeToMinutes(hours.openTime!) && nowMinutes < timeToMinutes(hours.closeTime!);

  return {
    isOpen,
    reason: isOpen ? undefined : 'Outside business hours',
    openTime: hours.openTime,
    closeTime: hours.closeTime,
  };
}

/**
 * Generates (or refreshes) the pickup slots for one date from the store's
 * hours and slot configuration. Existing slots keep their bookings.
 */
export async function ensureSlotsForDate(retailerId: string, date: Date): Promise<PickupSlot[]> {
  const config = await prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
  if (!config || !config.isEnabled) return [];

  const hours = await hoursForDate(retailerId, date);
  const dateOnly = toDateOnly(date);

  if (hours.isClosed) {
    // A day that became a holiday must not keep offering slots.
    await prisma.pickupSlot.updateMany({
      where: { retailerId, date: dateOnly, bookedCount: 0 },
      data: { status: 'DISABLED' },
    });
    return [];
  }

  const wanted = buildSlots(hours.openTime!, hours.closeTime!, config.slotDurationMins);
  const existing = await prisma.pickupSlot.findMany({ where: { retailerId, date: dateOnly } });
  const existingByStart = new Map(existing.map((slot) => [slot.startTime, slot]));

  for (const slot of wanted) {
    const current = existingByStart.get(slot.startTime);
    if (current) {
      if (current.status === 'DISABLED' && current.bookedCount === 0) {
        await prisma.pickupSlot.update({ where: { id: current.id }, data: { status: 'AVAILABLE' } });
      }
      continue;
    }
    await prisma.pickupSlot.create({
      data: {
        retailerId,
        date: dateOnly,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: config.maxOrdersPerSlot,
      },
    });
  }

  return prisma.pickupSlot.findMany({
    where: { retailerId, date: dateOnly },
    orderBy: { startTime: 'asc' },
  });
}

export interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
  reason?: string;
}

/**
 * Slots a customer may actually choose for a date: inside business hours, not
 * in the past, not on a holiday, not disabled and not full. Enforces the
 * store's pickup buffer so orders are never scheduled too soon.
 */
export async function availableSlots(retailerId: string, date: Date): Promise<AvailableSlot[]> {
  const config = await prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
  if (!config || !config.isEnabled) return [];

  const maxDate = dayjs().add(config.advanceDays, 'day').endOf('day');
  if (dayjs(date).isAfter(maxDate)) return [];

  const slots = await ensureSlotsForDate(retailerId, date);
  const isToday = dayjs(date).isSame(dayjs(), 'day');
  const earliestMinutes = dayjs().add(config.bufferMins, 'minute').hour() * 60 + dayjs().add(config.bufferMins, 'minute').minute();

  return slots.map((slot) => {
    let available = true;
    let reason: string | undefined;

    if (slot.status === 'DISABLED') {
      available = false;
      reason = 'Slot unavailable';
    } else if (slot.bookedCount >= slot.capacity) {
      available = false;
      reason = 'Slot full';
    } else if (isToday && timeToMinutes(slot.startTime) < earliestMinutes) {
      available = false;
      reason = `Requires at least ${config.bufferMins} minutes notice`;
    }

    return {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
      available,
      reason,
    };
  });
}

export async function slotCalendar(retailerId: string, days = 7) {
  const config = await prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
  const horizon = Math.min(days, config?.advanceDays ?? days);

  const calendar = [];
  for (let offset = 0; offset < horizon; offset += 1) {
    const date = dayjs().add(offset, 'day').toDate();
    const hours = await hoursForDate(retailerId, date);
    const slots = hours.isClosed ? [] : await availableSlots(retailerId, date);
    calendar.push({
      date: dayjs(date).format('YYYY-MM-DD'),
      isClosed: hours.isClosed,
      reason: hours.reason,
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      slots,
      availableCount: slots.filter((slot) => slot.available).length,
    });
  }
  return calendar;
}

/**
 * Validates a customer's chosen pickup slot at checkout and returns the slot
 * row to book. Enforces business rules 12, 13 and 15.
 */
export async function validateSlotSelection(
  retailerId: string,
  date: Date,
  startTime: string,
): Promise<PickupSlot> {
  const dateOnly = toDateOnly(date);

  if (dayjs(dateOnly).isBefore(dayjs().startOf('day'))) {
    throw ApiError.badRequest('Pickup date cannot be in the past');
  }

  const hours = await hoursForDate(retailerId, date);
  if (hours.isClosed) {
    throw ApiError.badRequest(hours.reason ?? 'The store is closed on the selected date');
  }

  await ensureSlotsForDate(retailerId, date);

  const slot = await prisma.pickupSlot.findUnique({
    where: { retailerId_date_startTime: { retailerId, date: dateOnly, startTime } },
  });
  if (!slot) throw ApiError.badRequest('The selected pickup slot is not offered by this store');
  if (slot.status === 'DISABLED') throw ApiError.badRequest('The selected pickup slot is unavailable');
  if (slot.bookedCount >= slot.capacity) throw ApiError.badRequest('The selected pickup slot is fully booked');

  const config = await prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
  const bufferMins = config?.bufferMins ?? 0;

  if (dayjs(dateOnly).isSame(dayjs(), 'day')) {
    const nowPlusBuffer = dayjs().add(bufferMins, 'minute');
    const slotStart = dayjs().startOf('day').add(timeToMinutes(startTime), 'minute');
    if (slotStart.isBefore(nowPlusBuffer)) {
      throw ApiError.badRequest(
        `Pickup slots need at least ${bufferMins} minutes notice — the earliest slot today starts at ${minutesToTime(
          nowPlusBuffer.hour() * 60 + nowPlusBuffer.minute(),
        )}`,
      );
    }
  }

  if (config && dayjs(dateOnly).isAfter(dayjs().add(config.advanceDays, 'day').endOf('day'))) {
    throw ApiError.badRequest(`Pickup can be scheduled up to ${config.advanceDays} day(s) in advance`);
  }

  return slot;
}

export async function bookSlot(slotId: string): Promise<void> {
  const slot = await prisma.pickupSlot.update({
    where: { id: slotId },
    data: { bookedCount: { increment: 1 } },
  });
  if (slot.bookedCount >= slot.capacity) {
    await prisma.pickupSlot.update({ where: { id: slotId }, data: { status: 'FULL' } });
  }
}

export async function releaseSlot(slotId: string): Promise<void> {
  const slot = await prisma.pickupSlot.findUnique({ where: { id: slotId } });
  if (!slot) return;

  await prisma.pickupSlot.update({
    where: { id: slotId },
    data: {
      bookedCount: Math.max(0, slot.bookedCount - 1),
      status: slot.status === 'FULL' ? 'AVAILABLE' : slot.status,
    },
  });
}
