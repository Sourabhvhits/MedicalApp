import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { env } from '../../config/env';
import { durationToMs } from '../../utils/jwt';
import * as authService from './auth.service';

const REFRESH_COOKIE = 'refreshToken';

function context(req: Request): authService.SessionContext {
  return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
    path: '/',
  });
}

function readRefreshToken(req: Request): string | undefined {
  return req.body?.refreshToken || (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
}

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, context(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return created(res, result, 'Registration successful');
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, context(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return ok(res, result, 'Login successful');
});

export const sendOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendOtp(req.body.identifier, req.body.purpose);
  return ok(res, result, 'Verification code sent');
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(
    req.body.identifier,
    req.body.purpose,
    req.body.code,
    context(req),
  );
  if ('tokens' in result && result.tokens) setRefreshCookie(res, result.tokens.refreshToken);
  return ok(res, result, 'Verification successful');
});

export const refresh = asyncHandler(async (req, res) => {
  const token = readRefreshToken(req);
  if (!token) throw ApiError.unauthorized('Refresh token is required');

  const result = await authService.refresh(token, context(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return ok(res, result, 'Token refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(readRefreshToken(req), req.user?.id);
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  return noContent(res, 'Logged out');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.identifier);
  return ok(res, result, 'If the account exists, a reset code has been sent');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(
    req.body.identifier,
    req.body.code,
    req.body.newPassword,
  );
  return ok(res, result, 'Password reset successful');
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    req.user!.id,
    req.body.currentPassword,
    req.body.newPassword,
  );
  return ok(res, result, 'Password changed');
});

export const me = asyncHandler(async (req, res) => {
  const profile = await authService.me(req.user!.id);
  return ok(res, profile);
});

export const sessions = asyncHandler(async (req, res) => {
  const list = await authService.listSessions(req.user!.id);
  return ok(res, list);
});

export const revokeSession = asyncHandler(async (req, res) => {
  await authService.revokeSession(req.user!.id, req.params.id);
  return noContent(res, 'Session revoked');
});
