"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./lib/logger");
const prisma_1 = require("./database/prisma");
const redis_1 = require("./lib/redis");
const jobs_1 = require("./jobs");
async function bootstrap() {
    await (0, prisma_1.connectDatabase)();
    const app = (0, app_1.createApp)();
    const server = app.listen(env_1.env.PORT, () => {
        logger_1.logger.info(`${env_1.env.APP_NAME} API listening on ${env_1.env.APP_URL} (${env_1.env.NODE_ENV})`);
        logger_1.logger.info(`API docs available at ${env_1.env.APP_URL}/api-docs`);
    });
    if (env_1.env.ENABLE_CRON_JOBS)
        (0, jobs_1.startJobs)();
    const shutdown = async (signal) => {
        logger_1.logger.info({ signal }, 'Shutting down');
        (0, jobs_1.stopJobs)();
        server.close(async () => {
            await (0, prisma_1.disconnectDatabase)();
            await (0, redis_1.closeRedis)();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error({ err: reason }, 'Unhandled promise rejection');
    });
    process.on('uncaughtException', (error) => {
        logger_1.logger.fatal({ err: error }, 'Uncaught exception');
        process.exit(1);
    });
}
void bootstrap().catch((error) => {
    logger_1.logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
});
//# sourceMappingURL=server.js.map