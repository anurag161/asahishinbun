// Copies server SQL migrations into the build output (tsc doesn't move .sql files).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../server/src/db/migrations');
const dest = resolve(here, '../server/dist/db/migrations');

if (!existsSync(src)) {
  console.error(`No migrations directory at ${src}`);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied migrations → ${dest}`);
