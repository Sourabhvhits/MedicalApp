"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = void 0;
exports.doc = doc;
exports.buildOpenApiDocument = buildOpenApiDocument;
const zod_to_openapi_1 = require("@asteasolutions/zod-to-openapi");
const zod_1 = require("zod");
const env_1 = require("../config/env");
(0, zod_to_openapi_1.extendZodWithOpenApi)(zod_1.z);
exports.registry = new zod_to_openapi_1.OpenAPIRegistry();
const bearerAuth = exports.registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});
const errorSchema = exports.registry.register('ErrorResponse', zod_1.z.object({
    success: zod_1.z.literal(false),
    message: zod_1.z.string(),
    code: zod_1.z.string(),
    details: zod_1.z
        .array(zod_1.z.object({ field: zod_1.z.string().optional(), message: zod_1.z.string(), code: zod_1.z.string().optional() }))
        .optional(),
}));
const paginationMetaSchema = exports.registry.register('PaginationMeta', zod_1.z.object({
    page: zod_1.z.number(),
    limit: zod_1.z.number(),
    total: zod_1.z.number(),
    totalPages: zod_1.z.number(),
    hasNext: zod_1.z.boolean(),
    hasPrev: zod_1.z.boolean(),
}));
const JSON_CONTENT = 'application/json';
/**
 * Registers one endpoint in the OpenAPI document. Called next to the route
 * definition so documentation and routing never drift apart.
 */
function doc(method, path, options) {
    const dataSchema = options.response ?? zod_1.z.any();
    const successBody = options.paginated
        ? zod_1.z.object({
            success: zod_1.z.literal(true),
            message: zod_1.z.string(),
            data: zod_1.z.array(dataSchema),
            meta: paginationMetaSchema,
        })
        : zod_1.z.object({ success: zod_1.z.literal(true), message: zod_1.z.string(), data: dataSchema });
    exports.registry.registerPath({
        method,
        path: `${env_1.env.API_PREFIX}${path}`,
        tags: options.tags,
        summary: options.summary,
        description: options.description,
        security: options.auth === false ? [] : [{ [bearerAuth.name]: [] }],
        request: {
            params: options.params,
            query: options.query,
            body: options.body
                ? {
                    content: {
                        [options.multipart ? 'multipart/form-data' : JSON_CONTENT]: { schema: options.body },
                    },
                }
                : undefined,
        },
        responses: {
            [options.status ?? (method === 'post' ? 201 : 200)]: {
                description: 'Successful response',
                content: { [JSON_CONTENT]: { schema: successBody } },
            },
            400: { description: 'Bad request', content: { [JSON_CONTENT]: { schema: errorSchema } } },
            401: { description: 'Unauthenticated', content: { [JSON_CONTENT]: { schema: errorSchema } } },
            403: { description: 'Forbidden', content: { [JSON_CONTENT]: { schema: errorSchema } } },
            404: { description: 'Not found', content: { [JSON_CONTENT]: { schema: errorSchema } } },
            422: { description: 'Validation failed', content: { [JSON_CONTENT]: { schema: errorSchema } } },
        },
    });
}
function buildOpenApiDocument() {
    const generator = new zod_to_openapi_1.OpenApiGeneratorV3(exports.registry.definitions);
    return generator.generateDocument({
        openapi: '3.0.3',
        info: {
            title: `${env_1.env.APP_NAME} API`,
            version: '1.0.0',
            description: 'REST API for the medical retail & wholesale marketplace: super admin masters, vendor wholesale, retailer storefronts and the customer pickup marketplace.',
        },
        servers: [{ url: env_1.env.APP_URL, description: env_1.env.NODE_ENV }],
        tags: [
            { name: 'Auth', description: 'Registration, login, OTP and session management' },
            { name: 'Admin', description: 'Super admin platform management' },
            { name: 'Admin Masters', description: 'Categories, manufacturers, units and product master' },
            { name: 'Vendor', description: 'Wholesaler catalog, stock and order management' },
            { name: 'Retailer', description: 'Store profile, catalog, stock, purchases and orders' },
            { name: 'Customer', description: 'Marketplace browsing, cart, checkout and orders' },
            { name: 'Inventory', description: 'Batch-wise stock, transactions and expiry' },
            { name: 'Reports', description: 'Sales, purchase, stock, expiry and GST reporting' },
            { name: 'Notifications', description: 'In-app notification feed' },
        ],
    });
}
//# sourceMappingURL=openapi.js.map