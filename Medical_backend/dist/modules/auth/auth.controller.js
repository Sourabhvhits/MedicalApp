"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeSession = exports.sessions = exports.me = exports.changePassword = exports.resetPassword = exports.forgotPassword = exports.logout = exports.refresh = exports.verifyOtp = exports.sendOtp = exports.login = exports.register = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const response_1 = require("../../utils/response");
const ApiError_1 = require("../../utils/ApiError");
const env_1 = require("../../config/env");
const jwt_1 = require("../../utils/jwt");
const authService = __importStar(require("./auth.service"));
const REFRESH_COOKIE = 'refreshToken';
function context(req) {
    return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}
function setRefreshCookie(res, token) {
    res.cookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: env_1.env.isProd,
        sameSite: 'lax',
        maxAge: (0, jwt_1.durationToMs)(env_1.env.JWT_REFRESH_EXPIRES_IN),
        path: '/',
    });
}
function readRefreshToken(req) {
    return req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE];
}
exports.register = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await authService.register(req.body, context(req));
    setRefreshCookie(res, result.tokens.refreshToken);
    return (0, response_1.created)(res, result, 'Registration successful');
});
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await authService.login(req.body, context(req));
    setRefreshCookie(res, result.tokens.refreshToken);
    return (0, response_1.ok)(res, result, 'Login successful');
});
exports.sendOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await authService.sendOtp(req.body.identifier, req.body.purpose);
    return (0, response_1.ok)(res, result, 'Verification code sent');
});
exports.verifyOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await authService.verifyOtp(req.body.identifier, req.body.purpose, req.body.code, context(req));
    if ('tokens' in result && result.tokens)
        setRefreshCookie(res, result.tokens.refreshToken);
    return (0, response_1.ok)(res, result, 'Verification successful');
});
exports.refresh = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const token = readRefreshToken(req);
    if (!token)
        throw ApiError_1.ApiError.unauthorized('Refresh token is required');
    const result = await authService.refresh(token, context(req));
    setRefreshCookie(res, result.tokens.refreshToken);
    return (0, response_1.ok)(res, result, 'Token refreshed');
});
exports.logout = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await authService.logout(readRefreshToken(req), req.user?.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return (0, response_1.noContent)(res, 'Logged out');
});
exports.forgotPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await authService.forgotPassword(req.body.identifier);
    return (0, response_1.ok)(res, result, 'If the account exists, a reset code has been sent');
});
exports.resetPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await authService.resetPassword(req.body.identifier, req.body.code, req.body.newPassword);
    return (0, response_1.ok)(res, result, 'Password reset successful');
});
exports.changePassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    return (0, response_1.ok)(res, result, 'Password changed');
});
exports.me = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const profile = await authService.me(req.user.id);
    return (0, response_1.ok)(res, profile);
});
exports.sessions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const list = await authService.listSessions(req.user.id);
    return (0, response_1.ok)(res, list);
});
exports.revokeSession = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await authService.revokeSession(req.user.id, req.params.id);
    return (0, response_1.noContent)(res, 'Session revoked');
});
//# sourceMappingURL=auth.controller.js.map