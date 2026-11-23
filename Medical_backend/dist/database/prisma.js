"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: env_1.env.isDev ? [{ emit: 'event', level: 'query' }, 'warn', 'error'] : ['warn', 'error'],
    });
if (env_1.env.isDev) {
    globalForPrisma.prisma = exports.prisma;
    // @ts-expect-error - event typing depends on the log config above
    exports.prisma.$on('query', (e) => {
        if (e.duration > 200)
            logger_1.logger.warn({ query: e.query, ms: e.duration }, 'slow query');
    });
}
async function connectDatabase() {
    await exports.prisma.$connect();
    logger_1.logger.info('Database connected');
}
async function disconnectDatabase() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=prisma.js.map