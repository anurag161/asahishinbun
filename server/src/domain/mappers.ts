/**
 * Map persisted DB rows into the pure engine's input types. This is the ONLY
 * bridge between storage and the calculation engine — the API and document layers
 * both go DB rows → mappers → computePayroll, so money is computed one way only.
 */

import type { AttendanceDay, ExpenseLine, RateConfig } from '@asahi/shared';
import type { AttendanceRow, ExpenseLineRow, RateConfigRow } from '../db/types';

export function attendanceRowToDay(row: AttendanceRow): AttendanceDay {
  return {
    date: row.work_date,
    bucket: row.bucket,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    breakMinutes: row.break_taken ? row.break_minutes : 0,
    overtimeMinutes: row.overtime_minutes,
    nightMinutes: row.night_minutes,
    tournament: row.tournament,
  };
}

export function expenseRowToLine(row: ExpenseLineRow): ExpenseLine {
  return {
    date: row.expense_date,
    bucket: row.bucket,
    category: row.category,
    amountYen: row.amount_yen,
    description: row.description ?? undefined,
  };
}

export function rateRowToConfig(row: RateConfigRow): RateConfig {
  return {
    hourlyYen: row.hourly_yen,
    overtimeUnder60Yen: row.overtime_under60_yen,
    overtimeOver60Yen: row.overtime_over60_yen,
    nightYen: row.night_yen,
    lunchYen: row.lunch_yen,
  };
}
