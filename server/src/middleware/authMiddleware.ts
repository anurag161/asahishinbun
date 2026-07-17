import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../auth/jwt';
import type { Role } from '../db/types';

export interface AuthRequest extends Request {
  user?: { id: number; role: Role };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
