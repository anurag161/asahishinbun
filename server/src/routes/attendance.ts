import { Router } from 'express';
import { COST_BUCKETS } from '@asahi/shared';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { attendanceRepo, type AttendanceInput } from '../repositories/attendanceRepo';
import { expenseRepo } from '../repositories/expenseRepo';
import { masterRepo } from '../repositories/masterRepo';
import { userRepo } from '../repositories/userRepo';
import { applyAutoTransport, resolveRoundTrip } from '../services/transportService';
import { bool, int, minutesField, oneOf, str } from '../utils/parse';

function parseBody(body: Record<string, unknown>, staffId: number): AttendanceInput {
  const startMinutes = minutesField(body, 'startMinutes', 'start');
  const endMinutes = minutesField(body, 'endMinutes', 'end');
  const breakTaken = bool(body, 'breakTaken', false);
  const breakMinutes = breakTaken ? int(body, 'breakMinutes') : 0;

  if (endMinutes - startMinutes - breakMinutes < 0) {
    throw new AppError(400, 'Worked time cannot be negative (check start/end/break).');
  }

  // 弁当代有無 (○/×). Only valid above 6 worked hours; the client only offers it
  // then, and the engine ignores it below the threshold, so accept it as declared.
  const lunchAllowance = bool(body, 'lunchAllowance', false);

  return {
    staffId,
    workDate: str(body, 'date'),
    stadiumId: int(body, 'stadiumId'),
    startMinutes,
    endMinutes,
    breakTaken,
    breakMinutes,
    lunchAllowance,
    bucket: oneOf(body, 'bucket', COST_BUCKETS, 'henshu'),
    overtimeMinutes: body.overtimeMinutes == null ? 0 : int(body, 'overtimeMinutes'),
    nightMinutes: body.nightMinutes == null ? 0 : int(body, 'nightMinutes'),
    tournament: bool(body, 'tournament', false),
  };
}

/** Sync auto transport lines to the attendance row's stadium/date/bucket. */
async function syncTransport(db: Db, staffId: number, input: AttendanceInput) {
  const [profile, stadium] = await Promise.all([
    userRepo.getProfile(db, staffId),
    masterRepo.getStadium(db, input.stadiumId),
  ]);
  if (!stadium) throw new AppError(400, 'Stadium not found');

  return applyAutoTransport(db, {
    staffId,
    date: input.workDate,
    bucket: input.bucket,
    homeStation: profile?.home_nearest_station ?? null,
    stadiumStation: stadium.nearest_station,
  });
}

export function attendanceRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware, requireRole('staff'));

  // GET /api/attendance?month=YYYY-MM
  router.get(
    '/',
    asyncHandler(async (req: AuthRequest, res) => {
      const month = str(req.query as Record<string, unknown>, 'month');
      const rows = await attendanceRepo.listForMonth(db, req.user!.id, month);
      res.json(rows);
    }),
  );

  // GET /api/attendance/transport-preview?stadiumId=N
  //
  // What auto transport WOULD be calculated for this stadium, so the staff member
  // sees the route and the round-trip fare BEFORE pressing 追加 instead of finding
  // out from the toast afterwards.
  //
  // Deliberately resolved through resolveRoundTrip — the same function the save
  // path uses — so the preview cannot drift from the figure that actually lands
  // on the day. A second fare lookup written for the form would be free to
  // disagree with the engine, which is exactly the bug this screen is meant to
  // make impossible.
  //
  // Declared before any '/:id' route so the literal path is never swallowed by a
  // parameter match.
  router.get(
    '/transport-preview',
    asyncHandler(async (req: AuthRequest, res) => {
      const stadiumId = int(req.query as Record<string, unknown>, 'stadiumId');
      const [profile, stadium] = await Promise.all([
        userRepo.getProfile(db, req.user!.id),
        masterRepo.getStadium(db, stadiumId),
      ]);
      if (!stadium) throw new AppError(404, 'Stadium not found');

      const homeStation = profile?.home_nearest_station ?? null;
      const trip = homeStation
        ? await resolveRoundTrip(db, homeStation, stadium.nearest_station)
        : null;

      res.json({
        homeStation,
        stadiumStation: stadium.nearest_station,
        mode: trip?.mode ?? null,
        outboundFare: trip?.outboundFare ?? 0,
        inboundFare: trip?.inboundFare ?? 0,
        totalYen: trip ? trip.outboundFare + trip.inboundFare : 0,
        applied: trip !== null,
        // The two ways of getting ¥0 need different fixes — an unregistered home
        // station is fixed on アルバイトマスタ, a missing pair on 区間マスタ — so the
        // form has to be able to tell them apart.
        reason: !homeStation ? 'noHomeStation' : trip ? null : 'noRoute',
      });
    }),
  );

  // POST /api/attendance
  router.post(
    '/',
    asyncHandler(async (req: AuthRequest, res) => {
      const staffId = req.user!.id;
      const input = parseBody(req.body, staffId);

      let created;
      try {
        created = await attendanceRepo.create(db, input);
      } catch (err) {
        // unique (staff_id, work_date) violation
        const msg = String((err as { message?: string }).message ?? '');
        if (/duplicate|unique/i.test(msg) || (err as { code?: string }).code === '23505') {
          throw new AppError(409, `Attendance already exists for ${input.workDate}`);
        }
        throw err;
      }

      const transport = await syncTransport(db, staffId, input);
      res.status(201).json({ attendance: created, transport });
    }),
  );

  // PUT /api/attendance/:id
  router.put(
    '/:id',
    asyncHandler(async (req: AuthRequest, res) => {
      const staffId = req.user!.id;
      const id = Number(req.params.id);
      const existing = await attendanceRepo.getById(db, id);
      if (!existing || existing.staff_id !== staffId) {
        throw new AppError(404, 'Attendance not found');
      }

      const input = parseBody(req.body, staffId);
      // If the date changed, clear transport tied to the old date.
      if (existing.work_date !== input.workDate) {
        await expenseRepo.removeAutoTransport(db, staffId, existing.work_date);
      }
      const updated = await attendanceRepo.update(db, id, input);
      const transport = await syncTransport(db, staffId, input);
      res.json({ attendance: updated, transport });
    }),
  );

  // DELETE /api/attendance/:id
  router.delete(
    '/:id',
    asyncHandler(async (req: AuthRequest, res) => {
      const staffId = req.user!.id;
      const id = Number(req.params.id);
      const existing = await attendanceRepo.getById(db, id);
      if (!existing || existing.staff_id !== staffId) {
        throw new AppError(404, 'Attendance not found');
      }
      await expenseRepo.removeAutoTransport(db, staffId, existing.work_date);
      await attendanceRepo.remove(db, id);
      res.status(204).end();
    }),
  );

  return router;
}
