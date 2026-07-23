/**
 * Zero-setup demo database: an in-memory Postgres (pg-mem) that is migrated and
 * seeded with the June 2026 sample on boot. Lets the whole app run with a single
 * `npm run dev` — no Neon, no .env, no config. Data resets on restart.
 *
 * Used automatically when DATABASE_URL is not set. pg-mem is dynamically imported
 * so it never becomes a hard/production dependency.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './Db';
import { config } from '../config';
import { seedSampleMonth, seedDemoRoster } from './sampleData';
import { hashPassword } from '../auth/password';

export async function createMemoryDb(): Promise<Db> {
  const { newDb } = await import('pg-mem' as string);
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const db: Db = { query: (sql: string, params?: unknown[]) => pool.query(sql, params) };

  // Apply every migration SQL file in order.
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }

  // Seed the sample month with working demo credentials.
  const [adminPasswordHash, staffPasswordHash] = await Promise.all([
    hashPassword('admin123'),
    hashPassword('staff123'),
  ]);
  await seedSampleMonth(db, {
    adminPasswordHash,
    staffPasswordHash,
    staffEmail: config.demoStaffEmail,
  });
  // Fuller roster so the admin review screen looks like a real operation.
  await seedDemoRoster(db, { staffPasswordHash });

  return db;
}
