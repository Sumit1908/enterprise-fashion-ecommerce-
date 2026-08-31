/**
 * Shared Prisma client for all apps (API, workers, scripts).
 * Import from `@slay/db` (internal workspace package name, unrelated to the brand):
 *
 *   import { prisma, Prisma, OrderStatus } from '@slay/db';
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export { PrismaClient };
