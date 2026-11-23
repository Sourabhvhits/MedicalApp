"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
class ApiError extends Error {
    statusCode;
    code;
    details;
    isOperational = true;
    constructor(statusCode, message, code = 'ERROR', details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
    static badRequest(message = 'Bad request', details) {
        return new ApiError(400, message, 'BAD_REQUEST', details);
    }
    static unauthorized(message = 'Authentication required') {
        return new ApiError(401, message, 'UNAUTHORIZED');
    }
    static forbidden(message = 'You do not have permission to perform this action') {
        return new ApiError(403, message, 'FORBIDDEN');
    }
    static notFound(message = 'Resource not found') {
        return new ApiError(404, message, 'NOT_FOUND');
    }
    static conflict(message = 'Resource already exists') {
        return new ApiError(409, message, 'CONFLICT');
    }
    static unprocessable(message = 'Validation failed', details) {
        return new ApiError(422, message, 'VALIDATION_ERROR', details);
    }
    static tooMany(message = 'Too many requests') {
        return new ApiError(429, message, 'RATE_LIMITED');
    }
    static internal(message = 'Something went wrong') {
        return new ApiError(500, message, 'INTERNAL_ERROR');
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=ApiError.js.map