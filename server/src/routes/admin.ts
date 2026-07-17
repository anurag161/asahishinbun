import { Router } from 'express';
import { DEFAULT_RATES } from '@asahi/shared';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { userRepo } from '../repositories/userRepo';
import { masterRepo } from '../repositories/masterRepo';
import { computeForStaffMonth } from '../services/payrollService';
import { hashPassword } from '../auth/password';
import { int, optInt, optStr, str } from '../utils/parse';

export function adminRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware, requireRole('admin'));

  // --- Staff master (アルバイトマスタ + account) ---
  router.get(
    '/staff',
    asyncHandler(async (_req, res) => {
      res.json(await userRepo.listStaff(db));
    }),
  );

  router.post(
    '/staff',
    asyncHandler(async (req, res) => {
      const email = str(req.body, 'email');
      if (await userRepo.findByEmail(db, email)) {
        throw new AppError(409, 'Email already in use');
      }
      const passwordHash = await hashPassword(str(req.body, 'password'));
      const user = await userRepo.create(db, {
        name: str(req.body, 'name'),
        email,
        passwordHash,
        role: 'staff',
      });
      await userRepo.upsertProfile(db, {
        userId: user.id,
        address: optStr(req.body, 'address'),
        homeNearestStation: optStr(req.body, 'homeNearestStation'),
        phone: optStr(req.body, 'phone'),
      });
      res.status(201).json(user);
    }),
  );

  router.put(
    '/staff/:id/profile',
    asyncHandler(async (req, res) => {
      const userId = Number(req.params.id);
      const user = await userRepo.findById(db, userId);
      if (!user || user.role !== 'staff') throw new AppError(404, 'Staff not found');
      await userRepo.upsertProfile(db, {
        userId,
        address: optStr(req.body, 'address'),
        homeNearestStation: optStr(req.body, 'homeNearestStation'),
        phone: optStr(req.body, 'phone'),
      });
      res.json({ ok: true });
    }),
  );

  router.delete(
    '/staff/:id',
    asyncHandler(async (req, res) => {
      await userRepo.remove(db, Number(req.params.id));
      res.status(204).end();
    }),
  );

  // --- 区間別交通費マスタ ---
  router.get(
    '/route-fares',
    asyncHandler(async (_req, res) => {
      res.json(await masterRepo.listRouteFares(db));
    }),
  );

  router.post(
    '/route-fares',
    asyncHandler(async (req, res) => {
      const fare = int(req.body, 'oneWayFare');
      if (fare < 0) throw new AppError(400, 'oneWayFare must be >= 0');
      const saved = await masterRepo.upsertRouteFare(db, {
        fromStation: str(req.body, 'fromStation'),
        toStation: str(req.body, 'toStation'),
        oneWayFare: fare,
        mode: optStr(req.body, 'mode'),
        routeNote: optStr(req.body, 'routeNote'),
      });
      res.status(201).json(saved);
    }),
  );

  router.delete(
    '/route-fares/:id',
    asyncHandler(async (req, res) => {
      await masterRepo.removeRouteFare(db, Number(req.params.id));
      res.status(204).end();
    }),
  );

  // --- rate_config ---
  router.get(
    '/rates',
    asyncHandler(async (_req, res) => {
      const row = await masterRepo.getLatestRates(db);
      res.json(row ?? { effective_year: null, ...DEFAULT_RATES });
    }),
  );

  router.put(
    '/rates',
    asyncHandler(async (req, res) => {
      const saved = await masterRepo.upsertRates(db, str(req.body, 'effectiveYear'), {
        hourlyYen: int(req.body, 'hourlyYen'),
        overtimeUnder60Yen: int(req.body, 'overtimeUnder60Yen'),
        overtimeOver60Yen: int(req.body, 'overtimeOver60Yen'),
        nightYen: int(req.body, 'nightYen'),
        lunchYen: optInt(req.body, 'lunchYen', 0),
      });
      res.json(saved);
    }),
  );

  // --- Overall records review (全体実績確認) ---
  // GET /api/admin/records?month=YYYY-MM → per-staff computed summaries.
  router.get(
    '/records',
    asyncHandler(async (req, res) => {
      const month = str(req.query as Record<string, unknown>, 'month');
      const staff = await userRepo.listStaff(db);
      const records = await Promise.all(
        staff.map(async (s) => {
          const payroll = await computeForStaffMonth(db, s.id, month);
          return {
            staffId: s.id,
            name: s.name,
            email: s.email,
            workDays: payroll.workDays,
            totalWorkedMinutes: payroll.result.workedMinutesTotal,
            salaryYen: payroll.result.salaryYen,
            transportYen: payroll.result.transportYen,
            taxYen: payroll.result.taxYen,
            grossYen: payroll.result.grossYen,
            netYen: payroll.result.netYen,
          };
        }),
      );
      res.json({ month, records });
    }),
  );

  return router;
}
