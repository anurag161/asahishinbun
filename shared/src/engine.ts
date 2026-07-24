/**
 * The payroll calculation engine — the ONE tested source of truth for every yen.
 * Pure and dependency-free: no DB, no HTTP, no dates-from-now. Given the same
 * inputs it always produces the same output, which is what the golden-master
 * test pins against the client's real documents.
 *
 * Money flow per the 請求明細書 / 給料計算書:
 *   給料 (課税分, ①+④) = Σ daily taxable wage + taxable expenses (私有携帯 phone)
 *   所得税             = Σ per-day 丙-table lookup on each day's taxable wage
 *   交通費 (②+⑤)      = transport + 出張日当 (per-diem)          [non-taxable]
 *   その他 (③+⑥)      = 宿泊実費 (lodging) + other               [non-taxable]
 *   支給額計           = 給料 + 交通費 + その他
 *   差引支給額         = 支給額計 − 所得税
 */

import type {
  AttendanceDay,
  CostBucket,
  DayComputation,
  ExpenseCategory,
  ExpenseLine,
  PayrollResult,
  RateConfig,
  TaxTable,
} from './types';
import { COST_BUCKETS } from './types';
import { roundYen, wageForMinutes } from './money';
import { lookupDailyTax, TAX_TABLE_REIWA8 } from './taxTable';
import {
  DEFAULT_RATES,
  LUNCH_MIN_WORKED_MINUTES,
  OVERTIME_MONTHLY_THRESHOLD_MINUTES,
} from './rates';

/** 私有携帯電話使用料 (phone) is the one taxable expense category → counts toward 給料. */
const TAXABLE_EXPENSE_CATEGORIES: ReadonlySet<ExpenseCategory> = new Set(['phone']);
/** ②+⑤ 交通費 group. */
const TRANSPORT_GROUP: ReadonlySet<ExpenseCategory> = new Set(['transport', 'perdiem']);
/** ③+⑥ その他 group. */
const OTHER_GROUP: ReadonlySet<ExpenseCategory> = new Set(['lodging', 'other']);

export interface EngineOptions {
  rates?: RateConfig;
  taxTable?: TaxTable;
}

export function computeWorkedMinutes(day: AttendanceDay): number {
  const worked = day.endMinutes - day.startMinutes - day.breakMinutes;
  if (worked < 0) {
    throw new RangeError(
      `Negative worked time on ${day.date}: end ${day.endMinutes} − start ` +
        `${day.startMinutes} − break ${day.breakMinutes}`,
    );
  }
  return worked;
}

export function computePayroll(
  attendance: AttendanceDay[],
  expenses: ExpenseLine[] = [],
  options: EngineOptions = {},
): PayrollResult {
  const rates = options.rates ?? DEFAULT_RATES;
  const taxTable = options.taxTable ?? TAX_TABLE_REIWA8;

  // Process days in chronological order so the monthly 60h overtime step is deterministic.
  const ordered = [...attendance].sort((a, b) => a.date.localeCompare(b.date));

  const days: DayComputation[] = [];
  let cumulativeOtMinutes = 0;
  let workedMinutesTotal = 0;
  let salaryFromWages = 0;
  let taxYen = 0;

  const byBucket = emptyBucketMap();

  for (const day of ordered) {
    const workedMinutes = computeWorkedMinutes(day);
    workedMinutesTotal += workedMinutes;

    const baseWageYen = wageForMinutes(workedMinutes, rates.hourlyYen);

    // Overtime premium: split across the monthly 60h boundary at ≤60h / >60h rates.
    const otMinutes = day.overtimeMinutes ?? 0;
    const overtimeWageYen = overtimePremium(otMinutes, cumulativeOtMinutes, rates);
    cumulativeOtMinutes += otMinutes;

    // Night premium.
    const nightMinutes = day.nightMinutes ?? 0;
    const nightWageYen = wageForMinutes(nightMinutes, rates.nightYen);

    // 弁当代: the staff's ○/× declaration (lunchAllowance), still gated on the
    // day exceeding 6 worked hours. Falls back to the legacy `tournament` flag for
    // any caller that predates lunchAllowance (the sample fixtures set neither).
    const lunchDeclared = (day.lunchAllowance ?? day.tournament) ?? false;
    const lunchProvided = lunchDeclared && workedMinutes > LUNCH_MIN_WORKED_MINUTES;
    const lunchYen = lunchProvided ? rates.lunchYen : 0;

    const dailyWageYen = baseWageYen + overtimeWageYen + nightWageYen + lunchYen;

    // Per-day withholding — looked up on the day's taxable wage, then summed.
    const { tax: dailyTaxYen, rank: taxRank } = lookupDailyTax(dailyWageYen, taxTable);

    salaryFromWages += dailyWageYen;
    taxYen += dailyTaxYen;
    byBucket[day.bucket].wageYen += dailyWageYen;

    days.push({
      date: day.date,
      bucket: day.bucket,
      startMinutes: day.startMinutes,
      endMinutes: day.endMinutes,
      breakMinutes: day.breakMinutes,
      overtimeMinutes: otMinutes,
      nightMinutes,
      workedMinutes,
      baseWageYen,
      overtimeWageYen,
      nightWageYen,
      lunchYen,
      lunchProvided,
      dailyWageYen,
      taxRank,
      dailyTaxYen,
    });
  }

  // Expenses.
  const expenseByCategory = emptyCategoryMap();
  let taxableExpenseYen = 0;
  let transportYen = 0;
  let otherYen = 0;

  for (const line of expenses) {
    expenseByCategory[line.category] += line.amountYen;
    byBucket[line.bucket].expenseYen += line.amountYen;

    if (TAXABLE_EXPENSE_CATEGORIES.has(line.category)) {
      taxableExpenseYen += line.amountYen;
    } else if (TRANSPORT_GROUP.has(line.category)) {
      transportYen += line.amountYen;
    } else if (OTHER_GROUP.has(line.category)) {
      otherYen += line.amountYen;
    }
  }

  const salaryYen = salaryFromWages + taxableExpenseYen;
  const grossYen = salaryYen + transportYen + otherYen;
  const netYen = grossYen - taxYen;

  return {
    days,
    workedMinutesTotal,
    salaryYen,
    taxYen,
    transportYen,
    otherYen,
    grossYen,
    netYen,
    byBucket,
    expenseByCategory,
  };
}

function overtimePremium(
  otMinutes: number,
  priorCumulativeOt: number,
  rates: RateConfig,
): number {
  if (otMinutes <= 0) return 0;

  const threshold = OVERTIME_MONTHLY_THRESHOLD_MINUTES;
  const beforeThreshold = Math.max(0, threshold - priorCumulativeOt);
  const under = Math.min(otMinutes, beforeThreshold);
  const over = otMinutes - under;

  return (
    wageForMinutes(under, rates.overtimeUnder60Yen) +
    wageForMinutes(over, rates.overtimeOver60Yen)
  );
}

function emptyBucketMap(): Record<CostBucket, { wageYen: number; expenseYen: number }> {
  const map = {} as Record<CostBucket, { wageYen: number; expenseYen: number }>;
  for (const b of COST_BUCKETS) map[b] = { wageYen: 0, expenseYen: 0 };
  return map;
}

function emptyCategoryMap(): Record<ExpenseCategory, number> {
  return { transport: 0, perdiem: 0, phone: 0, lodging: 0, other: 0 };
}
