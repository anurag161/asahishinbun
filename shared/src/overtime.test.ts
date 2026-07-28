/**
 * 時間外勤務手当 — the overtime rule.
 *
 * A day is paid: ¥1,300 × 8h + ¥1,300 × 1.25 × (worked − 8h).
 * The engine itemises that as base (¥1,300 on ALL worked minutes, overtime hours
 * included) + 割増分 (¥325/h ≤60h, ¥650/h >60h monthly), which is how the client's
 * 請求明細書 lists it. These tests assert both views agree to the yen.
 */

import { describe, expect, it } from 'vitest';
import { computeOvertimeMinutes, computePayroll } from './engine';
import { DEFAULT_RATES, OVERTIME_MONTHLY_THRESHOLD_MINUTES } from './rates';
import { lookupDailyTax } from './taxTable';
import { JUNE_2026_ATTENDANCE, JUNE_2026_EXPENSES } from './fixtures/june2026';
import type { AttendanceDay } from './types';

const H = 60;

/** A day worked from 09:00 for `hours`, with `breakHours` of unpaid break on top. */
function day(date: string, hours: number, breakHours = 0, extra: Partial<AttendanceDay> = {}): AttendanceDay {
  return {
    date,
    bucket: 'henshu',
    startMinutes: 9 * H,
    endMinutes: Math.round((9 + hours + breakHours) * H),
    breakMinutes: Math.round(breakHours * H),
    ...extra,
  };
}

/** The client's formula, stated directly — the thing every case below is checked against. */
function expectedDayWage(workedHours: number, hourlyYen = DEFAULT_RATES.hourlyYen): number {
  const regular = Math.min(workedHours, 8);
  const overtime = Math.max(0, workedHours - 8);
  return Math.round(hourlyYen * regular + hourlyYen * 1.25 * overtime);
}

describe('daily overtime past the 8h statutory day', () => {
  it('pays a 9h day ¥1,300×8 + ¥1,300×1.25×1 = ¥12,025', () => {
    const [d] = computePayroll([day('2026-08-01', 9)]).days;
    expect(d!.overtimeMinutes).toBe(1 * H);
    expect(d!.baseWageYen).toBe(11_700); // ¥1,300 × 9h
    expect(d!.overtimeWageYen).toBe(325); // ¥325 premium × 1h
    expect(d!.dailyWageYen).toBe(12_025);
    expect(d!.dailyWageYen).toBe(expectedDayWage(9));
  });

  it('pays exactly 8h with no premium (¥10,400) — the boundary is not overtime', () => {
    const [d] = computePayroll([day('2026-08-01', 8)]).days;
    expect(d!.overtimeMinutes).toBe(0);
    expect(d!.overtimeWageYen).toBe(0);
    expect(d!.dailyWageYen).toBe(10_400);
  });

  it('leaves short days alone', () => {
    const [d] = computePayroll([day('2026-08-01', 5)]).days;
    expect(d!.overtimeMinutes).toBe(0);
    expect(d!.dailyWageYen).toBe(6_500);
  });

  it('measures overtime on WORKED time, so an unpaid break does not create it', () => {
    // 09:00–19:00 with a 1h break = 9h on the clock but 8h worked. No premium.
    const [d] = computePayroll([day('2026-08-01', 8, 1)]).days;
    expect(d!.workedMinutes).toBe(8 * H);
    expect(d!.overtimeMinutes).toBe(0);
    expect(d!.dailyWageYen).toBe(10_400);
  });

  it('handles part-hours of overtime', () => {
    // 10h30m worked → 2h30m overtime.
    const [d] = computePayroll([day('2026-08-01', 10.5)]).days;
    expect(d!.overtimeMinutes).toBe(2 * H + 30);
    expect(d!.dailyWageYen).toBe(expectedDayWage(10.5)); // ¥14,463
    expect(d!.dailyWageYen).toBe(14_463);
  });

  it('agrees with the client formula across a range of day lengths', () => {
    for (const hours of [0, 1, 4, 7.5, 8, 8.25, 9, 11, 12, 14]) {
      const [d] = computePayroll([day('2026-08-01', hours)]).days;
      expect(d!.dailyWageYen, `${hours}h`).toBe(expectedDayWage(hours));
    }
  });

  it('carries the higher daily wage into the 丙 withholding, not just the total', () => {
    // ¥10,400 → rank 71 → ¥22 (the golden master's own 8h figure).
    const plain = computePayroll([day('2026-08-01', 8)]).days[0]!;
    expect(plain.dailyWageYen).toBe(10_400);
    expect(plain.taxRank).toBe(71);
    expect(plain.dailyTaxYen).toBe(22);

    // 10h → ¥13,650 → rank 103 = [¥13,600, ¥13,700) → ¥136. The premium is taxable,
    // so overtime moves the day up the 丙 table; withholding is NOT left on the
    // pre-overtime wage.
    const long = computePayroll([day('2026-08-01', 10)]).days[0]!;
    expect(long.dailyWageYen).toBe(13_650);
    expect(long.taxRank).toBe(103);
    expect(long.dailyTaxYen).toBe(136);
  });

  it('still withholds per day and sums, never on the monthly total', () => {
    const two = computePayroll([day('2026-08-01', 10), day('2026-08-02', 10)]);
    expect(two.taxYen).toBe(136 * 2);
    expect(two.salaryYen).toBe(13_650 * 2);
  });
});

