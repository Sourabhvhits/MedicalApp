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
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const controller = __importStar(require("./auth.controller"));
const auth_validation_1 = require("./auth.validation");
const router = (0, express_1.Router)();
router.post('/register', rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_validation_1.registerSchema }), controller.register);
router.post('/login', rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_validation_1.loginSchema }), controller.login);
router.post('/send-otp', rateLimit_1.otpLimiter, (0, validate_1.validate)({ body: auth_validation_1.sendOtpSchema }), controller.sendOtp);
router.post('/verify-otp', rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_validation_1.verifyOtpSchema }), controller.verifyOtp);
router.post('/refresh', (0, validate_1.validate)({ body: auth_validation_1.refreshSchema }), controller.refresh);
router.post('/logout', controller.logout);
router.post('/forgot-password', rateLimit_1.otpLimiter, (0, validate_1.validate)({ body: auth_validation_1.forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password', rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_validation_1.resetPasswordSchema }), controller.resetPassword);
router.use(auth_1.authenticate);
router.get('/me', controller.me);
router.post('/change-password', (0, validate_1.validate)({ body: auth_validation_1.changePasswordSchema }), controller.changePassword);
router.get('/sessions', controller.sessions);
router.delete('/sessions/:id', (0, validate_1.validate)({ params: zod_1.z.object({ id: zod_1.z.string().uuid() }) }), controller.revokeSession);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map