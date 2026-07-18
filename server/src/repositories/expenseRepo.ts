import type { CostBucket, ExpenseCategory } from '@asahi/shared';
import type { Db } from '../db/Db';
import { asDateString, monthRange } from '../db/dates';
import type { ExpenseLineRow, ExpenseSource } from '../db/types';

export interface ExpenseInput {
  staffId: number;
  expenseDate: string;
  category: ExpenseCategory;
  bucket: CostBucket;
  amountYen: number;
  description?: string | null;
  source: ExpenseSource;
}

function normalize(row: ExpenseLineRow): ExpenseLineRow {
  return { ...row, expense_date: asDateString(row.expense_date) };
}

export const expenseRepo = {
  async listForMonth(
    db: Db,
    staffId: number,
    month: string,
  ): Promise<ExpenseLineRow[]> {
    const { start, endExclusive } = monthRange(month);
    const { rows } = await db.query<ExpenseLineRow>(
      `SELECT * FROM expense_lines
       WHERE staff_id = $1 AND expense_date >= $2 AND expense_date < $3
       ORDER BY expense_date, id`,
      [staffId, start, endExclusive],
    );
    return rows.map(normalize);
  },

  async getById(db: Db, id: number): Promise<ExpenseLineRow | undefined> {
    const { rows } = await db.query<ExpenseLineRow>(
      `SELECT * FROM expense_lines WHERE id = $1`,
      [id],
    );
    return rows[0] ? normalize(rows[0]) : undefined;
  },

  async create(db: Db, e: ExpenseInput): Promise<ExpenseLineRow> {
    const { rows } = await db.query<ExpenseLineRow>(
      `INSERT INTO expense_lines
         (staff_id, expense_date, category, bucket, amount_yen, description, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        e.staffId,
        e.expenseDate,
        e.category,
        e.bucket,
        e.amountYen,
        e.description ?? null,
        e.source,
      ],
    );
    return normalize(rows[0]!);
  },

  async remove(db: Db, id: number): Promise<void> {
    await db.query(`DELETE FROM expense_lines WHERE id = $1`, [id]);
  },

  /** Delete the auto-generated transport lines for a staff member on a date. */
  async removeAutoTransport(
    db: Db,
    staffId: number,
    date: string,
  ): Promise<void> {
    await db.query(
      `DELETE FROM expense_lines
       WHERE staff_id = $1 AND expense_date = $2
         AND category = 'transport' AND source = 'auto'`,
      [staffId, date],
    );
  },

  /** Move a day's auto transport lines to a bucket (follows an attendance re-tag). */
  async setBucketForAutoTransport(
    db: Db,
    staffId: number,
    date: string,
    bucket: CostBucket,
  ): Promise<void> {
    await db.query(
      `UPDATE expense_lines SET bucket = $3
       WHERE staff_id = $1 AND expense_date = $2
         AND category = 'transport' AND source = 'auto'`,
      [staffId, date, bucket],
    );
  },
};
