import { Router } from 'express';
import { COST_BUCKETS, DEFAULT_RATES } from '@asahi/shared';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { userRepo } from '../repositories/userRepo';
import { settingsRepo, EMAIL_TEST_RECIPIENT } from '../repositories/settingsRepo';
import type { Mailer } from '../services/emailService';
import { masterRepo } from '../repositories/masterRepo';
import { attendanceRepo } from '../repositories/attendanceRepo';
import { expenseRepo } from '../repositories/expenseRepo';
import { computeForStaffMonth } from '../services/payrollService';
import { hashPassword } from '../auth/password';
import { int, oneOf, optInt, optStr, str } from '../utils/parse';

const ROLES = ['staff', 'admin'] as const;

/** Loose on purpose: the mail server is the authority on which addresses exist. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function adminRouter(db: Db, mailer: Mailer): Router {
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
        postalCode: optStr(req.body, 'postalCode'),
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
      const name = optStr(req.body, 'name');
      if (name && name !== user.name) {
        await userRepo.updateName(db, userId, name);
      }
      await userRepo.upsertProfile(db, {
        userId,
        postalCode: optStr(req.body, 'postalCode'),
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

  // --- Account management (§3.5): both roles, with role & password editing ---
  router.get(
    '/accounts',
    asyncHandler(async (_req, res) => {
      res.json(await userRepo.listAll(db));
    }),
  );

  router.post(
    '/accounts',
    asyncHandler(async (req, res) => {
      const email = str(req.body, 'email');
      if (await userRepo.findByEmail(db, email)) {
        throw new AppError(409, 'Email already in use');
      }
      const role = oneOf(req.body, 'role', ROLES);
      const passwordHash = await hashPassword(str(req.body, 'password'));
      const user = await userRepo.create(db, {
        name: str(req.body, 'name'),
        email,
        passwordHash,
        role,
      });
      if (role === 'staff') {
        await userRepo.upsertProfile(db, {
          userId: user.id,
          address: optStr(req.body, 'address'),
          homeNearestStation: optStr(req.body, 'homeNearestStation'),
          phone: optStr(req.body, 'phone'),
        });
      }
      res.status(201).json(user);
    }),
  );

  router.put(
    '/accounts/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const target = await userRepo.findById(db, id);
      if (!target) throw new AppError(404, 'Account not found');

      const email = str(req.body, 'email');
      const role = oneOf(req.body, 'role', ROLES);
      const clash = await userRepo.findByEmail(db, email);
      if (clash && clash.id !== id) throw new AppError(409, 'Email already in use');
      if (target.role === 'admin' && role !== 'admin' && (await userRepo.adminCount(db)) <= 1) {
        throw new AppError(400, 'Cannot demote the last admin');
      }

      const updated = await userRepo.updateAccount(db, id, {
        name: str(req.body, 'name'),
        email,
        role,
      });
      res.json(updated);
    }),
  );

  router.put(
    '/accounts/:id/password',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!(await userRepo.findById(db, id))) throw new AppError(404, 'Account not found');
      await userRepo.setPassword(db, id, await hashPassword(str(req.body, 'password')));
      res.json({ ok: true });
    }),
  );

  router.delete(
    '/accounts/:id',
    asyncHandler(async (req: AuthRequest, res) => {
      const id = Number(req.params.id);
      if (req.user!.id === id) throw new AppError(400, 'You cannot delete your own account');
      const target = await userRepo.findById(db, id);
      if (!target) {
        res.status(204).end();
        return;
      }
      if (target.role === 'admin' && (await userRepo.adminCount(db)) <= 1) {
        throw new AppError(400, 'Cannot delete the last admin');
      }
      await userRepo.remove(db, id);
      res.status(204).end();
    }),
  );

  // --- Per-day cost-bucket re-tagging (direct vs indirect) ---
  // List a staff member's attendance days for a month (for the re-tag view).
  router.get(
    '/staff/:id/attendance',
    asyncHandler(async (req, res) => {
      const staffId = Number(req.params.id);
      const month = str(req.query as Record<string, unknown>, 'month');
      res.json(await attendanceRepo.listForMonth(db, staffId, month));
    }),
  );

  // Re-tag one day's bucket; its auto transport lines follow the same bucket.
  router.put(
    '/attendance/:id/bucket',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const bucket = oneOf(req.body, 'bucket', COST_BUCKETS);
      const existing = await attendanceRepo.getById(db, id);
      if (!existing) throw new AppError(404, 'Attendance not found');

      const updated = await attendanceRepo.updateBucket(db, id, bucket);
      await expenseRepo.setBucketForAutoTransport(
        db,
        existing.staff_id,
        existing.work_date,
        bucket,
      );
      res.json(updated);
    }),
  );

  // --- 区間別交通費マスタ ---
  // The route memo (経路メモ) is derived automatically as "出発駅→到着駅";
  // callers may still pass an explicit routeNote to override it.
  const deriveRouteNote = (from: string, to: string) => `${from}→${to}`;

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
      const fromStation = str(req.body, 'fromStation');
      const toStation = str(req.body, 'toStation');
      const saved = await masterRepo.upsertRouteFare(db, {
        fromStation,
        toStation,
        oneWayFare: fare,
        mode: optStr(req.body, 'mode'),
        routeNote: optStr(req.body, 'routeNote') ?? deriveRouteNote(fromStation, toStation),
      });
      res.status(201).json(saved);
    }),
  );

  router.put(
    '/route-fares/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!(await masterRepo.getRouteFare(db, id))) {
        throw new AppError(404, 'Route fare not found');
      }
      const fare = int(req.body, 'oneWayFare');
      if (fare < 0) throw new AppError(400, 'oneWayFare must be >= 0');
      const fromStation = str(req.body, 'fromStation');
      const toStation = str(req.body, 'toStation');
      const clash = await masterRepo.findRouteFare(db, fromStation, toStation);
      if (clash && clash.id !== id) {
        throw new AppError(409, 'A fare for this route already exists');
      }
      const saved = await masterRepo.updateRouteFare(db, id, {
        fromStation,
        toStation,
        oneWayFare: fare,
        mode: optStr(req.body, 'mode'),
        routeNote: optStr(req.body, 'routeNote') ?? deriveRouteNote(fromStation, toStation),
      });
      res.json(saved);
    }),
  );

  router.delete(
    '/route-fares/:id',
    asyncHandler(async (req, res) => {
      await masterRepo.removeRouteFare(db, Number(req.params.id));
      res.status(204).end();
    }),
  );

  // --- メール設定 (app_settings) ---
  router.get(
    '/email-settings',
    asyncHandler(async (_req, res) => {
      res.json({
        testRecipient: await settingsRepo.get(db, EMAIL_TEST_RECIPIENT),
        smtpConfigured: mailer.live,
      });
    }),
  );

  // Set or clear the address document mail is diverted to. Empty clears it and
  // returns delivery to each staff member's own registered address.
  router.put(
    '/email-settings',
    asyncHandler(async (req, res) => {
      const raw = optStr(req.body, 'testRecipient')?.trim() ?? null;
      if (raw && !EMAIL_RE.test(raw)) {
        throw new AppError(400, `Invalid email address: ${raw}`);
      }
      await settingsRepo.set(db, EMAIL_TEST_RECIPIENT, raw);
      res.json({ testRecipient: raw, smtpConfigured: mailer.live });
    }),
  );

  // Send a throwaway message to the configured address, so an admin can confirm
  // delivery without generating a real document for a real staff member.
  router.post(
    '/email-settings/test',
    asyncHandler(async (_req, res) => {
      const to = await settingsRepo.get(db, EMAIL_TEST_RECIPIENT);
      if (!to) throw new AppError(400, 'No test recipient configured');

      const { messageId, mode, previewUrl } = await mailer.send({
        to,
        subject: '【朝日新聞】メール送信テスト',
        html:
          '<p>朝日新聞 勤怠・交通費システムからのテスト送信です。</p>' +
          '<p>このメールが届いていれば、書類のメール送信は正常に動作しています。</p>',
        attachments: [],
      });
      res.json({ sent: true, to, delivery: mode, previewUrl, messageId });
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
            // 弁当代有無 rolls up to a day count on the monthly summary.
            lunchDays: payroll.result.days.filter((d) => d.lunchProvided).length,
          };
        }),
      );
      res.json({ month, records });
    }),
  );

  return router;
}
