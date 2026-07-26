import type { CostBucket } from '@asahi/shared';
import type { Db } from '../db/Db';
import { asDateString, monthRange } from '../db/dates';
import type { AttendanceRow } from '../db/types';

export interface AttendanceInput {
  staffId: number;
  workDate: string;
  stadiumId: number;
  startMinutes: number;
  endMinutes: number;
  breakTaken: boolean;
  breakMinutes: number;
  lunchAllowance: boolean;
  bucket: CostBucket;
  overtimeMinutes: number;
  nightMinutes: number;
  tournament: boolean;
}

function normalize(row: AttendanceRow): AttendanceRow {
  return { ...row, work_date: asDateString(row.work_date) };
}

export const attendanceRepo = {
  /**
   * Month of the most recent work day ('YYYY-MM'), or undefined if there is
   * none. Pass a staffId to scope it to one person; omit it for the whole org.
   *
   * max() is formatted in JS rather than with to_char so this behaves the same
   * on pg-mem (the demo/in-memory database) as on Neon.
   */
  async latestMonth(db: Db, staffId?: number): Promise<string | undefined> {
    const { rows } =
      staffId === undefined
        ? await db.query<{ d: unknown }>(`SELECT max(work_date) AS d FROM attendance`)
        : await db.query<{ d: unknown }>(
            `SELECT max(work_date) AS d FROM attendance WHERE staff_id = $1`,
            [staffId],
          );
    const d = rows[0]?.d;
    return d == null ? undefined : asDateString(d).slice(0, 7);
  },

  async listForMonth(
    db: Db,
    staffId: number,
    month: string,
  ): Promise<AttendanceRow[]> {
    const { start, endExclusive } = monthRange(month);
    const { rows } = await db.query<AttendanceRow>(
      `SELECT * FROM attendance
       WHERE staff_id = $1 AND work_date >= $2 AND work_date < $3
       ORDER BY work_date`,
      [staffId, start, endExclusive],
    );
    return rows.map(normalize);
  },

  async getById(db: Db, id: number): Promise<AttendanceRow | undefined> {
    const { rows } = await db.query<AttendanceRow>(
      `SELECT * FROM attendance WHERE id = $1`,
      [id],
    );
    return rows[0] ? normalize(rows[0]) : undefined;
  },

  async create(db: Db, a: AttendanceInput): Promise<AttendanceRow> {
    const { rows } = await db.query<AttendanceRow>(
      `INSERT INTO attendance
         (staff_id, work_date, stadium_id, start_minutes, end_minutes,
          break_taken, break_minutes, lunch_allowance,
          bucket, overtime_minutes, night_minutes, tournament)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        a.staffId,
        a.workDate,
        a.stadiumId,
        a.startMinutes,
        a.endMinutes,
        a.breakTaken,
        a.breakMinutes,
        a.lunchAllowance,
        a.bucket,
        a.overtimeMinutes,
        a.nightMinutes,
        a.tournament,
      ],
    );
    return normalize(rows[0]!);
  },

  async update(db: Db, id: number, a: AttendanceInput): Promise<AttendanceRow | undefined> {
    const { rows } = await db.query<AttendanceRow>(
      `UPDATE attendance SET
         work_date = $2, stadium_id = $3, start_minutes = $4, end_minutes = $5,
         break_taken = $6, break_minutes = $7, lunch_allowance = $8,
         bucket = $9, overtime_minutes = $10, night_minutes = $11, tournament = $12
       WHERE id = $1
       RETURNING *`,
      [
        id,
        a.workDate,
        a.stadiumId,
        a.startMinutes,
        a.endMinutes,
        a.breakTaken,
        a.breakMinutes,
        a.lunchAllowance,
        a.bucket,
        a.overtimeMinutes,
        a.nightMinutes,
        a.tournament,
      ],
    );
    return rows[0] ? normalize(rows[0]) : undefined;
  },

  async updateBucket(
    db: Db,
    id: number,
    bucket: CostBucket,
  ): Promise<AttendanceRow | undefined> {
    const { rows } = await db.query<AttendanceRow>(
      `UPDATE attendance SET bucket = $2 WHERE id = $1 RETURNING *`,
      [id, bucket],
    );
    return rows[0] ? normalize(rows[0]) : undefined;
  },

  async remove(db: Db, id: number): Promise<void> {
    await db.query(`DELETE FROM attendance WHERE id = $1`, [id]);
  },

  /** All staff who have any attendance in the month (for the admin review screen). */
  async staffWithActivity(db: Db, month: string): Promise<number[]> {
    const { start, endExclusive } = monthRange(month);
    const { rows } = await db.query<{ staff_id: number }>(
      `SELECT DISTINCT staff_id FROM attendance
       WHERE work_date >= $1 AND work_date < $2
       ORDER BY staff_id`,
      [start, endExclusive],
    );
    return rows.map((r) => r.staff_id);
  },
};
