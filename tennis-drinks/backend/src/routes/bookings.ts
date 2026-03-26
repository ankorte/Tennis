import { Router, Response } from 'express';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  let query = `
    SELECT b.*, d.name as drink_name, d.category as drink_category,
           m.first_name || ' ' || m.last_name as member_name,
           g.name as group_name,
           c.first_name || ' ' || c.last_name as created_by_name
    FROM bookings b
    JOIN drinks d ON d.id = b.drink_id
    LEFT JOIN members m ON m.id = b.member_id
    LEFT JOIN groups g ON g.id = b.group_id
    LEFT JOIN members c ON c.id = b.created_by
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  // Non-admins can only see their own bookings
  if (!['admin','kassenwart','thekenwart'].includes(req.user!.role)) {
    conditions.push('(b.member_id = ? OR b.created_by = ?)');
    params.push(req.user!.id, req.user!.id);
  }
  if (req.query.member_id) { conditions.push('b.member_id = ?'); params.push(req.query.member_id); }
  if (req.query.group_id) { conditions.push('b.group_id = ?'); params.push(req.query.group_id); }
  if (req.query.status) { conditions.push('b.status = ?'); params.push(req.query.status); }
  if (req.query.from) { conditions.push('b.created_at >= ?'); params.push(req.query.from); }
  if (req.query.to) { conditions.push('b.created_at <= ?'); params.push(req.query.to + ' 23:59:59'); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY b.created_at DESC LIMIT 500';

  res.json(db.prepare(query).all(...params));
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { drink_id, member_id, group_id, quantity, booking_type, guest_note } = req.body;
  if (!drink_id) { res.status(400).json({ error: 'Getränk fehlt' }); return; }

  const drink = db.prepare('SELECT * FROM drinks WHERE id = ? AND active = 1').get(drink_id) as any;
  if (!drink) { res.status(404).json({ error: 'Getränk nicht gefunden' }); return; }
  if (drink.stock <= 0) { res.status(400).json({ error: 'Getränk nicht auf Lager' }); return; }

  const qty = Math.max(1, parseInt(quantity) || 1);
  const total = parseFloat((drink.price * qty).toFixed(2));
  const type = booking_type || (group_id ? 'gruppe' : 'einzeln');
  const status = group_id ? 'offen_gruppe' : 'bestaetigt';
  const targetMember = member_id || (group_id ? null : req.user!.id);

  const result = db.prepare(`
    INSERT INTO bookings (drink_id, member_id, group_id, quantity, unit_price, total_price, booking_type, status, guest_note, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(drink_id, targetMember, group_id || null, qty, drink.price, total, type, status, guest_note || null, req.user!.id);

  // Reduce stock
  db.prepare(`UPDATE drinks SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?`).run(qty, drink_id);
  db.prepare(`INSERT INTO inventory_movements (drink_id, movement_type, quantity, comment, created_by) VALUES (?, 'verbrauch', ?, ?, ?)`).run(drink_id, -qty, `Buchung #${result.lastInsertRowid}`, req.user!.id);

  res.json({ id: result.lastInsertRowid, message: 'Buchung gespeichert', total_price: total });
});

