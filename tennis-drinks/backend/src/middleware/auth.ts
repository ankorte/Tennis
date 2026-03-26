import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tennis-club-secret-2024';

export interface AuthRequest extends Request {
  user?: { id: number; role: string; member_number: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Nicht angemeldet' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; role: string; member_number: string };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }
    next();
  };
}

export { JWT_SECRET };
