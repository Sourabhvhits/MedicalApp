"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const pino_http_1 = __importDefault(require("pino-http"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const env_1 = require("./config/env");
const logger_1 = require("./lib/logger");
const openapi_1 = require("./lib/openapi");
const error_1 = require("./middleware/error");
const rateLimit_1 = require("./middleware/rateLimit");
const routes_1 = __importDefault(require("./routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: env_1.env.isProd ? undefined : false,
    }));
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if (!origin || env_1.env.corsOrigins.includes(origin) || env_1.env.corsOrigins.includes('*')) {
                return callback(null, true);
            }
            callback(new Error(`Origin ${origin} is not allowed by CORS`));
        },
        credentials: true,
    }));
    app.use((0, compression_1.default)());
    app.use(express_1.default.json({ limit: '2mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '2mb' }));
    app.use((0, cookie_parser_1.default)());
    if (!env_1.env.isTest) {
        app.use((0, pino_http_1.default)({
            logger: logger_1.logger,
            autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
            customLogLevel: (_req, res, err) => {
                if (err || res.statusCode >= 500)
                    return 'error';
                if (res.statusCode >= 400)
                    return 'warn';
                return 'info';
            },
        }));
    }
    app.use(rateLimit_1.globalLimiter);
    // Uploaded documents and images
    app.use(`/${env_1.env.UPLOAD_DIR}`, express_1.default.static(node_path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR), { maxAge: '7d' }));
    app.use(env_1.env.API_PREFIX, routes_1.default);
    // API documentation
    const openApiDocument = (0, openapi_1.buildOpenApiDocument)();
    app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openApiDocument, {
        customSiteTitle: `${env_1.env.APP_NAME} API`,
        swaggerOptions: { persistAuthorization: true },
    }));
    app.get('/', (_req, res) => {
        res.json({
            success: true,
            message: `${env_1.env.APP_NAME} API`,
            data: { version: '1.0.0', docs: '/api-docs', api: env_1.env.API_PREFIX },
        });
    });
    app.use(error_1.notFoundHandler);
    app.use(error_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map