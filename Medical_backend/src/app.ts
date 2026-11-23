import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './lib/logger';
import { buildOpenApiDocument } from './lib/openapi';
import { verifyFileSignature } from './lib/signed-url';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalLimiter } from './middleware/rateLimit';
import { handlePaymentGatewayWebhook } from './modules/orders/payment-webhook';
import routes from './routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: env.isProd ? undefined : false,
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.use(compression());

  // Registered ahead of express.json() so the body reaches the handler
  // unparsed — signature verification needs the exact raw bytes. The header
  // name is provider-specific (e.g. `x-razorpay-signature`, `stripe-signature`)
  // — update it once a provider is chosen in lib/payment-gateway.ts.
  app.post(
    '/webhooks/payment-gateway',
    express.raw({ type: '*/*', limit: '1mb' }),
    async (req, res) => {
      const verified = await handlePaymentGatewayWebhook(
        req.body as Buffer,
        req.headers['x-webhook-signature'] as string | undefined,
      );
      res.status(verified ? 200 : 400).json({ received: verified });
    },
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      }),
    );
  }

  app.use(globalLimiter);

  // Uploaded documents and images — prescriptions and KYC documents are
  // sensitive, so this is NOT a plain express.static mount. Every request
  // must carry a short-lived HMAC signature (`lib/signed-url.ts`); the
  // endpoints that hand out those signed URLs are the ones that actually
  // check the requester owns/may see the specific document (TASKS.md P).
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  app.get(`/${env.UPLOAD_DIR}/*`, (req, res) => {
    const relativePath = (req.params as unknown as string[])[0] ?? '';
    if (!verifyFileSignature(relativePath, req.query.exp, req.query.sig)) {
      return res.status(403).json({
        success: false,
        message: 'This link has expired or is invalid — request a fresh one',
        code: 'SIGNATURE_INVALID',
      });
    }

    const filePath = path.resolve(uploadRoot, relativePath);
    if (!filePath.startsWith(uploadRoot)) {
      return res.status(400).json({ success: false, message: 'Invalid path', code: 'BAD_PATH' });
    }

    res.set('Cache-Control', 'private, max-age=60');
    return res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ success: false, message: 'File not found' });
    });
  });

  app.use(env.API_PREFIX, routes);

  // API documentation
  const openApiDocument = buildOpenApiDocument();
  app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: `${env.APP_NAME} API`,
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: `${env.APP_NAME} API`,
      data: { version: '1.0.0', docs: '/api-docs', api: env.API_PREFIX },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
