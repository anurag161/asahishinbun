/**
 * GOLDEN MASTER — the most important test in the project.
 *
 * Asserts the calculation engine reproduces the client's real June 2026 documents
 * to the yen. If any of these fail, the deliverable is wrong and must not ship.
 */

import { describe, expect, it } from 'vitest';
import { computePayroll } from './engine';
import { lookupDailyTax } from './taxTable';
import {
  JUNE_2026_ATTENDANCE,
  JUNE_2026_EXPECTED,
  JUNE_2026_EXPENSES,
} from './fixtures/june2026';

describe('golden master — Asahi June 2026 sample month', () => {
  const result = computePayroll(JUNE_2026_ATTENDANCE, JUNE_2026_EXPENSES);

  it('reproduces total worked time (101:00)', () => {
    expect(result.workedMinutesTotal).toBe(JUNE_2026_EXPECTED.workedMinutesTotal);
  });

  it('reproduces 給料 = ¥131,300', () => {
    expect(result.salaryYen).toBe(JUNE_2026_EXPECTED.salaryYen);
  });

  it('reproduces 所得税 = ¥188', () => {
    expect(result.taxYen).toBe(JUNE_2026_EXPECTED.taxYen);
  });

  it('reproduces 交通費 = ¥54,040', () => {
    expect(result.transportYen).toBe(JUNE_2026_EXPECTED.transportYen);
  });

  it('reproduces 支給額計 = ¥185,340', () => {
    expect(result.grossYen).toBe(JUNE_2026_EXPECTED.grossYen);
  });

  it('reproduces 差引支給額 = ¥185,152', () => {
    expect(result.netYen).toBe(JUNE_2026_EXPECTED.netYen);
  });
});

describe('per-day wages and tax ranks (calc sheet, asahidoc6)', () => {
  const result = computePayroll(JUNE_2026_ATTENDANCE, []);
  const byDate = Object.fromEntries(result.days.map((d) => [d.date, d]));

  // date → [daily wage, 税額ランク, daily tax] straight off the calc sheet.
  const expected: Record<string, [number, number, number]> = {
    '2026-06-01': [10_400, 71, 22],
    '2026-06-03': [10_183, 68, 12],
    '2026-06-05': [10_400, 71, 22],
    '2026-06-09': [6_500, 32, 0],
    '2026-06-10': [10_400, 71, 22],
    '2026-06-12': [5_200, 19, 0],
    '2026-06-16': [10_400, 71, 22],
    '2026-06-17': [10_400, 71, 22],
    '2026-06-19': [9_100, 58, 0],
    '2026-06-22': [10_400, 71, 22],
    '2026-06-23': [10_400, 71, 22],
    '2026-06-24': [10_400, 71, 22],
    '2026-06-26': [9_750, 64, 0],
    '2026-06-29': [7_367, 40, 0],
  };

  for (const [date, [wage, rank, tax]] of Object.entries(expected)) {
    it(`${date}: ¥${wage} → rank ${rank} → ¥${tax}`, () => {
      const day = byDate[date];
      expect(day).toBeDefined();
      expect(day!.dailyWageYen).toBe(wage);
      expect(day!.taxRank).toBe(rank);
      expect(day!.dailyTaxYen).toBe(tax);
    });
  }
});

describe('丙 tax table lookup edge cases', () => {
  it('returns ¥0 below the ¥9,800 threshold', () => {
    expect(lookupDailyTax(9_799).tax).toBe(0);
    expect(lookupDailyTax(0).tax).toBe(0);
  });

  it('resolves the first taxable bracket: ¥9,800 → rank 65 → ¥1', () => {
    expect(lookupDailyTax(9_800)).toEqual({ tax: 1, rank: 65, provisional: false });
  });

  it('resolves the top transcribed bracket: ¥14,799 → rank 114 → ¥181 (not provisional)', () => {
    expect(lookupDailyTax(14_799)).toEqual({ tax: 181, rank: 114, provisional: false });
  });

  it('extrapolates provisionally above the transcribed ceiling (flagged, never a silent ¥0)', () => {
    // ¥14,800 → rank 115 → ¥181 + ¥4 = ¥185, marked provisional until official rows land.
    expect(lookupDailyTax(14_800)).toEqual({ tax: 185, rank: 115, provisional: true });
    expect(lookupDailyTax(20_000).provisional).toBe(true);
  });

  it('still throws for absurd wages above the provisional ceiling', () => {
    expect(() => lookupDailyTax(30_000)).toThrow(/exceeds/);
  });
});
