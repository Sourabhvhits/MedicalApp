"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hoursForDate = hoursForDate;
exports.storeOpenState = storeOpenState;
exports.ensureSlotsForDate = ensureSlotsForDate;
exports.availableSlots = availableSlots;
exports.slotCalendar = slotCalendar;
exports.validateSlotSelection = validateSlotSelection;
exports.bookSlot = bookSlot;
exports.releaseSlot = releaseSlot;
const prisma_1 = require("../../database/prisma");
const ApiError_1 = require("../../utils/ApiError");
const time_1 = require("../../utils/time");
/**
 * Effective opening hours for one date: the weekly schedule, overridden by any
 * holiday entry and by a temporary closure.
 */
async function hoursForDate(retailerId, date) {
    const [holiday, weekly, retailer] = await Promise.all([
        prisma_1.prisma.storeHoliday.findUnique({
            where: { retailerId_date: { retailerId, date: (0, time_1.toDateOnly)(date) } },
        }),
        prisma_1.prisma.storeBusinessHour.findUnique({
            where: { retailerId_dayOfWeek: { retailerId, dayOfWeek: (0, time_1.dayOfWeek)(date) } },
        }),
        prisma_1.prisma.retailer.findUnique({
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
async function storeOpenState(retailer, at = new Date()) {
    const hours = await hoursForDate(retailer.id, at);
    if (hours.isClosed)
        return { isOpen: false, reason: hours.reason, openTime: null, closeTime: null };
    const nowMinutes = (0, time_1.dayjs)(at).hour() * 60 + (0, time_1.dayjs)(at).minute();
    const isOpen = nowMinutes >= (0, time_1.timeToMinutes)(hours.openTime) && nowMinutes < (0, time_1.timeToMinutes)(hours.closeTime);
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
async function ensureSlotsForDate(retailerId, date) {
    const config = await prisma_1.prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
    if (!config || !config.isEnabled)
        return [];
    const hours = await hoursForDate(retailerId, date);
    const dateOnly = (0, time_1.toDateOnly)(date);
    if (hours.isClosed) {
        // A day that became a holiday must not keep offering slots.
        await prisma_1.prisma.pickupSlot.updateMany({
            where: { retailerId, date: dateOnly, bookedCount: 0 },
            data: { status: 'DISABLED' },
        });
        return [];
    }
    const wanted = (0, time_1.buildSlots)(hours.openTime, hours.closeTime, config.slotDurationMins);
    const existing = await prisma_1.prisma.pickupSlot.findMany({ where: { retailerId, date: dateOnly } });
    const existingByStart = new Map(existing.map((slot) => [slot.startTime, slot]));
    for (const slot of wanted) {
        const current = existingByStart.get(slot.startTime);
        if (current) {
            if (current.status === 'DISABLED' && current.bookedCount === 0) {
                await prisma_1.prisma.pickupSlot.update({ where: { id: current.id }, data: { status: 'AVAILABLE' } });
            }
            continue;
        }
        await prisma_1.prisma.pickupSlot.create({
            data: {
                retailerId,
                date: dateOnly,
                startTime: slot.startTime,
                endTime: slot.endTime,
                capacity: config.maxOrdersPerSlot,
            },
        });
    }
    return prisma_1.prisma.pickupSlot.findMany({
        where: { retailerId, date: dateOnly },
        orderBy: { startTime: 'asc' },
    });
}
/**
 * Slots a customer may actually choose for a date: inside business hours, not
 * in the past, not on a holiday, not disabled and not full. Enforces the
 * store's pickup buffer so orders are never scheduled too soon.
 */
async function availableSlots(retailerId, date) {
    const config = await prisma_1.prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
    if (!config || !config.isEnabled)
        return [];
    const maxDate = (0, time_1.dayjs)().add(config.advanceDays, 'day').endOf('day');
    if ((0, time_1.dayjs)(date).isAfter(maxDate))
        return [];
    const slots = await ensureSlotsForDate(retailerId, date);
    const isToday = (0, time_1.dayjs)(date).isSame((0, time_1.dayjs)(), 'day');
    const earliestMinutes = (0, time_1.dayjs)().add(config.bufferMins, 'minute').hour() * 60 + (0, time_1.dayjs)().add(config.bufferMins, 'minute').minute();
    return slots.map((slot) => {
        let available = true;
        let reason;
        if (slot.status === 'DISABLED') {
            available = false;
            reason = 'Slot unavailable';
        }
        else if (slot.bookedCount >= slot.capacity) {
            available = false;
            reason = 'Slot full';
        }
        else if (isToday && (0, time_1.timeToMinutes)(slot.startTime) < earliestMinutes) {
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
async function slotCalendar(retailerId, days = 7) {
    const config = await prisma_1.prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
    const horizon = Math.min(days, config?.advanceDays ?? days);
    const calendar = [];
    for (let offset = 0; offset < horizon; offset += 1) {
        const date = (0, time_1.dayjs)().add(offset, 'day').toDate();
        const hours = await hoursForDate(retailerId, date);
        const slots = hours.isClosed ? [] : await availableSlots(retailerId, date);
        calendar.push({
            date: (0, time_1.dayjs)(date).format('YYYY-MM-DD'),
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
async function validateSlotSelection(retailerId, date, startTime) {
    const dateOnly = (0, time_1.toDateOnly)(date);
    if ((0, time_1.dayjs)(dateOnly).isBefore((0, time_1.dayjs)().startOf('day'))) {
        throw ApiError_1.ApiError.badRequest('Pickup date cannot be in the past');
    }
    const hours = await hoursForDate(retailerId, date);
    if (hours.isClosed) {
        throw ApiError_1.ApiError.badRequest(hours.reason ?? 'The store is closed on the selected date');
    }
    await ensureSlotsForDate(retailerId, date);
    const slot = await prisma_1.prisma.pickupSlot.findUnique({
        where: { retailerId_date_startTime: { retailerId, date: dateOnly, startTime } },
    });
    if (!slot)
        throw ApiError_1.ApiError.badRequest('The selected pickup slot is not offered by this store');
    if (slot.status === 'DISABLED')
        throw ApiError_1.ApiError.badRequest('The selected pickup slot is unavailable');
    if (slot.bookedCount >= slot.capacity)
        throw ApiError_1.ApiError.badRequest('The selected pickup slot is fully booked');
    const config = await prisma_1.prisma.pickupSlotConfig.findUnique({ where: { retailerId } });
    const bufferMins = config?.bufferMins ?? 0;
    if ((0, time_1.dayjs)(dateOnly).isSame((0, time_1.dayjs)(), 'day')) {
        const nowPlusBuffer = (0, time_1.dayjs)().add(bufferMins, 'minute');
        const slotStart = (0, time_1.dayjs)().startOf('day').add((0, time_1.timeToMinutes)(startTime), 'minute');
        if (slotStart.isBefore(nowPlusBuffer)) {
            throw ApiError_1.ApiError.badRequest(`Pickup slots need at least ${bufferMins} minutes notice — the earliest slot today starts at ${(0, time_1.minutesToTime)(nowPlusBuffer.hour() * 60 + nowPlusBuffer.minute())}`);
        }
    }
    if (config && (0, time_1.dayjs)(dateOnly).isAfter((0, time_1.dayjs)().add(config.advanceDays, 'day').endOf('day'))) {
        throw ApiError_1.ApiError.badRequest(`Pickup can be scheduled up to ${config.advanceDays} day(s) in advance`);
    }
    return slot;
}
async function bookSlot(slotId) {
    const slot = await prisma_1.prisma.pickupSlot.update({
        where: { id: slotId },
        data: { bookedCount: { increment: 1 } },
    });
    if (slot.bookedCount >= slot.capacity) {
        await prisma_1.prisma.pickupSlot.update({ where: { id: slotId }, data: { status: 'FULL' } });
    }
}
async function releaseSlot(slotId) {
    const slot = await prisma_1.prisma.pickupSlot.findUnique({ where: { id: slotId } });
    if (!slot)
        return;
    await prisma_1.prisma.pickupSlot.update({
        where: { id: slotId },
        data: {
            bookedCount: Math.max(0, slot.bookedCount - 1),
            status: slot.status === 'FULL' ? 'AVAILABLE' : slot.status,
        },
    });
}
//# sourceMappingURL=pickup.service.js.map