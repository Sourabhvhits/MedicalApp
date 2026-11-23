"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const multer_1 = require("multer");
const ApiError_1 = require("../utils/ApiError");
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
function translatePrismaError(error) {
    const target = error.meta?.target ?? [];
    const fields = Array.isArray(target) ? target.join(', ') : String(target);
    switch (error.code) {
        case 'P2002':
            return ApiError_1.ApiError.conflict(`A record with this ${fields || 'value'} already exists`);
        case 'P2003':
            return ApiError_1.ApiError.badRequest('Related record not found — check the referenced ids');
        case 'P2025':
            return ApiError_1.ApiError.notFound('Record not found');
        case 'P2014':
            return ApiError_1.ApiError.badRequest('This change would break a required relation');
        default:
            return ApiError_1.ApiError.internal('Database request failed');
    }
}
function errorHandler(error, req, res, _next) {
    let apiError;
    if (error instanceof ApiError_1.ApiError) {
        apiError = error;
    }
    else if (error instanceof zod_1.ZodError) {
        apiError = ApiError_1.ApiError.unprocessable('Validation failed', error.issues.map((i) => ({ field: i.path.join('.'), message: i.message, code: i.code })));
    }
    else if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        apiError = translatePrismaError(error);
    }
    else if (error instanceof client_1.Prisma.PrismaClientValidationError) {
        apiError = ApiError_1.ApiError.badRequest('Invalid data supplied to the database layer');
    }
    else if (error instanceof multer_1.MulterError) {
        apiError =
            error.code === 'LIMIT_FILE_SIZE'
                ? ApiError_1.ApiError.badRequest(`File is larger than ${env_1.env.MAX_UPLOAD_SIZE_MB} MB`)
                : ApiError_1.ApiError.badRequest(error.message);
    }
    else {
        apiError = ApiError_1.ApiError.internal();
    }
    const logPayload = {
        method: req.method,
        url: req.originalUrl,
        statusCode: apiError.statusCode,
        userId: req.user?.id,
        err: error,
    };
    if (apiError.statusCode >= 500)
        logger_1.logger.error(logPayload, apiError.message);
    else
        logger_1.logger.warn(logPayload, apiError.message);
    const body = {
        success: false,
        message: apiError.message,
        code: apiError.code,
    };
    if (apiError.details)
        body.details = apiError.details;
    if (!env_1.env.isProd && error instanceof Error)
        body.stack = error.stack;
    res.status(apiError.statusCode).json(body);
}
function notFoundHandler(req, _res, next) {
    next(ApiError_1.ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}
//# sourceMappingURL=error.js.map