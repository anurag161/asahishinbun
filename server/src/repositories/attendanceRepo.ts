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
  bucket: CostBucket;
  overtimeMinutes: number;
  nightMinutes: number;
  tournament: boolean;
}

function normalize(row: AttendanceRow): AttendanceRow {
  return { ...row, work_date: asDateString(row.work_date) };
}

export const attendanceRepo = {
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
          break_taken, break_minutes, bucket, overtime_minutes, night_minutes, tournament)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        a.staffId,
        a.workDate,
        a.stadiumId,
        a.startMinutes,
        a.endMinutes,
        a.breakTaken,
        a.breakMinutes,
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
         break_taken = $6, break_minutes = $7, bucket = $8,
         overtime_minutes = $9, night_minutes = $10, tournament = $11
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
        a.bucket,
        a.overtimeMinutes,
        a.nightMinutes,
        a.tournament,
      ],
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
