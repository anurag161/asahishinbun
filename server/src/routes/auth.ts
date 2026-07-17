import { Router } from 'express';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { userRepo } from '../repositories/userRepo';
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
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    }),
  );

  return router;
}
