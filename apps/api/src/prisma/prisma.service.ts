import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@slay/db';

/**
 * Connection errors that are safe to retry: the server closed an idle connection
 * (common with Neon / serverless Postgres that auto-suspends), a transient
 * network blip, or the pool timed out handing one out.
 */
const RETRYABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return !!code && RETRYABLE_CODES.has(code);
}

function createPrismaClient() {
  return new PrismaClient().$extends({
    name: 'retry-on-connection-drop',
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 1; ; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (attempt >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
            await sleep(250 * attempt);
          }
        }
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Declaration merging: the class instance is typed with every member of the
// extended client, while the constructor actually returns that client.
export interface PrismaService extends ExtendedPrismaClient {}

@Injectable()
export class PrismaService {
  constructor() {
    return createPrismaClient() as unknown as PrismaService;
  }
}
