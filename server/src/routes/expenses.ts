import { Router } from 'express';
import { COST_BUCKETS } from '@asahi/shared';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { expenseRepo } from '../repositories/expenseRepo';
import { assertWithinFareCap } from '../services/transportService';
import { int, oneOf, optStr, str } from '../utils/parse';

// Manual expenses only — transport is auto-generated from attendance.
const MANUAL_CATEGORIES = ['perdiem', 'phone', 'lodging', 'other', 'transport'] as const;

export function expensesRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware, requireRole('staff'));

  // GET /api/expenses?month=YYYY-MM
  router.get(
    '/',
    asyncHandler(async (req: AuthRequest, res) => {
      const month = str(req.query as Record<string, unknown>, 'month');
      const rows = await expenseRepo.listForMonth(db, req.user!.id, month);
      res.json(rows);
    }),
  );

  // POST /api/expenses  (manual expense line)
  router.post(
    '/',
    asyncHandler(async (req: AuthRequest, res) => {
      const staffId = req.user!.id;
      const amountYen = int(req.body, 'amountYen');
      if (amountYen < 0) throw new AppError(400, 'amountYen must be >= 0');

      const category = oneOf(req.body, 'category', MANUAL_CATEGORIES);

      // Fare cap (requirements §3.2): a manual transport claim may not exceed the
      // registered fare when both endpoints are given.
      if (category === 'transport') {
        const from = optStr(req.body, 'fromStation');
        const to = optStr(req.body, 'toStation');
        if (from && to) {
          await assertWithinFareCap(db, from, to, amountYen).catch((e) => {
            throw new AppError(e.statusCode ?? 400, e.message);
          });
        }
      }

      const created = await expenseRepo.create(db, {
        staffId,
        expenseDate: str(req.body, 'date'),
        category,
        bucket: oneOf(req.body, 'bucket', COST_BUCKETS, 'henshu'),
        amountYen,
        description: optStr(req.body, 'description'),
        source: 'manual',
      });
      res.status(201).json(created);
    }),
  );

  // DELETE /api/expenses/:id  (own manual lines only)
  router.delete(
    '/:id',
    asyncHandler(async (req: AuthRequest, res) => {
      const id = Number(req.params.id);
      const existing = await expenseRepo.getById(db, id);
      if (!existing || existing.staff_id !== req.user!.id) {
        throw new AppError(404, 'Expense not found');
      }
      if (existing.source === 'auto') {
        throw new AppError(400, 'Auto-generated transport is managed via attendance.');
      }
      await expenseRepo.remove(db, id);
      res.status(204).end();
    }),
  );

  return router;
}
