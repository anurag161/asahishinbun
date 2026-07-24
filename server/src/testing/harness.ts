/**
 * Test harness: spins up the real Express app on an in-memory Postgres (pg-mem),
 * seeded with the June 2026 sample and known demo credentials. No live DB needed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import type { Express } from 'express';
import { createApp, type AppDeps } from '../app';
import type { Db } from '../db/Db';
import { seedSampleMonth, type SeedResult } from '../db/sampleData';
import { hashPassword } from '../auth/password';
import { signToken } from '../auth/jwt';

export interface TestContext extends SeedResult {
  app: Express;
  db: Db;
  adminToken: string;
  staffToken: string;
}

export async function makeTestContext(deps: AppDeps = {}): Promise<TestContext> {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const db: Db = { query: (sql: string, params?: unknown[]) => pool.query(sql, params) };

  // Apply every migration in order (mirrors migrate.ts / memoryDb) so the schema
  // under test always matches production — not just the initial 001.
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }

  const [adminPasswordHash, staffPasswordHash] = await Promise.all([
    hashPassword('admin123'),
    hashPassword('staff123'),
  ]);
  const seeded = await seedSampleMonth(db, { adminPasswordHash, staffPasswordHash });

  return {
    app: createApp(db, deps),
    db,
    ...seeded,
    adminToken: signToken({ id: seeded.adminId, role: 'admin' }),
    staffToken: signToken({ id: seeded.staffId, role: 'staff' }),
  };
}
