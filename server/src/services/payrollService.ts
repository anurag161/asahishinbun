/**
 * Bridges storage → the pure engine. This is the ONLY place the API computes
 * money: load the month's rows, map them, and hand off to computePayroll.
 */

import {
  computePayroll,
  DEFAULT_RATES,
  type ExpenseLine,
  type PayrollResult,
} from '@asahi/shared';
import type { Db } from '../db/Db';
import { attendanceRepo } from '../repositories/attendanceRepo';
import { expenseRepo } from '../repositories/expenseRepo';
import { masterRepo } from '../repositories/masterRepo';
import {
  attendanceRowToDay,
  expenseRowToLine,
  rateRowToConfig,
} from '../domain/mappers';

export interface MonthPayroll {
  staffId: number;
  month: string;
  workDays: number;
  result: PayrollResult;
  /** The mapped expense lines that fed the result — the 別紙 sheets print them individually. */
  expenses: ExpenseLine[];
}

export async function computeForStaffMonth(
  db: Db,
  staffId: number,
  month: string,
): Promise<MonthPayroll> {
  const [attendanceRows, expenseRows, rateRow] = await Promise.all([
    attendanceRepo.listForMonth(db, staffId, month),
    expenseRepo.listForMonth(db, staffId, month),
    masterRepo.getLatestRates(db),
  ]);

  const rates = rateRow ? rateRowToConfig(rateRow) : DEFAULT_RATES;
  const expenses = expenseRows.map(expenseRowToLine);
  const result = computePayroll(attendanceRows.map(attendanceRowToDay), expenses, {
    rates,
  });

  return { staffId, month, workDays: attendanceRows.length, result, expenses };
}
