/**
 * Golden-master fixture: the client's sample month (June 2026), transcribed from
 * the real documents:
 *   - 勤務表            (assets/asahidoc1.jpeg)  — daily start/end/break, all 編集費
 *   - 請求明細書        (assets/asahidoc2.jpeg)  — ¥131,300 wage / ¥54,040 transport / ¥185,340
 *   - 交通費            (assets/asahidoc3.jpeg)  — 円山⇄大阪 ¥1,930 one-way, round trip / day
 *   - 給料計算書        (assets/asahidoc5.jpeg)  — 所得税 ¥188 / 差引支給額 ¥185,152
 *   - 計算シート        (assets/asahidoc6.jpeg)  — per-day wage → 税額ランク → 税額
 *
 * The engine MUST reproduce these figures to the yen. See june2026.test.ts.
 */

import type { AttendanceDay, ExpenseLine } from '../types';

/** Helper: 'HH:MM' → minutes from midnight. */
function hm(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

interface RawDay {
  date: string;
  start: string;
  end: string;
  /** break in minutes (60 = '1:00', 0 = none) */
  breakMin: number;
}

/** 14 worked days, all in the 編集費（間接費）bucket, exactly as on the 勤務表. */
const RAW_DAYS: RawDay[] = [
  { date: '2026-06-01', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-03', start: '10:10', end: '19:00', breakMin: 60 }, // 7:50
  { date: '2026-06-05', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-09', start: '13:00', end: '18:00', breakMin: 0 }, // 5:00
  { date: '2026-06-10', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-12', start: '10:00', end: '14:00', breakMin: 0 }, // 4:00
  { date: '2026-06-16', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-17', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-19', start: '10:00', end: '18:00', breakMin: 60 }, // 7:00
  { date: '2026-06-22', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-23', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-24', start: '10:00', end: '19:00', breakMin: 60 }, // 8:00
  { date: '2026-06-26', start: '10:30', end: '19:00', breakMin: 60 }, // 7:30
  { date: '2026-06-29', start: '10:20', end: '17:00', breakMin: 60 }, // 5:40
];

export const JUNE_2026_ATTENDANCE: AttendanceDay[] = RAW_DAYS.map((d) => ({
  date: d.date,
  bucket: 'henshu',
  startMinutes: hm(d.start),
  endMinutes: hm(d.end),
  breakMinutes: d.breakMin,
  // No overtime / night / tournament-lunch in the sample month.
}));

/**
 * Transport: 円山 ⇄ 大阪, ¥1,930 one-way, round trip on each of the 14 work days.
 * 28 trips × ¥1,930 = ¥54,040. All in the 編集費 bucket.
 */
export const JUNE_2026_EXPENSES: ExpenseLine[] = RAW_DAYS.flatMap((d) => [
  {
    date: d.date,
    bucket: 'henshu' as const,
    category: 'transport' as const,
    amountYen: 1_930,
    description: '円山 → 大阪（バス・電車）',
  },
  {
    date: d.date,
    bucket: 'henshu' as const,
    category: 'transport' as const,
    amountYen: 1_930,
    description: '大阪 → 円山（バス・電車）',
  },
]);

/** Expected totals — the acceptance criteria, straight off the client's documents. */
export const JUNE_2026_EXPECTED = {
  workedMinutesTotal: 101 * 60, // 101:00
  salaryYen: 131_300, // 給料
  taxYen: 188, // 所得税
  transportYen: 54_040, // 交通費
  otherYen: 0,
  grossYen: 185_340, // 支給額計
  netYen: 185_152, // 差引支給額
} as const;
