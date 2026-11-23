import type { Request } from 'express';
import type { Prisma, UserType } from '@prisma/client';
import { prisma } from '../database/prisma';
import { logger } from './logger';

export interface AuditInput {
  userId?: string | null;
  userType?: UserType | null;
  action: string;
  module: string;
  recordId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'codeHash', 'refreshTokenHash', 'otp']);

function sanitize(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const seen = new WeakSet<object>();
  const walk = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return typeof input === 'bigint' ? input.toString() : input;
    }
    if (seen.has(input as object)) return '[circular]';
    seen.add(input as object);
    if (Array.isArray(input)) return input.map(walk);
    if (input instanceof Date) return input.toISOString();
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_KEYS.has(key))
        .map(([key, val]) => [key, walk(val)]),
    );
  };
  return walk(value) as Prisma.InputJsonValue;
}

/**
 * Writes an audit entry. Never throws — a failed audit write must not roll back
 * or fail the business operation that triggered it.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userType: input.userType ?? null,
        action: input.action,
        module: input.module,
        recordId: input.recordId ?? null,
        oldValue: sanitize(input.oldValue),
        newValue: sanitize(input.newValue),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, 'Failed to write audit log');
  }
}

/** Convenience wrapper that pulls actor and request context off an Express request. */
export function auditFromRequest(
  req: Request,
  input: Omit<AuditInput, 'userId' | 'userType' | 'ipAddress' | 'userAgent'>,
): Promise<void> {
  return recordAudit({
    ...input,
    userId: req.user?.id ?? null,
    userType: req.user?.userType ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
}
