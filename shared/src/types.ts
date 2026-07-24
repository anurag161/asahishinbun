/**
 * Domain types for the Asahi part-time payroll engine.
 *
 * All money is integer yen. All time-of-day is "minutes from midnight".
 * Cost buckets mirror the client's timesheet:
 *   - 'daikai' = 大会経費（直接費）  (tournament / direct cost)
 *   - 'henshu' = 編集費（間接費）    (editorial / indirect cost)
 */

export type CostBucket = 'daikai' | 'henshu';

export const COST_BUCKETS: readonly CostBucket[] = ['daikai', 'henshu'];

/** Japanese labels for the buckets, as they appear on the documents. */
export const BUCKET_LABEL: Record<CostBucket, string> = {
  daikai: '大会経費（直接費）',
  henshu: '編集費（間接費）',
};

/** Admin-editable pay rates (¥), from the 請求明細書 rate lines. */
export interface RateConfig {
  /** 時給 */
  hourlyYen: number;
  /** 時間外 60h 以下（割増分） */
  overtimeUnder60Yen: number;
  /** 時間外 60h 超（割増分） */
  overtimeOver60Yen: number;
  /** 深夜割増（22:00 以降） */
  nightYen: number;
  /** 弁当代（定額） — flat amount when eligible */
  lunchYen: number;
}

/** One bracket of the 源泉徴収税額表（日額表・丙）. */
export interface TaxBracket {
  /** 税額ランク — the row index in the 丙 table (1-based). */
  rank: number;
  /** 以上 (inclusive lower bound, yen). */
  min: number;
  /** 未満 (exclusive upper bound, yen). */
  max: number;
  /** 税額（丙）for a daily wage in this bracket. */
  tax: number;
}

export interface TaxTable {
  /** e.g. '令和8年' */
  year: string;
  category: '丙';
  /** Ordered, contiguous brackets. */
  brackets: TaxBracket[];
}

export type ExpenseCategory =
  | 'transport' // 交通費
  | 'perdiem' // 出張日当
  | 'phone' // 私有携帯電話使用料
  | 'lodging' // 宿泊実費
  | 'other'; // その他

/** A single day of attendance (staff-entered fields are date/start/end/break). */
export interface AttendanceDay {
  /** ISO date 'YYYY-MM-DD'. */
  date: string;
  bucket: CostBucket;
  /** 始業時刻 — minutes from midnight. */
  startMinutes: number;
  /** 終業時刻 — minutes from midnight (assumed same calendar day for the demo). */
  endMinutes: number;
  /** 休憩時間 — self-reported break, minutes (0 if no break taken). */
  breakMinutes: number;
  /**
   * 弁当代有無 — the staff's ○/× declaration that the lunch allowance applies this
   * day. Only meaningful when worked > 6h (the engine still enforces that gate);
   * the client only offers it above 6h. This is a flag, not a duration — lunch is
   * NOT deducted from worked time.
   */
  lunchAllowance?: boolean;
  /** 時間外勤務時間 — overtime minutes for the day (default 0; not staff-entered). */
  overtimeMinutes?: number;
  /** 深夜割増分 — night-premium minutes, 22:00 以降 (default 0). */
  nightMinutes?: number;
  /** True during the 大会 (tournament) period — gates 弁当代 eligibility. */
  tournament?: boolean;
}

/** A non-hourly expense line (transport is auto-generated; others manual). */
export interface ExpenseLine {
  date: string;
  bucket: CostBucket;
  category: ExpenseCategory;
  amountYen: number;
  description?: string;
}

/**
 * Per-day computed output.
 *
 * The staff-entered clock fields (始業/終業/休憩) are carried through unchanged —
 * the 勤務表 prints them column-for-column, so the documents must not have to go
 * back to the raw attendance rows to render a timesheet.
 */
export interface DayComputation {
  date: string;
  bucket: CostBucket;
  /** 始業時刻 — minutes from midnight (as entered). */
  startMinutes: number;
  /** 終業時刻 — minutes from midnight (as entered). */
  endMinutes: number;
  /** 休憩時間 — minutes (as entered). */
  breakMinutes: number;
  /** 時間外勤務時間 — minutes (as entered; 0 when none). */
  overtimeMinutes: number;
  /** 深夜割増分 — minutes (as entered; 0 when none). */
  nightMinutes: number;
  /** 実働時間（除休憩） = end − start − break. */
  workedMinutes: number;
  baseWageYen: number;
  overtimeWageYen: number;
  nightWageYen: number;
  lunchYen: number;
  /** 弁当代有無 — true when lunch qualified (declared ○ AND worked > 6h). Drives the 有/無 column. */
  lunchProvided: boolean;
  /** Taxable wage for the day = base + overtime + night + lunch. */
  dailyWageYen: number;
  /** 税額ランク — matched bracket rank. */
  taxRank: number;
  /** 税額 — per-day withholding from the 丙 table. */
  dailyTaxYen: number;
}

/** Full monthly payroll result — the single source of truth for the documents. */
export interface PayrollResult {
  days: DayComputation[];

  workedMinutesTotal: number;

  /** 給料 / 課税分 (①+④) = Σ daily taxable wage + taxable expenses (phone). */
  salaryYen: number;
  /** 所得税 = Σ per-day tax. */
  taxYen: number;
  /** 交通費 (②+⑤) = transport + per-diem. Non-taxable. */
  transportYen: number;
  /** その他 (③+⑥) = lodging + other. Non-taxable. */
  otherYen: number;

  /** 支給額計 = salary + transport + other. */
  grossYen: number;
  /** 差引支給額 = gross − tax. */
  netYen: number;

  /** Per-bucket breakdown for the 勤務表 / 請求明細書. */
  byBucket: Record<CostBucket, { wageYen: number; expenseYen: number }>;
  /** Expense totals by category. */
  expenseByCategory: Record<ExpenseCategory, number>;
}
