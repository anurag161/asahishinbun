import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { Role } from '../db/types';

export interface JwtPayload {
  id: number;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  return { id: decoded.id, role: decoded.role };
}
