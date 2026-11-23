import type { NextFunction, Request, Response } from 'express';
import type { UserType } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.accessToken;
  return cookieToken ?? null;
}

/** Rejects the request unless a valid access token is present. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized());

  const payload = verifyAccessToken(token);
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
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      userType: payload.userType,
      vendorId: payload.vendorId ?? null,
      retailerId: payload.retailerId ?? null,
      customerId: payload.customerId ?? null,
      permissions: payload.permissions ?? [],
    };
  } catch {
    // ignore — treated as an anonymous visitor
  }
  next();
}

export function requireUserType(...types: UserType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!types.includes(req.user.userType)) {
      return next(ApiError.forbidden('This endpoint is not available for your account type'));
    }
    next();
  };
}
