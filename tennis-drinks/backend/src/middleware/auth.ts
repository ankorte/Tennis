import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// JWT Secret: aus Umgebungsvariable oder auto-generiert (persistent pro Instanz)
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  Kein JWT_SECRET gesetzt – auto-generiert. Setze JWT_SECRET in Umgebungsvariablen für stabile Sessions!');
  return generated;
})();

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
