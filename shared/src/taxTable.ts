/**
 * 給与所得の源泉徴収税額表（日額表・丙）令和8年
 * 2026 daily withholding-tax table, category 丙.
 *
 * Transcribed directly from the client's scans (assets/asahidoc7–8.jpeg).
 * Structure: contiguous ¥100-wide brackets. `rank` is the row index, which the
 * client's calc sheet calls 税額ランク (e.g. a ¥10,400 daily wage → rank 71 → ¥22).
 *
 * Verified: this table reproduces the sample month's ¥188 total to the yen.
 */

import type { TaxBracket, TaxTable } from './types';

/**
 * Non-zero withholding by rank (rows 1–64 are all ¥0). Transcribed from the scans.
 * Rank 65 = [¥9,800, ¥9,900) → ¥1, up to rank 114 = [¥14,700, ¥14,800) → ¥181.
 */
const TAX_BY_RANK: Readonly<Record<number, number>> = {
  65: 1,
  66: 5,
  67: 8,
  68: 12,
  69: 15,
  70: 19,
  71: 22,
  72: 26,
  73: 29,
  74: 33,
  75: 36,
  76: 40,
  77: 43,
  78: 47,
  79: 51,
  80: 55,
  81: 58,
  82: 62,
  83: 65,
  84: 69,
  85: 72,
  86: 76,
  87: 79,
  88: 83,
  89: 86,
  90: 90,
  91: 93,
  92: 98,
  93: 101,
  94: 105,
  95: 108,
  96: 112,
  97: 115,
  98: 119,
  99: 122,
  100: 126,
  101: 129,
  102: 133,
  103: 136,
  104: 140,
  105: 144,
  106: 149,
  107: 153,
  108: 157,
  109: 161,
  110: 165,
  111: 169,
  112: 173,
  113: 177,
  114: 181,
};

/** Ceiling of the officially-transcribed table (exclusive): rank 114 = [¥14,700, ¥14,800). */
export const TAX_TABLE_MAX_YEN = 14_800;

/**
 * Ceiling of the PROVISIONAL extrapolation (exclusive). Above ¥14,800 we continue
 * the table's own top marginal step (+¥4 per ¥100 bracket) so an unusually long
 * single day never crashes the flow — but the amount is an ESTIMATE, flagged
 * `provisional: true`, until the official 令和8年 upper rows are transcribed
 * (v2plan Q1). Realistic stadium shifts never reach ¥14,800/day (~11.4h at ¥1,300/h),
 * so this only guards against accidental extreme input. Beyond this ceiling we throw.
 */
export const PROVISIONAL_TAX_MAX_YEN = 30_000;

/** Top of the transcribed data: rank 114 → ¥181. The provisional slope continues from here. */
const LAST_TRANSCRIBED_RANK = 114;
const LAST_TRANSCRIBED_TAX = 181;
const PROVISIONAL_STEP_YEN = 4; // the table's own +¥4/bracket step at ranks 110–114

function taxForRank(rank: number): number {
  if (rank <= LAST_TRANSCRIBED_RANK) return TAX_BY_RANK[rank] ?? 0;
  // Provisional continuation beyond the transcribed rows.
  return LAST_TRANSCRIBED_TAX + (rank - LAST_TRANSCRIBED_RANK) * PROVISIONAL_STEP_YEN;
}

function buildBrackets(): TaxBracket[] {
  const brackets: TaxBracket[] = [];

  // Rank 1: everything below ¥3,500 → ¥0.
  brackets.push({ rank: 1, min: 0, max: 3_500, tax: 0 });

  // Ranks 2–114: transcribed ¥100-wide brackets. Ranks 115+: provisional continuation
  // up to PROVISIONAL_TAX_MAX_YEN. rank 2 → [3,500, 3,600); rank 114 → [14,700, 14,800).
  const topRank = 2 + (PROVISIONAL_TAX_MAX_YEN - 3_500) / 100 - 1;
  for (let rank = 2; rank <= topRank; rank++) {
    const min = 3_500 + (rank - 2) * 100;
    brackets.push({ rank, min, max: min + 100, tax: taxForRank(rank) });
  }

  return brackets;
}

export const TAX_TABLE_REIWA8: TaxTable = {
  year: '令和8年',
  category: '丙',
  brackets: buildBrackets(),
};

/**
 * Look up the daily withholding for a daily wage.
 * Returns `{ tax, rank, provisional }`. `provisional` is true when the wage is at
 * or above ¥14,800 — the amount then comes from the extrapolation, not the scans,
 * so callers can flag it (never silently trust ¥0 or an estimate). Throws only for
 * negatives or wages at/above the provisional ceiling (see v2plan Q1).
 */
export function lookupDailyTax(
  dailyWageYen: number,
  table: TaxTable = TAX_TABLE_REIWA8,
): { tax: number; rank: number; provisional: boolean } {
  if (dailyWageYen < 0) {
    throw new RangeError(`Daily wage cannot be negative: ${dailyWageYen}`);
  }

  const bracket = table.brackets.find(
    (b) => dailyWageYen >= b.min && dailyWageYen < b.max,
  );

  if (!bracket) {
    throw new RangeError(
      `Daily wage ¥${dailyWageYen} exceeds the ${table.year} 丙 table's provisional ceiling ` +
        `(max ¥${PROVISIONAL_TAX_MAX_YEN}). Transcribe the official upper rows (v2plan Q1).`,
    );
  }

  return {
    tax: bracket.tax,
    rank: bracket.rank,
    provisional: bracket.min >= TAX_TABLE_MAX_YEN,
  };
}
