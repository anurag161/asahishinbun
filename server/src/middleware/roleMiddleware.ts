import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './authMiddleware';
import type { Role } from '../db/types';

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
