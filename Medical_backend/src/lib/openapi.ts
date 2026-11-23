import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';
import { env } from '../config/env';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const errorSchema = registry.register(
  'ErrorResponse',
  z.object({
    success: z.literal(false),
    message: z.string(),
    code: z.string(),
    details: z
      .array(z.object({ field: z.string().optional(), message: z.string(), code: z.string().optional() }))
      .optional(),
  }),
);

const paginationMetaSchema = registry.register(
  'PaginationMeta',
  z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
);

export interface DocOptions {
  tags: string[];
  summary: string;
  description?: string;
  /** Request body schema (JSON) or multipart when `multipart` is true. */
  body?: ZodTypeAny;
  multipart?: boolean;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  /** Shape of the `data` field on a success response. */
  response?: ZodTypeAny;
  /** Marks the response as a paginated list of `response`. */
  paginated?: boolean;
  /** Set false for public endpoints. Defaults to true. */
  auth?: boolean;
  status?: number;
}

const JSON_CONTENT = 'application/json';

/**
 * Registers one endpoint in the OpenAPI document. Called next to the route
 * definition so documentation and routing never drift apart.
 */
export function doc(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  options: DocOptions,
): void {
  const dataSchema = options.response ?? z.any();
  const successBody = options.paginated
    ? z.object({
        success: z.literal(true),
        message: z.string(),
        data: z.array(dataSchema),
        meta: paginationMetaSchema,
      })
    : z.object({ success: z.literal(true), message: z.string(), data: dataSchema });

  registry.registerPath({
    method,
    path: `${env.API_PREFIX}${path}`,
    tags: options.tags,
    summary: options.summary,
    description: options.description,
    security: options.auth === false ? [] : [{ [bearerAuth.name]: [] }],
    request: {
      params: options.params as never,
      query: options.query as never,
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

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: `${env.APP_NAME} API`,
      version: '1.0.0',
      description:
        'REST API for the medical retail & wholesale marketplace: super admin masters, vendor wholesale, retailer storefronts and the customer pickup marketplace.',
    },
    servers: [{ url: env.APP_URL, description: env.NODE_ENV }],
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
