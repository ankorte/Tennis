import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/schema';
import { JWT_SECRET, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { first_name, last_name, pin } = req.body;
  if (!first_name || !last_name || !pin) {
    res.status(400).json({ error: 'Vorname, Nachname und PIN erforderlich' }); return;
  }
  const member = db.prepare(
    'SELECT * FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND active = 1'
  ).get(first_name.trim(), last_name.trim()) as any;
  if (!member || !bcrypt.compareSync(String(pin), member.pin_hash)) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }
  const token = jwt.sign(
    { id: member.id, role: member.role, member_number: member.member_number },
    JWT_SECRET, { expiresIn: '24h' }
  );
  res.json({
    token,
    user: {
      id: member.id, first_name: member.first_name, last_name: member.last_name,
      email: member.email || '', role: member.role,
      member_number: member.member_number, team: member.team
    }
  });
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  const member = db.prepare(
    'SELECT id, member_number, first_name, last_name, email, phone, role, team, status FROM members WHERE id = ?'
  ).get(req.user!.id);
  res.json(member);
});

// Public: self-registration – creates member with active=0 (pending admin approval)
router.post('/register', (req: Request, res: Response) => {
  const { member_number, first_name, last_name, email, phone, pin } = req.body;
  if (!member_number || !first_name || !last_name || !pin) {
    res.status(400).json({ error: 'Pflichtfelder fehlen (Mitgl.-Nr., Vor-/Nachname, PIN)' }); return;
  }
  if (String(pin).length < 4) {
    res.status(400).json({ error: 'PIN muss mindestens 4 Stellen haben' }); return;
  }

  // Prüfe ob Name oder Mitgliedsnummer schon existiert
  const existingName = db.prepare(
    'SELECT id FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)'
  ).get(first_name.trim(), last_name.trim()) as any;
  if (existingName) {
    res.status(400).json({ error: 'Ein Mitglied mit diesem Namen existiert bereits' }); return;
  }

  const existingNr = db.prepare('SELECT id FROM members WHERE member_number = ?').get(member_number) as any;
  if (existingNr) {
    res.status(400).json({ error: 'Mitgliedsnummer bereits vergeben' }); return;
  }

  const pin_hash = bcrypt.hashSync(String(pin), 10);
  try {
    const result = db.prepare(`
      INSERT INTO members (member_number, first_name, last_name, email, phone, status, role, pin_hash, active)
      VALUES (?, ?, ?, ?, ?, 'inaktiv', 'mitglied', ?, 0)
    `).run(member_number, first_name.trim(), last_name.trim(), email || null, phone || null, pin_hash);
    res.json({ id: result.lastInsertRowid, message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Public: self-service PIN reset via first_name + last_name + member_number
router.post('/reset-pin', (req: Request, res: Response) => {
  const { first_name, last_name, member_number } = req.body;
  if (!first_name || !last_name || !member_number) {
    res.status(400).json({ error: 'Vorname, Nachname und Mitgliedsnummer erforderlich' }); return;
  }

  const member = db.prepare(
    'SELECT * FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND member_number = ? AND active = 1'
  ).get(first_name.trim(), last_name.trim(), member_number) as any;
  if (!member) {
    res.status(404).json({ error: 'Kein aktives Mitglied mit diesen Daten gefunden' }); return;
  }

  const tempPin = String(Math.floor(1000 + Math.random() * 9000));
  const pin_hash = bcrypt.hashSync(tempPin, 10);
  db.prepare(`UPDATE members SET pin_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(pin_hash, member.id);

  res.json({ message: 'PIN zurückgesetzt', temp_pin: tempPin });
});

export default router;
