/**
 * Schema round-trip test (in-memory Postgres via pg-mem).
 *
 * Proves the Phase 2 data model is coherent end-to-end WITHOUT needing a live
 * Neon database:
 *   1. apply the real migration SQL,
 *   2. seed the June 2026 sample via the same seeder the app uses,
 *   3. read attendance + expenses back out,
 *   4. reconstruct engine input via the domain mappers,
 *   5. assert computePayroll STILL reproduces the client's documents to the yen.
 *
 * If storage and the engine ever drift, this fails.
 */

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { newDb, type IMemoryDb } from 'pg-mem';
import { computePayroll } from '@asahi/shared';
import { seedSampleMonth } from './sampleData';
import { attendanceRowToDay, expenseRowToLine } from '../domain/mappers';
import type { AttendanceRow, ExpenseLineRow } from './types';

function toDateStr(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

describe('Phase 2 data model — schema + seed round-trip (pg-mem)', () => {
  let db: IMemoryDb;
  let query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

  beforeAll(async () => {
    db = newDb();
    const { Pool } = db.adapters.createPg();
    const pool = new Pool();
    query = (sql: string, params?: unknown[]) => pool.query(sql, params);

    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '001_initial_schema.sql'),
      'utf8',
    );
    await query(sql);
    await seedSampleMonth({ query });
  });

  it('creates all core tables', async () => {
    const { rows } = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = rows.map((r) => r.table_name).sort();
    expect(names).toEqual(
      [
        'attendance',
        'expense_lines',
        'rate_config',
        'route_fares',
        'staff_profiles',
        'stadiums',
        'users',
      ].sort(),
    );
  });

  it('seeds one admin + one staff with a profile', async () => {
    const users = await query(`SELECT role FROM users ORDER BY role`);
    expect(users.rows.map((r) => r.role)).toEqual(['admin', 'staff']);

    const profiles = await query(
      `SELECT home_nearest_station FROM staff_profiles`,
    );
    expect(profiles.rows).toHaveLength(1);
    expect(profiles.rows[0].home_nearest_station).toBe('円山');
  });

  it('seeds 14 attendance days and 28 transport lines', async () => {
    const att = await query(`SELECT count(*)::int AS n FROM attendance`);
    expect(att.rows[0].n).toBe(14);
    const exp = await query(
      `SELECT count(*)::int AS n FROM expense_lines WHERE category = 'transport'`,
    );
    expect(exp.rows[0].n).toBe(28);
  });

  it('reproduces the golden master from DB rows → engine (¥185,152 net)', async () => {
    const att = await query(`SELECT * FROM attendance ORDER BY work_date`);
    const exp = await query(`SELECT * FROM expense_lines ORDER BY expense_date`);

    const attendance = (att.rows as AttendanceRow[]).map((r) =>
      attendanceRowToDay({ ...r, work_date: toDateStr(r.work_date) }),
    );
    const expenses = (exp.rows as ExpenseLineRow[]).map((r) =>
      expenseRowToLine({ ...r, expense_date: toDateStr(r.expense_date) }),
    );

    const result = computePayroll(attendance, expenses);

    expect(result.salaryYen).toBe(131_300);
    expect(result.taxYen).toBe(188);
    expect(result.transportYen).toBe(54_040);
    expect(result.grossYen).toBe(185_340);
    expect(result.netYen).toBe(185_152);
  });

  it('enforces one attendance row per staff per day', async () => {
    const staff = await query(`SELECT id FROM users WHERE role = 'staff'`);
    const staffId = staff.rows[0].id;
    const stadium = await query(`SELECT id FROM stadiums LIMIT 1`);
    const stadiumId = stadium.rows[0].id;

    await expect(
      query(
        `INSERT INTO attendance
           (staff_id, work_date, stadium_id, start_minutes, end_minutes, break_taken, break_minutes)
         VALUES ($1, '2026-06-01', $2, 600, 1140, true, 60)`,
        [staffId, stadiumId],
      ),
    ).rejects.toThrow();
  });
});
