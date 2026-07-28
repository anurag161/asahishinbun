import { Router } from 'express';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { userRepo } from '../repositories/userRepo';
import { resolveDefaultMonth } from '../services/defaultMonthService';
import { str } from '../utils/parse';

export function authRouter(db: Db): Router {
  const router = Router();

  // POST /api/auth/login → { token, user }
  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const email = str(req.body, 'email');
      const password = str(req.body, 'password');

      const user = await userRepo.findByEmail(db, email);
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        throw new AppError(401, 'Invalid email or password');
      }

      const token = signToken({ id: user.id, role: user.role });
      // Ship the month to open on with the session itself. Resolving it later, in
      // a separate request, meant every page painted on today's (empty) month
      // first — which on a fresh demo reads as "nothing works".
      const defaultMonth = await resolveDefaultMonth(db, user.id, user.role);
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        defaultMonth,
      });
    }),
  );

  // GET /api/auth/me → current user
  router.get(
    '/me',
    authMiddleware,
    asyncHandler(async (req: AuthRequest, res) => {
      const user = await userRepo.findById(db, req.user!.id);
      if (!user) throw new AppError(404, 'User not found');
      // Same on a restored session as on a fresh login — see the note there.
      const defaultMonth = await resolveDefaultMonth(db, user.id, user.role);
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        defaultMonth,
      });
    }),
  );

  return router;
}
