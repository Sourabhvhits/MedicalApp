"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpExpiry = exports.hashOtp = void 0;
exports.generateOtp = generateOtp;
const node_crypto_1 = __importDefault(require("node:crypto"));
const env_1 = require("../config/env");
function generateOtp(length = env_1.env.OTP_LENGTH) {
    const max = 10 ** length;
    const value = node_crypto_1.default.randomInt(0, max);
    return value.toString().padStart(length, '0');
}
const hashOtp = (code) => node_crypto_1.default.createHash('sha256').update(code).digest('hex');
exports.hashOtp = hashOtp;
const otpExpiry = () => new Date(Date.now() + env_1.env.OTP_EXPIRY_MINUTES * 60 * 1000);
exports.otpExpiry = otpExpiry;
//# sourceMappingURL=otp.js.map