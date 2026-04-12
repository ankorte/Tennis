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

  // Mitglied suchen (auch inaktiv um Lockout-Meldungen zu zeigen)
  const member = db.prepare(
    'SELECT * FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)'
  ).get(first_name.trim(), last_name.trim()) as any;

  if (!member) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' }); return;
  }

  // Account gesperrt (permanent – locked_until = '9999-...')
  if (member.active === 0 && member.locked_until === '9999-12-31T23:59:59') {
    res.status(403).json({ error: '🔒 Account gesperrt. Bitte wende dich an den Administrator.' }); return;
  }

  // Inaktiver Account (nicht durch Lockout gesperrt)
  if (member.active === 0) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' }); return;
  }

  // Temporäre Sperrzeit prüfen
  if (member.locked_until) {
    const lockedUntil = new Date(member.locked_until).getTime();
    const remaining = lockedUntil - Date.now();
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      const minutes = Math.ceil(remaining / 60000);
      res.status(429).json({
        error: `Zu viele Fehlversuche. Bitte warte noch ${seconds < 60 ? `${seconds} Sekunde${seconds !== 1 ? 'n' : ''}` : `${minutes} Minute${minutes !== 1 ? 'n' : ''}`}.`,
        locked_until: member.locked_until,
        remaining_ms: remaining,
      }); return;
    }
  }

  // PIN prüfen
  const pinCorrect = bcrypt.compareSync(String(pin), member.pin_hash);

  if (!pinCorrect) {
    const newAttempts = (member.failed_login_attempts || 0) + 1;
    let lockedUntil: string | null = null;
    let accountLocked = false;

    if (newAttempts >= 9) {
      // Permanent sperren
      accountLocked = true;
      lockedUntil = '9999-12-31T23:59:59';
      db.prepare(`UPDATE members SET failed_login_attempts = ?, locked_until = ?, active = 0, updated_at = datetime('now') WHERE id = ?`)
        .run(newAttempts, lockedUntil, member.id);
      db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by) VALUES ('member', ?, 'account_locked', NULL, '9 Fehlversuche', ?)`).run(member.id, member.id);
      res.status(403).json({ error: '🔒 Account gesperrt nach zu vielen Fehlversuchen. Bitte wende dich an den Administrator.' }); return;
    } else if (newAttempts >= 6) {
      // 5 Minuten sperren
      lockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    } else if (newAttempts >= 3) {
      // 1 Minute sperren
      lockedUntil = new Date(Date.now() + 1 * 60 * 1000).toISOString();
    }

    db.prepare(`UPDATE members SET failed_login_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newAttempts, lockedUntil, member.id);
    db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by) VALUES ('member', ?, 'login_failed', NULL, ?, ?)`).run(member.id, `Fehlversuch ${newAttempts}`, member.id);

    if (lockedUntil && !accountLocked) {
      const remaining = new Date(lockedUntil).getTime() - Date.now();
      const minutes = Math.ceil(remaining / 60000);
      res.status(429).json({
        error: `Zu viele Fehlversuche. Account für ${minutes} Minute${minutes !== 1 ? 'n' : ''} gesperrt.`,
        locked_until: lockedUntil,
        remaining_ms: remaining,
      }); return;
    }

    const attemptsLeft = newAttempts < 3 ? 3 - newAttempts : newAttempts < 6 ? 6 - newAttempts : 9 - newAttempts;
    res.status(401).json({ error: `PIN falsch. Noch ${attemptsLeft} Versuch${attemptsLeft !== 1 ? 'e' : ''} vor nächster Sperre.` });
    return;
  }

  // Erfolgreicher Login – Zähler zurücksetzen
  db.prepare(`UPDATE members SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`).run(member.id);

  const token = jwt.sign(
    { id: member.id, role: member.role, member_number: member.member_number },
    JWT_SECRET, { expiresIn: '24h' }
  );
  res.json({
    token,
    must_change_pin: member.must_change_pin === 1,
    user: {
      id: member.id, first_name: member.first_name, last_name: member.last_name,
      email: member.email || '', phone: member.phone || '',
      role: member.role, member_number: member.member_number, team: member.team,
      must_change_pin: member.must_change_pin === 1,
    }
  });
});

// Eigenen PIN ändern (authentifiziert, mit aktuellem PIN zur Verifikation)
router.post('/change-pin', authenticate, (req: AuthRequest, res: Response) => {
  const { current_pin, new_pin } = req.body;
  if (!current_pin || !new_pin) {
    res.status(400).json({ error: 'Aktueller und neuer PIN erforderlich' }); return;
  }
  if (String(new_pin).length < 4) {
    res.status(400).json({ error: 'Neuer PIN muss mindestens 4 Stellen haben' }); return;
  }
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.user!.id) as any;
  if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }

  if (!bcrypt.compareSync(String(current_pin), member.pin_hash)) {
    res.status(401).json({ error: 'Aktueller PIN ist falsch' }); return;
  }
  if (bcrypt.compareSync(String(new_pin), member.pin_hash)) {
    res.status(400).json({ error: 'Neuer PIN muss sich vom aktuellen unterscheiden' }); return;
  }

  const pin_hash = bcrypt.hashSync(String(new_pin), 10);
  db.prepare(`UPDATE members SET pin_hash = ?, must_change_pin = 0, updated_at = datetime('now') WHERE id = ?`)
    .run(pin_hash, member.id);
  db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by) VALUES ('member', ?, 'pin_changed', NULL, 'PIN selbst geändert', ?)`)
    .run(member.id, member.id);
  res.json({ message: 'PIN erfolgreich geändert' });
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  const member = db.prepare(
    'SELECT id, member_number, first_name, last_name, email, phone, role, team, status FROM members WHERE id = ?'
  ).get(req.user!.id);
  res.json(member);
});

