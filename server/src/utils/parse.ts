import { AppError } from '../middleware/errorHandler';

type Body = Record<string, unknown>;

export function str(body: Body, key: string): string {
  const v = body[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AppError(400, `Missing or invalid field: ${key}`);
  }
  return v;
}

export function optStr(body: Body, key: string): string | null {
  const v = body[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new AppError(400, `Invalid field: ${key}`);
  return v;
}

export function int(body: Body, key: string): number {
  const v = body[key];
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new AppError(400, `Missing or invalid integer field: ${key}`);
  }
  return n;
}

export function optInt(body: Body, key: string, fallback: number): number {
  if (body[key] === undefined || body[key] === null) return fallback;
  return int(body, key);
}

export function bool(body: Body, key: string, fallback = false): boolean {
  const v = body[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') throw new AppError(400, `Invalid boolean field: ${key}`);
  return v;
}

export function oneOf<T extends string>(
  body: Body,
  key: string,
  allowed: readonly T[],
  fallback?: T,
): T {
  const v = body[key];
  if ((v === undefined || v === null) && fallback !== undefined) return fallback;
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new AppError(400, `Field ${key} must be one of: ${allowed.join(', ')}`);
  }
  return v as T;
}

/** Accept either 'startMinutes' (int) or 'start' ('HH:MM'); return minutes. */
export function minutesField(body: Body, minutesKey: string, timeKey: string): number {
  if (body[minutesKey] !== undefined) return int(body, minutesKey);
  const t = body[timeKey];
  if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':').map(Number);
    return h! * 60 + m!;
  }
  throw new AppError(400, `Provide ${minutesKey} (int) or ${timeKey} ('HH:MM')`);
}
