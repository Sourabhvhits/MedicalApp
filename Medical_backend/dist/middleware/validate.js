"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
const ApiError_1 = require("../utils/ApiError");
const toDetails = (error) => error.issues.map((issue) => ({
    field: issue.path.join('.') || undefined,
    message: issue.message,
    code: issue.code,
}));
/**
 * Validates and REPLACES req.body / req.query / req.params with the parsed
 * result, so controllers always receive coerced, trusted values.
 */
function validate(schemas) {
    return (req, _res, next) => {
        try {
            if (schemas.params)
                req.params = schemas.params.parse(req.params);
            if (schemas.query) {
                const parsed = schemas.query.parse(req.query);
                Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
            }
            if (schemas.body)
                req.body = schemas.body.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return next(ApiError_1.ApiError.unprocessable('Validation failed', toDetails(error)));
            }
            next(error);
        }
    };
}
//# sourceMappingURL=validate.js.map