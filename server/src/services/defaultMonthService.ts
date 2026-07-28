/**
 * Which month a screen should open on.
 *
 * Every page used to start on the current month, which is empty until someone
 * enters a day — so a freshly seeded demo opened on all zeros and 該当なし, and you
 * had to know to move the picker back to find the data.
 *
 * Rule: the current month if it already has work days, otherwise the most recent
 * month that does. In day-to-day use that is the current month as soon as the
 * first day is entered; on a fresh install with sample data it is the sample's
 * month. Falls back to the current month when there is no attendance at all.
 *
 * Scoped per role: staff see their own history, an admin sees the whole org.
 *
 * This lives in one place because it is answered from two: the auth responses
 * carry it so the client knows the month BEFORE any page mounts, and
 * /api/default-month still serves it for anything holding an older session.
 */

import type { Db } from '../db/Db';
import type { Role } from '../db/types';
import { attendanceRepo } from '../repositories/attendanceRepo';

/** Current month as 'YYYY-MM' in UTC. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function resolveDefaultMonth(
  db: Db,
  userId: number,
  role: Role,
): Promise<string> {
  const now = currentMonth();
  const scope = role === 'admin' ? undefined : userId;

  const [thisMonth, latest] = await Promise.all([
    attendanceRepo.listForMonth(db, userId, now),
    attendanceRepo.latestMonth(db, scope),
  ]);

  // An admin's own account has no attendance, so only trust the per-user
  // "does the current month have data" check for staff.
  const currentHasData = role === 'admin' ? latest === now : thisMonth.length > 0;

  return currentHasData || !latest ? now : latest;
}
