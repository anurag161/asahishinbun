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

/** The largest daily wage the transcribed table can resolve (exclusive). */
export const TAX_TABLE_MAX_YEN = 14_800;

function buildBrackets(): TaxBracket[] {
  const brackets: TaxBracket[] = [];

  // Rank 1: everything below ¥3,500 → ¥0.
  brackets.push({ rank: 1, min: 0, max: 3_500, tax: 0 });

  // Ranks 2–114: ¥100-wide brackets starting at ¥3,500.
  // rank 2 → [3,500, 3,600); rank 71 → [10,400, 10,500); rank 114 → [14,700, 14,800).
  for (let rank = 2; rank <= 114; rank++) {
    const min = 3_500 + (rank - 2) * 100;
    brackets.push({ rank, min, max: min + 100, tax: TAX_BY_RANK[rank] ?? 0 });
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
 * Returns `{ tax, rank }`. Throws for wages at/above the transcribed table's
 * ceiling — we must NOT silently return ¥0 above ¥14,800 (see v2plan Q1).
 */
export function lookupDailyTax(
  dailyWageYen: number,
  table: TaxTable = TAX_TABLE_REIWA8,
): { tax: number; rank: number } {
  if (dailyWageYen < 0) {
    throw new RangeError(`Daily wage cannot be negative: ${dailyWageYen}`);
  }

  const bracket = table.brackets.find(
    (b) => dailyWageYen >= b.min && dailyWageYen < b.max,
  );

  if (!bracket) {
    throw new RangeError(
      `Daily wage ¥${dailyWageYen} exceeds the transcribed ${table.year} 丙 table ` +
        `(max ¥${TAX_TABLE_MAX_YEN}). Extend the table with the official rows (v2plan Q1).`,
    );
  }

  return { tax: bracket.tax, rank: bracket.rank };
}
