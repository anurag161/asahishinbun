/**
 * Default pay rates, from the client's 請求明細書 (assets/asahidoc2.jpeg).
 * These are admin-editable at runtime (rate_config table) — this is only the seed.
 */

import type { RateConfig } from './types';

export const DEFAULT_RATES: RateConfig = {
  hourlyYen: 1_300, // 時給
  overtimeUnder60Yen: 325, // 時間外 60h 以下（割増分）
  overtimeOver60Yen: 650, // 時間外 60h 超（割増分）
  nightYen: 325, // 深夜割増
  // 弁当代: flat amount is not fully legible on the scans (v2plan Q2/P4).
  // Provisional placeholder — confirm with MORABU before the demo goes out.
  lunchYen: 0,
};

/**
 * 法定労働時間 — the daily statutory hours. Anything worked beyond this on a single
 * day is 時間外勤務 and earns the overtime premium on top of the plain hourly wage:
 *
 *   day pay = ¥1,300 × 8h + ¥1,300 × 1.25 × (worked − 8h)
 *
 * which the engine bills as base (¥1,300 × ALL worked minutes) + 割増分 (¥325/h),
 * exactly how the client's 請求明細書 itemises it.
 */
export const DAILY_OVERTIME_THRESHOLD_MINUTES = 8 * 60; // 8 hours

/** Monthly overtime threshold (minutes) where the rate steps from ≤60h to >60h. */
export const OVERTIME_MONTHLY_THRESHOLD_MINUTES = 60 * 60; // 60 hours

/** 弁当代 eligibility: only during the tournament AND when the day exceeds 6 worked hours. */
export const LUNCH_MIN_WORKED_MINUTES = 6 * 60; // > 6h
