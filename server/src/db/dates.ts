/** Coerce a DB DATE value to a 'YYYY-MM-DD' string, tz-safe. */
export function asDateString(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

/** Validate a 'YYYY-MM' month string. */
export function isMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/**
 * Half-open date range for a month, computed by integer math (no Date, tz-safe).
 * '2026-06' → { start: '2026-06-01', endExclusive: '2026-07-01' }.
 */
export function monthRange(month: string): { start: string; endExclusive: string } {
  if (!isMonth(month)) throw new Error(`Invalid month: ${month}`);
  const [y, m] = month.split('-').map(Number);
  const ny = m === 12 ? y! + 1 : y!;
  const nm = m === 12 ? 1 : m! + 1;
  return {
    start: `${month}-01`,
    endExclusive: `${ny}-${String(nm).padStart(2, '0')}-01`,
  };
}
