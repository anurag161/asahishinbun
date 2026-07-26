import { Router } from 'express';
import type { Db } from '../db/Db';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { attendanceRepo } from '../repositories/attendanceRepo';

/** Current month as 'YYYY-MM' in UTC. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /api/default-month → { month: 'YYYY-MM' }
 *
 * Which month a screen should open on. Every page used to start on the current
 * month, which is empty until someone enters a day — so a freshly seeded demo
 * opened on all zeros and 該当なし, and you had to know to move the month picker
 * back to find the data.
 *
 * Rule: the current month if it already has work days, otherwise the most recent
 * month that does. In day-to-day use that is the current month as soon as the
 * first day is entered; on a fresh install with sample data it is the sample's
 * month. Falls back to the current month when there is no attendance at all.
 *
 * Scoped per role: staff see their own history, an admin sees the whole org.
 */
export function defaultMonthRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get(
    '/',
    asyncHandler(async (req: AuthRequest, res) => {
      const staffId = req.user!.role === 'admin' ? undefined : req.user!.id;
      const now = currentMonth();

      const [thisMonth, latest] = await Promise.all([
        attendanceRepo.listForMonth(db, req.user!.id, now),
        attendanceRepo.latestMonth(db, staffId),
      ]);

      // An admin's own account has no attendance, so only trust the per-user
      // "does the current month have data" check for staff.
      const currentHasData =
        req.user!.role === 'admin' ? latest === now : thisMonth.length > 0;

      res.json({ month: currentHasData || !latest ? now : latest });
    }),
  );

  return router;
}
