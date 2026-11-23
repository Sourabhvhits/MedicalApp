"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = void 0;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.durationToMs = durationToMs;
const node_crypto_1 = __importDefault(require("node:crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const ApiError_1 = require("./ApiError");
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_ACCESS_SECRET, {
        expiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN,
    });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_REFRESH_SECRET, {
        expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN,
    });
}
function verifyAccessToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
    }
    catch {
        throw ApiError_1.ApiError.unauthorized('Invalid or expired access token');
    }
}
function verifyRefreshToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
    }
    catch {
        throw ApiError_1.ApiError.unauthorized('Invalid or expired refresh token');
    }
}
/** Refresh tokens are stored hashed so a database leak cannot be replayed. */
const hashToken = (token) => node_crypto_1.default.createHash('sha256').update(token).digest('hex');
exports.hashToken = hashToken;
/** Converts "30d" / "15m" / "3600" into milliseconds. */
function durationToMs(value) {
    const match = /^(\d+)([smhd])?$/.exec(value.trim());
    if (!match)
        return 0;
    const amount = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return amount * (multipliers[unit] ?? 1000);
}
//# sourceMappingURL=jwt.js.map