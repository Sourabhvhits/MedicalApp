"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isZero = exports.toNumber = exports.sum = exports.round2 = exports.D = void 0;
const client_1 = require("@prisma/client");
const D = (value) => new client_1.Prisma.Decimal(value ?? 0);
exports.D = D;
/** Rounds to 2 decimals (half-up) — the rounding used for all money fields. */
const round2 = (value) => (0, exports.D)(value).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
exports.round2 = round2;
const sum = (values) => values.reduce((acc, v) => acc.add((0, exports.D)(v)), (0, exports.D)(0));
exports.sum = sum;
const toNumber = (value) => value === null || value === undefined ? 0 : (0, exports.D)(value).toNumber();
exports.toNumber = toNumber;
const isZero = (value) => (0, exports.D)(value).isZero();
exports.isZero = isZero;
//# sourceMappingURL=money.js.map