import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

const isSuperAdmin = (req: Request) => req.user?.userType === 'SUPER_ADMIN';

/** Requires every listed permission. Super admin always passes. */
export function requirePermission(...codes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isSuperAdmin(req)) return next();

    const missing = codes.filter((code) => !req.user!.permissions.includes(code));
    if (missing.length > 0) {
      return next(ApiError.forbidden(`Missing permission: ${missing.join(', ')}`));
    }
    next();
  };
}

/** Requires at least one of the listed permissions. */
export function requireAnyPermission(...codes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isSuperAdmin(req)) return next();

    if (!codes.some((code) => req.user!.permissions.includes(code))) {
      return next(ApiError.forbidden(`Requires one of: ${codes.join(', ')}`));
    }
    next();
  };
}

/** Guarantees req.user.vendorId exists and returns it. */
export function vendorScope(req: Request): string {
  if (!req.user?.vendorId) throw ApiError.forbidden('No vendor profile linked to this account');
  return req.user.vendorId;
}

/** Guarantees req.user.retailerId exists and returns it. */
export function retailerScope(req: Request): string {
  if (!req.user?.retailerId) throw ApiError.forbidden('No retailer profile linked to this account');
  return req.user.retailerId;
}

/** Guarantees req.user.customerId exists and returns it. */
export function customerScope(req: Request): string {
  if (!req.user?.customerId) throw ApiError.forbidden('No customer profile linked to this account');
  return req.user.customerId;
}
