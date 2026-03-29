import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT id, member_number, first_name, last_name, email, phone, status, role, team, active, iban, bic, mandate_ref, mandate_date, daily_limit, created_at FROM members ORDER BY last_name, first_name').all();
  res.json(rows);
});

// Anzahl ausstehender Registrierungen (inactive)
router.get('/pending-count', requireRole('admin', 'kassenwart'), (_req: AuthRequest, res: Response) => {
  const row = db.prepare(`SELECT COUNT(*) as count FROM members WHERE active = 0 AND role = 'mitglied'`).get() as any;
  res.json({ count: row.count });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const member = db.prepare('SELECT id, member_number, first_name, last_name, email, phone, status, role, team, active, iban, bic, mandate_ref, mandate_date, daily_limit, created_at FROM members WHERE id = ?').get(req.params.id);
  if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }
  res.json(member);
});

router.post('/', requireRole('admin', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const { member_number, first_name, last_name, email, phone, status, role, team, pin } = req.body;
  if (!member_number || !first_name || !last_name || !pin) {
    res.status(400).json({ error: 'Pflichtfelder fehlen (Mitgl.-Nr., Vor-/Nachname, PIN)' }); return;
  }
  const pin_hash = bcrypt.hashSync(String(pin), 10);
  try {
    const result = db.prepare(`
      INSERT INTO members (member_number, first_name, last_name, email, phone, status, role, team, pin_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(member_number, first_name.trim(), last_name.trim(), email || null, phone || null, status || 'aktiv', role || 'mitglied', team || null, pin_hash);
    res.json({ id: result.lastInsertRowid, message: 'Mitglied angelegt' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireRole('admin', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const { first_name, last_name, email, phone, status, role, team, active, pin, iban, bic, mandate_ref, mandate_date, daily_limit } = req.body;
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id) as any;
  if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }
  const pin_hash = pin ? bcrypt.hashSync(String(pin), 10) : member.pin_hash;
  const newDailyLimit = daily_limit !== undefined
    ? (daily_limit === '' || daily_limit === null ? null : Number(daily_limit))
    : member.daily_limit;
  db.prepare(`
    UPDATE members SET first_name=?, last_name=?, email=?, phone=?, status=?, role=?, team=?, active=?, pin_hash=?,
    iban=?, bic=?, mandate_ref=?, mandate_date=?, daily_limit=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    first_name ?? member.first_name, last_name ?? member.last_name, email ?? member.email,
    phone ?? member.phone, status ?? member.status, role ?? member.role, team ?? member.team,
    active ?? member.active, pin_hash,
    iban !== undefined ? iban : member.iban, bic !== undefined ? bic : member.bic,
    mandate_ref !== undefined ? mandate_ref : member.mandate_ref,
    mandate_date !== undefined ? mandate_date : member.mandate_date,
    newDailyLimit,
    req.params.id
  );
  res.json({ message: 'Mitglied aktualisiert' });
});

// Bulk import members from Excel
router.post('/import', requireRole('admin', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const { members: rows } = req.body;
  if (!Array.isArray(rows) || !rows.length) { res.status(400).json({ error: 'members fehlt' }); return; }
  const results: any[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const { member_number, first_name, last_name, email, phone, status, role, team, pin } = row;
      if (!member_number || !first_name || !last_name) {
        results.push({ ...row, status_result: 'Pflichtfelder fehlen (Nr, Vorname, Nachname)' }); continue;
      }
      const existing = db.prepare('SELECT id FROM members WHERE member_number = ?').get(member_number) as any;
      try {
        if (existing) {
          // Update existing member
          db.prepare(`UPDATE members SET first_name=?, last_name=?, email=?, phone=?, status=?, role=?, team=?, updated_at=datetime('now') WHERE id=?`)
            .run(first_name.trim(), last_name.trim(), email || null, phone || null, status || 'aktiv', role || 'mitglied', team || null, existing.id);
          if (pin) {
            const pin_hash = bcrypt.hashSync(String(pin), 10);
            db.prepare(`UPDATE members SET pin_hash=? WHERE id=?`).run(pin_hash, existing.id);
          }
          results.push({ member_number, name: `${first_name} ${last_name}`, status_result: 'aktualisiert' });
        } else {
          // Create new member (default PIN = member_number if not provided)
          const pinToHash = pin ? String(pin) : String(member_number).slice(-4);
          const pin_hash = bcrypt.hashSync(pinToHash, 10);
          db.prepare(`INSERT INTO members (member_number, first_name, last_name, email, phone, status, role, team, pin_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(member_number, first_name.trim(), last_name.trim(), email || null, phone || null, status || 'aktiv', role || 'mitglied', team || null, pin_hash);
          results.push({ member_number, name: `${first_name} ${last_name}`, status_result: 'neu angelegt', default_pin: pin ? undefined : pinToHash });
        }
      } catch (e: any) {
        results.push({ member_number, name: `${first_name} ${last_name}`, status_result: `Fehler: ${e.message}` });
      }
    }
  });
  tx();
  res.json({ results, created: results.filter(r => r.status_result === 'neu angelegt').length, updated: results.filter(r => r.status_result === 'aktualisiert').length, errors: results.filter(r => !['neu angelegt','aktualisiert'].includes(r.status_result)).length });
});

// Admin: reset a member's PIN to a generated temp value
router.post('/:id/reset-pin', requireRole('admin', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id) as any;
  if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }
  const lastFour = String(member.member_number).replace(/\D/g, '').slice(-4);
  const tempPin = lastFour.length === 4 ? lastFour : String(Math.floor(1000 + Math.random() * 9000));
  const pin_hash = bcrypt.hashSync(tempPin, 10);
  db.prepare(`UPDATE members SET pin_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(pin_hash, member.id);
  res.json({ message: 'PIN zurückgesetzt', temp_pin: tempPin });
});

// Admin: activate or deactivate a member
router.post('/:id/toggle-active', requireRole('admin', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const member = db.prepare('SELECT id, active FROM members WHERE id = ?').get(req.params.id) as any;
  if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }
  const newActive = member.active ? 0 : 1;
  db.prepare(`UPDATE members SET active = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newActive, newActive ? 'aktiv' : 'inaktiv', member.id);
  res.json({ message: newActive ? 'Mitglied aktiviert' : 'Mitglied deaktiviert', active: newActive });
});

// Get member balance
router.get('/:id/balance', (req: AuthRequest, res: Response) => {
  const memberId = req.params.id;
  const open = db.prepare(`
    SELECT COALESCE(SUM(b.total_price), 0) as total
    FROM bookings b
    WHERE b.member_id = ? AND b.cancelled = 0 AND b.status NOT IN ('storniert','abgerechnet')
  `).get(memberId) as any;
  const distributions = db.prepare(`
    SELECT COALESCE(SUM(d.amount), 0) as total
    FROM distributions d
    JOIN bookings b ON b.id = d.booking_id
    WHERE d.member_id = ? AND b.cancelled = 0 AND b.status NOT IN ('storniert','abgerechnet')
  `).get(memberId) as any;
  res.json({ open_amount: (open?.total || 0) + (distributions?.total || 0) });
});

export default router;
