"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
exports.vendorScope = vendorScope;
exports.retailerScope = retailerScope;
exports.customerScope = customerScope;
const ApiError_1 = require("../utils/ApiError");
const isSuperAdmin = (req) => req.user?.userType === 'SUPER_ADMIN';
/** Requires every listed permission. Super admin always passes. */
function requirePermission(...codes) {
    return (req, _res, next) => {
        if (!req.user)
            return next(ApiError_1.ApiError.unauthorized());
        if (isSuperAdmin(req))
            return next();
        const missing = codes.filter((code) => !req.user.permissions.includes(code));
        if (missing.length > 0) {
            return next(ApiError_1.ApiError.forbidden(`Missing permission: ${missing.join(', ')}`));
        }
        next();
    };
}
/** Requires at least one of the listed permissions. */
function requireAnyPermission(...codes) {
    return (req, _res, next) => {
        if (!req.user)
            return next(ApiError_1.ApiError.unauthorized());
        if (isSuperAdmin(req))
            return next();
        if (!codes.some((code) => req.user.permissions.includes(code))) {
            return next(ApiError_1.ApiError.forbidden(`Requires one of: ${codes.join(', ')}`));
        }
        next();
    };
}
/** Guarantees req.user.vendorId exists and returns it. */
function vendorScope(req) {
    if (!req.user?.vendorId)
        throw ApiError_1.ApiError.forbidden('No vendor profile linked to this account');
    return req.user.vendorId;
}
/** Guarantees req.user.retailerId exists and returns it. */
function retailerScope(req) {
    if (!req.user?.retailerId)
        throw ApiError_1.ApiError.forbidden('No retailer profile linked to this account');
    return req.user.retailerId;
}
/** Guarantees req.user.customerId exists and returns it. */
function customerScope(req) {
    if (!req.user?.customerId)
        throw ApiError_1.ApiError.forbidden('No customer profile linked to this account');
    return req.user.customerId;
}
//# sourceMappingURL=rbac.js.map