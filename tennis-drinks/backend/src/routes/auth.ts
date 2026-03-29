import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import db from '../db/schema';
import { JWT_SECRET, authenticate, AuthRequest } from '../middleware/auth';

function sendPinEmail(email: string, firstName: string, tempPin: string): void {
  try {
    const rows = db.prepare(`SELECT key, value FROM app_settings WHERE key LIKE 'email_%'`).all() as any[];
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;
    if (!s.email_host || !s.email_user || !s.email_pass) return; // Kein SMTP konfiguriert
    const transport = nodemailer.createTransport({
      host: s.email_host,
      port: parseInt(s.email_port || '587'),
      secure: (s.email_port || '587') === '465',
      auth: { user: s.email_user, pass: s.email_pass },
    });
    transport.sendMail({
      from: `"${s.email_from_name || 'TV Bruvi'}" <${s.email_from || s.email_user}>`,
      to: email,
      subject: 'TV Bruvi – Dein neuer Temp-PIN',
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#1A3B8F,#0F2566);padding:20px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">🎾 TV Bruvi</h1>
        </div>
        <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
          <p>Hallo <strong>${firstName}</strong>,</p>
          <p>dein Temp-PIN wurde zurückgesetzt:</p>
          <div style="text-align:center;margin:20px 0">
            <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#1A3B8F">${tempPin}</span>
          </div>
          <p style="color:#64748b;font-size:13px">Bitte melde dich an und ändere deinen PIN umgehend im Profil.</p>
        </div>
      </div>`,
    }).catch(() => {}); // Fehler beim E-Mail-Versand ignorieren – PIN wurde trotzdem gesetzt
  } catch {}
}

const router = Router();

// Rate-Limit für PIN-Reset (5 Versuche pro 30 Min)
const resetPinLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: { error: 'Zu viele PIN-Reset-Versuche – bitte warte 30 Minuten.' },
});

router.post('/login', (req: Request, res: Response) => {
  const { first_name, last_name, pin } = req.body;
  if (!first_name || !last_name || !pin) {
    res.status(400).json({ error: 'Vorname, Nachname und PIN erforderlich' }); return;
  }
  const member = db.prepare(
    'SELECT * FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND active = 1'
  ).get(first_name.trim(), last_name.trim()) as any;
  if (!member || !bcrypt.compareSync(String(pin), member.pin_hash)) {
    // Fehlgeschlagenen Login loggen
    if (member) {
      db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by) VALUES ('member', ?, 'login_failed', NULL, 'PIN falsch', ?)`).run(member.id, member.id);
    }
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

  // Generische Antwort um Account-Enumeration zu verhindern
  const existingName = db.prepare(
    'SELECT id FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)'
  ).get(first_name.trim(), last_name.trim()) as any;
  if (existingName) {
    // Gleiche Erfolgsmeldung – verrät nicht ob Name existiert
    res.json({ message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
    return;
  }

  const existingNr = db.prepare('SELECT id FROM members WHERE member_number = ?').get(member_number) as any;
  if (existingNr) {
    res.json({ message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
    return;
  }

  const pin_hash = bcrypt.hashSync(String(pin), 10);
  try {
    db.prepare(`
      INSERT INTO members (member_number, first_name, last_name, email, phone, status, role, pin_hash, active)
      VALUES (?, ?, ?, ?, ?, 'inaktiv', 'mitglied', ?, 0)
    `).run(member_number, first_name.trim(), last_name.trim(), email || null, phone || null, pin_hash);
    res.json({ message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
  } catch (e: any) {
    // Generische Antwort
    res.json({ message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
  }
});

// Public: self-service PIN reset – mit Rate-Limit
router.post('/reset-pin', resetPinLimiter, (req: Request, res: Response) => {
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

  // Audit-Log
  db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by) VALUES ('member', ?, 'pin_reset', NULL, 'Temp-PIN generiert', ?)`).run(member.id, member.id);

  // E-Mail senden wenn Adresse hinterlegt
  if (member.email) {
    sendPinEmail(member.email, member.first_name, tempPin);
  }

  res.json({
    message: member.email ? 'PIN zurückgesetzt und per E-Mail gesendet' : 'PIN zurückgesetzt',
    temp_pin: tempPin,
    email_sent: !!member.email,
  });
});

export default router;