// Hilfsfunktion: nächste freie Mitgliedsnummer vergeben (Format M001, M002, ...)
function nextMemberNumber(): string {
  const rows = db.prepare(`SELECT member_number FROM members`).all() as any[];
  let max = 0;
  for (const { member_number } of rows) {
    const match = String(member_number).match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return `M${String(next).padStart(3, '0')}`;
}

// Public: self-registration – creates member with active=0 (pending admin approval)
router.post('/register', (req: Request, res: Response) => {
  const { first_name, last_name, email, phone, pin } = req.body;
  if (!first_name || !last_name || !pin) {
    res.status(400).json({ error: 'Pflichtfelder fehlen (Vor-/Nachname, PIN)' }); return;
  }
  if (String(pin).length < 4) {
    res.status(400).json({ error: 'PIN muss mindestens 4 Stellen haben' }); return;
  }

  // Generische Antwort um Account-Enumeration zu verhindern
  const existingName = db.prepare(
    'SELECT id FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)'
  ).get(first_name.trim(), last_name.trim()) as any;
  if (existingName) {
    res.json({ message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
    return;
  }

  const member_number = nextMemberNumber();
  const pin_hash = bcrypt.hashSync(String(pin), 10);
  try {
    db.prepare(`
      INSERT INTO members (member_number, first_name, last_name, email, phone, status, role, pin_hash, active)
      VALUES (?, ?, ?, ?, ?, 'inaktiv', 'mitglied', ?, 0)
    `).run(member_number, first_name.trim(), last_name.trim(), email || null, phone || null, pin_hash);
    res.json({ message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
  } catch (e: any) {
    res.json({ message: 'Registrierung eingereicht. Ein Administrator aktiviert deinen Account.' });
  }
});

// Public: self-service PIN reset – mit Rate-Limit
router.post('/reset-pin', resetPinLimiter, (req: Request, res: Response) => {
  const { first_name, last_name, email, phone } = req.body;
  if (!first_name || !last_name || (!email && !phone)) {
    res.status(400).json({ error: 'Vorname, Nachname und E-Mail-Adresse oder Telefonnummer erforderlich' }); return;
  }

  // Erst per E-Mail suchen, falls keine E-Mail dann per Telefon
  let member: any = null;
  if (email) {
    member = db.prepare(
      'SELECT * FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND LOWER(email) = LOWER(?) AND active = 1'
    ).get(first_name.trim(), last_name.trim(), email.trim());
  }
  if (!member && phone) {
    // Telefonnummern normalisieren (nur Ziffern vergleichen)
    const allMembers = db.prepare(
      'SELECT * FROM members WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND active = 1'
    ).all(first_name.trim(), last_name.trim()) as any[];
    const normalizePhone = (p: string) => p.replace(/\D/g, '');
    const inputPhone = normalizePhone(phone);
    member = allMembers.find(m => m.phone && normalizePhone(m.phone) === inputPhone) || null;
  }
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
