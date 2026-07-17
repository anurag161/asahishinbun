import { Router } from 'express';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { masterRepo } from '../repositories/masterRepo';
import { optStr, str } from '../utils/parse';

export function stadiumsRouter(db: Db): Router {
  const router = Router();
  router.use(authMiddleware); // any authenticated user can read the stadium list

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await masterRepo.listStadiums(db));
    }),
  );

  // Admin-only writes.
  router.post(
    '/',
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const created = await masterRepo.createStadium(db, {
        name: str(req.body, 'name'),
        address: optStr(req.body, 'address'),
        nearestStation: str(req.body, 'nearestStation'),
      });
      res.status(201).json(created);
    }),
  );

  router.put(
    '/:id',
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const updated = await masterRepo.updateStadium(db, Number(req.params.id), {
        name: str(req.body, 'name'),
        address: optStr(req.body, 'address'),
        nearestStation: str(req.body, 'nearestStation'),
      });
      if (!updated) throw new AppError(404, 'Stadium not found');
      res.json(updated);
    }),
  );

  router.delete(
    '/:id',
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      await masterRepo.removeStadium(db, Number(req.params.id));
      res.status(204).end();
    }),
  );

  return router;
}
