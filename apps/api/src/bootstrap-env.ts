/**
 * Loads environment variables from a `.env` file BEFORE any other module reads
 * `process.env`. Must be the first import in `main.ts`.
 *
 * Real environment variables (set by the hosting platform in production) ALWAYS
 * win — the `.env` file only fills in what isn't already set. In production a
 * `.env` file is normally absent (it's git-ignored and excluded from the Docker
 * image); this loader is a no-op then.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), 'apps/api/.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    // override: false — never let a stray file shadow platform-provided config.
    config({ path, override: false });
  }
}