describe('overtime pushes days past the transcribed 丙 table sooner than before', () => {
  /**
   * The table is transcribed to ¥14,800/day; above that `lookupDailyTax`
   * extrapolates. Paying overtime lowers the day length that reaches it from
   * ~11h24m to ~10h45m — well inside a long stadium shift — so the estimate has to
   * be labelled all the way out to the payslip rather than quietly rendered.
   */
  it('stays on transcribed rows through a 10h40m day', () => {
    const result = computePayroll([day('2026-08-01', 10 + 40 / 60)]);
    const d = result.days[0]!;
    expect(d.dailyWageYen).toBe(14_734);
    expect(d.dailyWageYen).toBeLessThan(14_800);
    expect(d.taxProvisional).toBe(false);
    expect(result.taxProvisional).toBe(false);
    expect(result.provisionalTaxDays).toEqual([]);
  });

  it('flags the day AND the month once 10h45m crosses the ceiling', () => {
    const result = computePayroll([day('2026-08-01', 10.75)]);
    const d = result.days[0]!;
    expect(d.dailyWageYen).toBe(14_869);
    expect(lookupDailyTax(d.dailyWageYen).provisional).toBe(true);
    expect(d.taxProvisional).toBe(true);
    expect(result.taxProvisional).toBe(true);
    expect(result.provisionalTaxDays).toEqual(['2026-08-01']);
  });

  it('names only the offending days, so a normal month stays unflagged', () => {
    const result = computePayroll([
      day('2026-08-01', 8),
      day('2026-08-02', 10.75),
      day('2026-08-03', 7),
    ]);
    expect(result.taxProvisional).toBe(true);
    expect(result.provisionalTaxDays).toEqual(['2026-08-02']);
    expect(result.days.filter((d) => d.taxProvisional)).toHaveLength(1);
  });

  it('leaves the golden master unflagged — every June day is on a transcribed row', () => {
    const result = computePayroll(JUNE_2026_ATTENDANCE, JUNE_2026_EXPENSES);
    expect(result.taxProvisional).toBe(false);
    expect(result.provisionalTaxDays).toEqual([]);
    expect(result.taxYen).toBe(188);
  });
});

describe('the monthly 60h step', () => {
  // 16h worked per day = 8h of overtime each, so day 8 is the one that crosses 60h.
  const days = Array.from({ length: 8 }, (_, i) =>
    day(`2026-08-${String(i + 1).padStart(2, '0')}`, 16),
  );

  it('prices overtime at ¥325 until 60h of overtime, then ¥650', () => {
    const result = computePayroll(days);
    const totalOt = result.days.reduce((s, d) => s + d.overtimeMinutes, 0);
    expect(totalOt).toBe(64 * H);

    const underMin = result.days.reduce((s, d) => s + d.overtimeUnderMinutes, 0);
    const overMin = result.days.reduce((s, d) => s + d.overtimeOverMinutes, 0);
    expect(underMin).toBe(OVERTIME_MONTHLY_THRESHOLD_MINUTES); // 60h
    expect(overMin).toBe(4 * H); // the 4h past it

    const premium = result.days.reduce((s, d) => s + d.overtimeWageYen, 0);
    expect(premium).toBe(60 * 325 + 4 * 650);
  });

  it('splits the crossing day itself, rather than pushing it wholly to one rate', () => {
    const crossing = computePayroll(days).days[7]!;
    expect(crossing.overtimeUnderMinutes).toBe(4 * H);
    expect(crossing.overtimeOverMinutes).toBe(4 * H);
    expect(crossing.overtimeUnderYen + crossing.overtimeOverYen).toBe(crossing.overtimeWageYen);
  });

  it('applies the step in date order regardless of the input order', () => {
    const shuffled = [...days].reverse();
    const a = computePayroll(days);
    const b = computePayroll(shuffled);
    expect(b.salaryYen).toBe(a.salaryYen);
    expect(b.days.map((d) => d.date)).toEqual(a.days.map((d) => d.date));
  });
});

describe('a stored 時間外 value acts as a floor, never a replacement', () => {
  it('recognises overtime the clock does not show', () => {
    const d = day('2026-08-01', 6, 0, { overtimeMinutes: 90 });
    expect(computeOvertimeMinutes(d)).toBe(90);
    expect(computePayroll([d]).days[0]!.overtimeWageYen).toBe(Math.round((90 * 325) / 60));
  });

  it('is ignored when the clock already shows more, so nothing is double-counted', () => {
    const d = day('2026-08-01', 11, 0, { overtimeMinutes: 30 });
    expect(computeOvertimeMinutes(d)).toBe(3 * H);
    expect(computePayroll([d]).days[0]!.dailyWageYen).toBe(expectedDayWage(11));
  });

  it('can never exceed the day actually worked', () => {
    const d = day('2026-08-01', 4, 0, { overtimeMinutes: 600 });
    expect(computeOvertimeMinutes(d)).toBe(4 * H);
  });
});
