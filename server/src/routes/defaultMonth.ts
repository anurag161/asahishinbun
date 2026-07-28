import { Router } from 'express';
import type { Db } from '../db/Db';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { resolveDefaultMonth } from '../services/defaultMonthService';

/**
 * GET /api/default-month → { month: 'YYYY-MM' }
 *
 * The rule itself lives in services/defaultMonthService. The client normally gets
 * this month from the login / me response instead — before any page mounts, so no
 * screen ever paints on an empty month — but this endpoint stays as the fallback
 * for a session that started before that field existed.
 */
export function defaultMonthRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get(
    '/',
    asyncHandler(async (req: AuthRequest, res) => {
      const month = await resolveDefaultMonth(db, req.user!.id, req.user!.role);
      res.json({ month });
    }),
  );

  return router;
}