// Favoriten: Top-3 meistgebuchte Getränke des Nutzers
router.get('/favorites', (req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT d.id, d.name, d.category, d.price, d.stock, d.unit, d.active,
           SUM(b.quantity) as total_qty
    FROM bookings b
    JOIN drinks d ON d.id = b.drink_id
    WHERE b.member_id = ? AND b.cancelled = 0 AND d.active = 1
    GROUP BY b.drink_id
    ORDER BY total_qty DESC
    LIMIT 3
  `).all(req.user!.id);
  res.json(rows);
});

// Persönliche Statistik
router.get('/my-stats', (req: AuthRequest, res: Response) => {
  const memberId = req.user!.id;

  // Gesamt diesen Monat
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const thisMonth = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(b.quantity), 0) as qty, COALESCE(SUM(b.total_price), 0) as total
    FROM bookings b WHERE b.member_id = ? AND b.cancelled = 0 AND b.created_at >= ?
  `).get(memberId, monthStart) as any;

  // Wochendurchschnitt (letzte 12 Wochen)
  const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 86400000).toISOString().split('T')[0];
  const weekAvg = db.prepare(`
    SELECT COALESCE(SUM(b.quantity), 0) / 12.0 as avg_per_week
    FROM bookings b WHERE b.member_id = ? AND b.cancelled = 0 AND b.created_at >= ?
  `).get(memberId, twelveWeeksAgo) as any;

  // Lieblingsgetränk
  const favorite = db.prepare(`
    SELECT d.name, SUM(b.quantity) as total_qty
    FROM bookings b JOIN drinks d ON d.id = b.drink_id
    WHERE b.member_id = ? AND b.cancelled = 0
    GROUP BY b.drink_id ORDER BY total_qty DESC LIMIT 1
  `).get(memberId) as any;

  // Letzte 8 Wochen als Chart-Daten
  const weeks: { week: string; qty: number; total: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(Date.now() - (i + 1) * 7 * 86400000).toISOString().split('T')[0];
    const wEnd = new Date(Date.now() - i * 7 * 86400000).toISOString().split('T')[0];
    const w = db.prepare(`
      SELECT COALESCE(SUM(b.quantity), 0) as qty, COALESCE(SUM(b.total_price), 0) as total
      FROM bookings b WHERE b.member_id = ? AND b.cancelled = 0 AND b.created_at >= ? AND b.created_at < ?
    `).get(memberId, wStart, wEnd) as any;
    weeks.push({ week: wStart, qty: w.qty, total: w.total });
  }

  res.json({
    thisMonth: { qty: thisMonth.qty, total: thisMonth.total },
    avgPerWeek: Math.round((weekAvg?.avg_per_week || 0) * 10) / 10,
    favorite: favorite ? { name: favorite.name, qty: favorite.total_qty } : null,
    weeks,
  });
});

