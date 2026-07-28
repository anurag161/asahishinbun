import { Router } from 'express';
import type { Db } from '../db/Db';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { computeForStaffMonth } from '../services/payrollService';
import { str } from '../utils/parse';

export function mypageRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware, requireRole('staff'));

  // GET /api/mypage/summary?month=YYYY-MM
  // This month's work days, total hours, transport total, and full payroll.
  router.get(
    '/summary',
    asyncHandler(async (req: AuthRequest, res) => {
      const month = str(req.query as Record<string, unknown>, 'month');
      const payroll = await computeForStaffMonth(db, req.user!.id, month);
      const { result } = payroll;

      res.json({
        month,
        workDays: payroll.workDays,
        totalWorkedMinutes: result.workedMinutesTotal,
        totalWorkedHours: Math.round((result.workedMinutesTotal / 60) * 100) / 100,
        transportTotalYen: result.transportYen,
        salaryYen: result.salaryYen,
        taxYen: result.taxYen,
        // The 丙 table is transcribed to ¥14,800/day; above that the tax is an
        // estimate. Ship the flag so the UI can't present it as settled.
        taxProvisional: result.taxProvisional,
        provisionalTaxDays: result.provisionalTaxDays,
        grossYen: result.grossYen,
        netYen: result.netYen,
        days: result.days,
      });
    }),
  );

  return router;
}
