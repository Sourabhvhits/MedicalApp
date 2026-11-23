import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDev ? [{ emit: 'event', level: 'query' }, 'warn', 'error'] : ['warn', 'error'],
  });

if (env.isDev) {
  globalForPrisma.prisma = prisma;
  // @ts-expect-error - event typing depends on the log config above
  prisma.$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 200) logger.warn({ query: e.query, ms: e.duration }, 'slow query');
  });
}

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
