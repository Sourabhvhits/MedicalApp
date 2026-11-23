"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
const skip = () => env_1.env.isTest;
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    message: { success: false, message: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});
/** Login / register / password reset — tight limit to slow credential stuffing. */
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    message: { success: false, message: 'Too many authentication attempts, please try again later', code: 'RATE_LIMITED' },
});
/** OTP requests are the most abusable endpoint (they cost money to send). */
exports.otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    message: { success: false, message: 'Too many OTP requests, please wait before retrying', code: 'RATE_LIMITED' },
});
//# sourceMappingURL=rateLimit.js.map