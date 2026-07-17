import { Router } from 'express';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { computeForStaffMonth } from '../services/payrollService';
import { str } from '../utils/parse';

export function payrollRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware);

  // GET /api/payroll/:staffId?month=YYYY-MM → full engine result.
  // Staff may only read their own; admin may read anyone's.
  router.get(
    '/:staffId',
    asyncHandler(async (req: AuthRequest, res) => {
      const staffId = Number(req.params.staffId);
      if (req.user!.role !== 'admin' && req.user!.id !== staffId) {
        throw new AppError(403, 'Forbidden');
      }
      const month = str(req.query as Record<string, unknown>, 'month');
      const payroll = await computeForStaffMonth(db, staffId, month);
      res.json(payroll);
    }),
  );

  return router;
}
