"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuth = optionalAuth;
exports.requireUserType = requireUserType;
const ApiError_1 = require("../utils/ApiError");
const jwt_1 = require("../utils/jwt");
function extractToken(req) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer '))
        return header.slice(7).trim();
    const cookieToken = req.cookies?.accessToken;
    return cookieToken ?? null;
}
/** Rejects the request unless a valid access token is present. */
function authenticate(req, _res, next) {
    const token = extractToken(req);
    if (!token)
        return next(ApiError_1.ApiError.unauthorized());
    const payload = (0, jwt_1.verifyAccessToken)(token);
    req.user = {
        id: payload.sub,
        userType: payload.userType,
        vendorId: payload.vendorId ?? null,
        retailerId: payload.retailerId ?? null,
        customerId: payload.customerId ?? null,
        permissions: payload.permissions ?? [],
    };
    next();
}
/** Attaches req.user when a token is present but never rejects. */
function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (!token)
        return next();
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = {
            id: payload.sub,
            userType: payload.userType,
            vendorId: payload.vendorId ?? null,
            retailerId: payload.retailerId ?? null,
            customerId: payload.customerId ?? null,
            permissions: payload.permissions ?? [],
        };
    }
    catch {
        // ignore — treated as an anonymous visitor
    }
    next();
}
function requireUserType(...types) {
    return (req, _res, next) => {
        if (!req.user)
            return next(ApiError_1.ApiError.unauthorized());
        if (!types.includes(req.user.userType)) {
            return next(ApiError_1.ApiError.forbidden('This endpoint is not available for your account type'));
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map