// Vereinsstatistik (Thekenwart+)
router.get('/club-stats', requireRole('admin', 'kassenwart', 'thekenwart'), (_req: AuthRequest, res: Response) => {
  // Top 10 Getränke diesen Monat
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const topDrinksMonth = db.prepare(`
    SELECT d.name, d.category, SUM(b.quantity) as qty, SUM(b.total_price) as revenue
    FROM bookings b JOIN drinks d ON d.id = b.drink_id
    WHERE b.cancelled = 0 AND b.created_at >= ?
    GROUP BY b.drink_id ORDER BY qty DESC LIMIT 10
  `).all(monthStart);

  // Umsatz letzte 12 Monate
  const months: { month: string; qty: number; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-01`;
    const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1);
    const mEndStr = `${mEnd.getFullYear()}-${String(mEnd.getMonth() + 1).padStart(2, '0')}-01`;
    const m = db.prepare(`
      SELECT COALESCE(SUM(b.quantity), 0) as qty, COALESCE(SUM(b.total_price), 0) as revenue
      FROM bookings b WHERE b.cancelled = 0 AND b.created_at >= ? AND b.created_at < ?
    `).get(mStart, mEndStr) as any;
    months.push({ month: mStart, qty: m.qty, revenue: m.revenue });
  }

  // Aktivste Mitglieder diesen Monat
  const topMembers = db.prepare(`
    SELECT m.first_name || ' ' || m.last_name as name, SUM(b.quantity) as qty, SUM(b.total_price) as total
    FROM bookings b JOIN members m ON m.id = b.member_id
    WHERE b.cancelled = 0 AND b.created_at >= ?
    GROUP BY b.member_id ORDER BY qty DESC LIMIT 10
  `).all(monthStart);

  // Bestandsprognose
  const forecast = db.prepare(`
    SELECT d.id, d.name, d.stock, d.min_stock, d.category,
           COALESCE(SUM(b.quantity), 0) as consumed_30d
    FROM drinks d
    LEFT JOIN bookings b ON b.drink_id = d.id AND b.cancelled = 0
      AND b.created_at >= date('now', '-30 days')
    WHERE d.active = 1
    GROUP BY d.id
    ORDER BY d.stock ASC
  `).all() as any[];

  const forecastData = forecast.map(d => {
    const dailyRate = d.consumed_30d / 30;
    const daysLeft = dailyRate > 0 ? Math.round(d.stock / dailyRate) : null;
    return { id: d.id, name: d.name, stock: d.stock, min_stock: d.min_stock, category: d.category, consumed_30d: d.consumed_30d, daily_rate: Math.round(dailyRate * 10) / 10, days_left: daysLeft };
  });

  res.json({ topDrinksMonth, months, topMembers, forecast: forecastData });
});

// Aufteilen (Server-Side) – atomar in einer Transaktion
router.post('/split', (req: AuthRequest, res: Response) => {
  const { items, person_ids } = req.body;
  // items: [{ drink_id, quantity }], person_ids: [id1, id2, ...] (ohne den Nutzer selbst)
  if (!Array.isArray(items) || !items.length) { res.status(400).json({ error: 'Keine Artikel' }); return; }
  if (!Array.isArray(person_ids)) { res.status(400).json({ error: 'Personen fehlen' }); return; }

  const allPersons = [req.user!.id, ...person_ids];
  const results: any[] = [];

  const insertBooking = db.prepare(`
    INSERT INTO bookings (drink_id, member_id, quantity, unit_price, total_price, booking_type, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'einzeln', 'bestaetigt', ?)
  `);
  const reduceStock = db.prepare(`UPDATE drinks SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?`);
  const logMovement = db.prepare(`INSERT INTO inventory_movements (drink_id, movement_type, quantity, comment, created_by) VALUES (?, 'verbrauch', ?, ?, ?)`);

  db.transaction(() => {
    for (const item of items) {
      const drink = db.prepare('SELECT * FROM drinks WHERE id = ? AND active = 1').get(item.drink_id) as any;
      if (!drink) throw new Error(`Getränk ${item.drink_id} nicht gefunden`);
      if (drink.stock < item.quantity) throw new Error(`${drink.name}: nicht genug auf Lager`);

      // Round-Robin Verteilung
      for (let i = 0; i < item.quantity; i++) {
        const personId = allPersons[i % allPersons.length];
        const r = insertBooking.run(item.drink_id, personId, 1, drink.price, drink.price, req.user!.id);
        results.push({ booking_id: r.lastInsertRowid, drink: drink.name, person_id: personId });
      }

      reduceStock.run(item.quantity, item.drink_id);
      logMovement.run(item.drink_id, -item.quantity, `Split-Buchung (${allPersons.length} Personen)`, req.user!.id);
    }
  })();

  res.json({ message: 'Aufteilen gebucht', count: results.length, results });
});

// Cancel booking – Admin/Kassenwart/Thekenwart immer, Mitglied eigene Buchungen innerhalb 30 Min
const cancelHandler = (req: AuthRequest, res: Response) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) { res.status(404).json({ error: 'Buchung nicht gefunden' }); return; }
  if (booking.cancelled) { res.status(400).json({ error: 'Bereits storniert' }); return; }

  // Mitglieder dürfen nur eigene Buchungen innerhalb von 30 Minuten stornieren
  const isPrivileged = ['admin', 'kassenwart', 'thekenwart'].includes(req.user!.role);
  if (!isPrivileged) {
    if (booking.created_by !== req.user!.id) {
      res.status(403).json({ error: 'Nur eigene Buchungen können storniert werden' }); return;
    }
    const age = Date.now() - new Date(booking.created_at).getTime();
    if (age > 30 * 60 * 1000) {
      res.status(403).json({ error: 'Stornierung nur innerhalb von 30 Minuten möglich' }); return;
    }
  }

  db.prepare(`UPDATE bookings SET cancelled = 1, status = 'storniert' WHERE id = ?`).run(req.params.id);
  db.prepare(`UPDATE drinks SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`).run(booking.quantity, booking.drink_id);
  db.prepare(`INSERT INTO inventory_movements (drink_id, movement_type, quantity, comment, created_by) VALUES (?, 'storno', ?, ?, ?)`).run(booking.drink_id, booking.quantity, `Storno Buchung #${booking.id}`, req.user!.id);
  db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by) VALUES ('booking', ?, 'storno', 'bestaetigt', 'storniert', ?)`).run(booking.id, req.user!.id);

  res.json({ message: 'Buchung storniert' });
};
router.post('/:id/cancel', cancelHandler);
router.put('/:id/cancel', cancelHandler);

// Distribute group booking
router.post('/:id/distribute', requireRole('admin','kassenwart','thekenwart'), (req: AuthRequest, res: Response) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking || booking.status !== 'offen_gruppe') { res.status(400).json({ error: 'Buchung nicht verteiltbar' }); return; }

  const { distributions } = req.body; // [{ member_id, quantity, amount }]
  if (!Array.isArray(distributions) || !distributions.length) { res.status(400).json({ error: 'Verteilung fehlt' }); return; }

  const insertDist = db.prepare('INSERT INTO distributions (booking_id, member_id, quantity, amount) VALUES (?, ?, ?, ?)');
  for (const d of distributions) {
    insertDist.run(booking.id, d.member_id, d.quantity, d.amount);
  }
  db.prepare(`UPDATE bookings SET status = 'verteilt' WHERE id = ?`).run(booking.id);
  res.json({ message: 'Buchung verteilt' });
});

export default router;
