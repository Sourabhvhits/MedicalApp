"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAudit = recordAudit;
exports.auditFromRequest = auditFromRequest;
const prisma_1 = require("../database/prisma");
const logger_1 = require("./logger");
const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'codeHash', 'refreshTokenHash', 'otp']);
function sanitize(value) {
    if (value === undefined || value === null)
        return undefined;
    const seen = new WeakSet();
    const walk = (input) => {
        if (input === null || typeof input !== 'object') {
            return typeof input === 'bigint' ? input.toString() : input;
        }
        if (seen.has(input))
            return '[circular]';
        seen.add(input);
        if (Array.isArray(input))
            return input.map(walk);
        if (input instanceof Date)
            return input.toISOString();
        return Object.fromEntries(Object.entries(input)
            .filter(([key]) => !SENSITIVE_KEYS.has(key))
            .map(([key, val]) => [key, walk(val)]));
    };
    return walk(value);
}
/**
 * Writes an audit entry. Never throws — a failed audit write must not roll back
 * or fail the business operation that triggered it.
 */
async function recordAudit(input) {
    try {
        await prisma_1.prisma.auditLog.create({
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
    }
    catch (error) {
        logger_1.logger.error({ err: error, action: input.action }, 'Failed to write audit log');
    }
}
/** Convenience wrapper that pulls actor and request context off an Express request. */
function auditFromRequest(req, input) {
    return recordAudit({
        ...input,
        userId: req.user?.id ?? null,
        userType: req.user?.userType ?? null,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    });
}
//# sourceMappingURL=audit.js.map