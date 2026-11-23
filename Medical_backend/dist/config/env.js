"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config({ path: node_path_1.default.resolve(process.cwd(), '.env') });
const boolish = (def) => zod_1.z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().default(5000),
    API_PREFIX: zod_1.z.string().default('/api/v1'),
    APP_NAME: zod_1.z.string().default('Medical Marketplace'),
    APP_URL: zod_1.z.string().default('http://localhost:5000'),
    FRONTEND_URL: zod_1.z.string().default('http://localhost:3000'),
    CORS_ORIGINS: zod_1.z.string().default('http://localhost:3000'),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    BCRYPT_ROUNDS: zod_1.z.coerce.number().default(12),
    OTP_EXPIRY_MINUTES: zod_1.z.coerce.number().default(10),
    OTP_LENGTH: zod_1.z.coerce.number().default(6),
    OTP_MAX_ATTEMPTS: zod_1.z.coerce.number().default(5),
    UPLOAD_DIR: zod_1.z.string().default('uploads'),
    MAX_UPLOAD_SIZE_MB: zod_1.z.coerce.number().default(5),
    PUBLIC_UPLOAD_BASE_URL: zod_1.z.string().default('http://localhost:5000/uploads'),
    REDIS_URL: zod_1.z.string().optional().default(''),
    SMTP_HOST: zod_1.z.string().optional().default(''),
    SMTP_PORT: zod_1.z.coerce.number().default(587),
    SMTP_USER: zod_1.z.string().optional().default(''),
    SMTP_PASS: zod_1.z.string().optional().default(''),
    MAIL_FROM: zod_1.z.string().default('Medical Marketplace <no-reply@example.com>'),
    SMS_PROVIDER: zod_1.z.string().optional().default(''),
    SMS_API_KEY: zod_1.z.string().optional().default(''),
    SMS_SENDER_ID: zod_1.z.string().optional().default(''),
    DEFAULT_SEARCH_RADIUS_KM: zod_1.z.coerce.number().default(5),
    MAX_SEARCH_RADIUS_KM: zod_1.z.coerce.number().default(50),
    ORDER_AUTO_EXPIRE_HOURS: zod_1.z.coerce.number().default(24),
    ENABLE_CRON_JOBS: boolish(true),
    SEED_ADMIN_EMAIL: zod_1.z.string().default('admin@medsaas.test'),
    SEED_ADMIN_PASSWORD: zod_1.z.string().default('Admin@12345'),
    SEED_ADMIN_PHONE: zod_1.z.string().default('9000000001'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
}
exports.env = {
    ...parsed.data,
    isProd: parsed.data.NODE_ENV === 'production',
    isDev: parsed.data.NODE_ENV === 'development',
    isTest: parsed.data.NODE_ENV === 'test',
    corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
};
//# sourceMappingURL=env.js.map