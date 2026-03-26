import { Router, Response } from 'express';
import XLSX from 'xlsx';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/run', requireRole('admin','kassenwart'), (req: AuthRequest, res: Response) => {
  const { period_from, period_to } = req.body;
  if (!period_from || !period_to) { res.status(400).json({ error: 'Zeitraum fehlt' }); return; }

  const members = db.prepare('SELECT id FROM members WHERE active = 1').all() as any[];
  const results = [];

  for (const m of members) {
    const direct = db.prepare(`
      SELECT COALESCE(SUM(total_price),0) as total FROM bookings
      WHERE member_id = ? AND cancelled = 0 AND status = 'bestaetigt'
      AND created_at BETWEEN ? AND ?
    `).get(m.id, period_from, period_to + ' 23:59:59') as any;

    const distributed = db.prepare(`
      SELECT COALESCE(SUM(d.amount),0) as total FROM distributions d
      JOIN bookings b ON b.id = d.booking_id
      WHERE d.member_id = ? AND b.cancelled = 0 AND b.created_at BETWEEN ? AND ?
    `).get(m.id, period_from, period_to + ' 23:59:59') as any;

    const total = parseFloat(((direct?.total || 0) + (distributed?.total || 0)).toFixed(2));
    if (total > 0) {
      const existing = db.prepare('SELECT id FROM billings WHERE member_id = ? AND period_from = ? AND period_to = ?').get(m.id, period_from, period_to) as any;
      if (existing) {
        db.prepare('UPDATE billings SET total_amount = ? WHERE id = ?').run(total, existing.id);
        results.push({ member_id: m.id, billing_id: existing.id, total });
      } else {
        const r = db.prepare('INSERT INTO billings (period_from, period_to, member_id, total_amount) VALUES (?, ?, ?, ?)').run(period_from, period_to, m.id, total);
        results.push({ member_id: m.id, billing_id: r.lastInsertRowid, total });
      }
    }
  }
  res.json({ message: 'Abrechnung erstellt', count: results.length, results });
});

router.get('/', requireRole('admin','kassenwart'), (req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT b.*, m.first_name || ' ' || m.last_name as member_name, m.member_number
    FROM billings b JOIN members m ON m.id = b.member_id
    ORDER BY b.created_at DESC
  `).all();
  res.json(rows);
});

router.put('/:id/status', requireRole('admin','kassenwart'), (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  db.prepare('UPDATE billings SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status aktualisiert' });
});

router.get('/export/csv', requireRole('admin','kassenwart'), (req: AuthRequest, res: Response) => {
  const { period_from, period_to } = req.query as any;
  let query = `
    SELECT m.member_number, m.first_name, m.last_name, m.email,
           b.period_from, b.period_to, b.total_amount, b.status
    FROM billings b JOIN members m ON m.id = b.member_id
  `;
  const params: any[] = [];
  if (period_from && period_to) {
    query += ' WHERE b.period_from = ? AND b.period_to = ?';
    params.push(period_from, period_to);
  }
  const rows = db.prepare(query).all(...params) as any[];
  const header = 'Mitgliedsnr;Vorname;Nachname;Email;Zeitraum_von;Zeitraum_bis;Betrag;Status\n';
  const csv = header + rows.map((r: any) => `${r.member_number};${r.first_name};${r.last_name};${r.email};${r.period_from};${r.period_to};${r.total_amount.toFixed(2)};${r.status}`).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="abrechnung.csv"');
  res.send('\uFEFF' + csv);
});

// Excel-Export (XLSX)
router.get('/export/xlsx', requireRole('admin','kassenwart'), (req: AuthRequest, res: Response) => {
  const { period_from, period_to } = req.query as any;
  let query = `
    SELECT m.member_number as Mitgliedsnr, m.first_name as Vorname, m.last_name as Nachname,
           m.email as Email, b.period_from as Zeitraum_von, b.period_to as Zeitraum_bis,
           b.total_amount as Betrag, b.status as Status
    FROM billings b JOIN members m ON m.id = b.member_id
  `;
  const params: any[] = [];
  if (period_from && period_to) {
    query += ' WHERE b.period_from = ? AND b.period_to = ?';
    params.push(period_from, period_to);
  }
  query += ' ORDER BY m.last_name, m.first_name';
  const rows = db.prepare(query).all(...params) as any[];

  const ws = XLSX.utils.json_to_sheet(rows);

  // Spaltenbreiten setzen
  ws['!cols'] = [
    { wch: 12 }, // Mitgliedsnr
    { wch: 15 }, // Vorname
    { wch: 15 }, // Nachname
    { wch: 25 }, // Email
    { wch: 12 }, // Von
    { wch: 12 }, // Bis
    { wch: 10 }, // Betrag
    { wch: 18 }, // Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abrechnung');

  // Zusammenfassung als zweites Sheet
  const totalAmount = rows.reduce((s, r) => s + (r.Betrag || 0), 0);
  const openAmount = rows.filter(r => r.Status === 'offen').reduce((s, r) => s + (r.Betrag || 0), 0);
  const summaryData = [
    { Info: 'Zeitraum', Wert: period_from && period_to ? `${period_from} bis ${period_to}` : 'Alle' },
    { Info: 'Anzahl Mitglieder', Wert: rows.length },
    { Info: 'Gesamtbetrag', Wert: totalAmount.toFixed(2) + ' €' },
    { Info: 'Davon offen', Wert: openAmount.toFixed(2) + ' €' },
    { Info: 'Erstellt am', Wert: new Date().toLocaleDateString('de-DE') + ' ' + new Date().toLocaleTimeString('de-DE') },
  ];
  const ws2 = XLSX.utils.json_to_sheet(summaryData);
  ws2['!cols'] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Zusammenfassung');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = period_from && period_to
    ? `abrechnung-${period_from}-bis-${period_to}.xlsx`
    : 'abrechnung-gesamt.xlsx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});

router.get('/dashboard', requireRole('admin','kassenwart','thekenwart'), (req: AuthRequest, res: Response) => {
  const topDrinks = db.prepare(`
    SELECT d.name, d.category, SUM(b.quantity) as total_qty, SUM(b.total_price) as total_revenue
    FROM bookings b JOIN drinks d ON d.id = b.drink_id
    WHERE b.cancelled = 0 GROUP BY b.drink_id ORDER BY total_qty DESC LIMIT 10
  `).all();
  const openAmount = db.prepare(`SELECT COALESCE(SUM(total_amount),0) as total FROM billings WHERE status = 'offen'`).get() as any;
  const openGroupBookings = db.prepare(`SELECT COUNT(*) as count FROM bookings WHERE status = 'offen_gruppe' AND cancelled = 0`).get() as any;
  const lowStock = db.prepare(`SELECT COUNT(*) as count FROM drinks WHERE stock <= min_stock AND active = 1`).get() as any;
  const totalMembers = db.prepare(`SELECT COUNT(*) as count FROM members WHERE active = 1`).get() as any;
  res.json({ topDrinks, openAmount: openAmount?.total || 0, openGroupBookings: openGroupBookings?.count || 0, lowStock: lowStock?.count || 0, totalMembers: totalMembers?.count || 0 });
});

export default router;
