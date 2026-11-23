"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayOfWeek = exports.daysUntil = exports.addDays = exports.endOfDay = exports.startOfDay = exports.isValidTime = exports.TIME_FORMAT = exports.dayjs = void 0;
exports.timeToMinutes = timeToMinutes;
exports.minutesToTime = minutesToTime;
exports.toDateOnly = toDateOnly;
exports.buildSlots = buildSlots;
const dayjs_1 = __importDefault(require("dayjs"));
exports.dayjs = dayjs_1.default;
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
const isSameOrBefore_1 = __importDefault(require("dayjs/plugin/isSameOrBefore"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
dayjs_1.default.extend(customParseFormat_1.default);
dayjs_1.default.extend(isSameOrBefore_1.default);
dayjs_1.default.extend(utc_1.default);
exports.TIME_FORMAT = 'HH:mm';
/** "09:30" -> 570 minutes from midnight. */
function timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}
function minutesToTime(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
const isValidTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
exports.isValidTime = isValidTime;
/** Date-only value (midnight UTC) for MySQL DATE columns. */
function toDateOnly(value) {
    return dayjs_1.default.utc((0, dayjs_1.default)(value).format('YYYY-MM-DD')).toDate();
}
const startOfDay = (value = new Date()) => (0, dayjs_1.default)(value).startOf('day').toDate();
exports.startOfDay = startOfDay;
const endOfDay = (value = new Date()) => (0, dayjs_1.default)(value).endOf('day').toDate();
exports.endOfDay = endOfDay;
const addDays = (days, from = new Date()) => (0, dayjs_1.default)(from).add(days, 'day').toDate();
exports.addDays = addDays;
const daysUntil = (date) => (0, dayjs_1.default)(date).startOf('day').diff((0, dayjs_1.default)().startOf('day'), 'day');
exports.daysUntil = daysUntil;
/** 0 = Sunday .. 6 = Saturday, matching store_business_hours.dayOfWeek. */
const dayOfWeek = (date) => (0, dayjs_1.default)(date).day();
exports.dayOfWeek = dayOfWeek;
function buildSlots(openTime, closeTime, durationMins) {
    const slots = [];
    const open = timeToMinutes(openTime);
    const close = timeToMinutes(closeTime);
    if (durationMins <= 0 || close <= open)
        return slots;
    for (let start = open; start + durationMins <= close; start += durationMins) {
        slots.push({ startTime: minutesToTime(start), endTime: minutesToTime(start + durationMins) });
    }
    return slots;
}
//# sourceMappingURL=time.js.map