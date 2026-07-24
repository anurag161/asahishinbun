/** Formatting helpers for the Japanese documents. Locale-independent. */

/** 131300 → "¥131,300" */
export function yen(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? '-' : '';
  return `${sign}¥${Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** 131300 → "131,300" (no symbol) */
export function num(n: number): string {
  return yen(n).replace('¥', '');
}

/** minutes → "H:MM" (e.g. 470 → "7:50") */
export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** minutes-from-midnight → "HH:MM" (e.g. 600 → "10:00") — 始業/終業時刻 */
export function timeOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** minutes → decimal hours as printed in 時給換算用勤務時間 (6060 → "101", 6090 → "101.5") */
export function decimalHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return String(hours);
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** '2026-06-03' → '火' */
export function weekdayJa(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return WEEKDAY_JA[wd]!;
}

/** '2026-06-03' → '6/3（火）' */
export function dateLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${m}/${d}（${weekdayJa(isoDate)}）`;
}

/** '2026-06' → '2026年6月1日 ～ 2026年6月30日' */
export function periodLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月1日 ～ ${y}年${m}月${daysInMonth(y!, m!)}日`;
}

/** '2026-06' → '2026年6月' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}

/** Escape user-controlled text for safe HTML embedding. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
