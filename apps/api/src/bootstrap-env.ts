/**
 * Loads environment variables from the repo-root `.env` (and a local `apps/api/.env`
 * override, if present) BEFORE any other module reads `process.env`.
 * Must be the first import in `main.ts`.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: true });
  }
}
