import { Router, Response } from 'express';
import QRCode from 'qrcode';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM drinks ORDER BY category, name').all();
  res.json(rows);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const drink = db.prepare('SELECT * FROM drinks WHERE id = ?').get(req.params.id);
  if (!drink) { res.status(404).json({ error: 'Getränk nicht gefunden' }); return; }
  res.json(drink);
});

router.get('/:id/qrcode', async (req: AuthRequest, res: Response) => {
  const drink = db.prepare('SELECT * FROM drinks WHERE id = ?').get(req.params.id) as any;
  if (!drink) { res.status(404).json({ error: 'Getränk nicht gefunden' }); return; }
  const url = `${process.env.APP_URL || 'http://localhost:5173'}/book?item=${drink.id}`;
  const qr = await QRCode.toDataURL(url);
  res.json({ qr_code: qr, url });
});

router.post('/', requireRole('admin', 'thekenwart', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const { article_number, name, category, price, purchase_price, stock, min_stock, unit, deposit, vat_rate } = req.body;
  if (!article_number || !name || !category || price == null) {
    res.status(400).json({ error: 'Pflichtfelder fehlen' }); return;
  }
  try {
    const result = db.prepare(`
      INSERT INTO drinks (article_number, name, category, price, purchase_price, stock, min_stock, unit, deposit, vat_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(article_number, name, category, price, purchase_price || null, stock || 0, min_stock || 5, unit || 'Flasche', deposit || 0, vat_rate || 19.0);
    res.json({ id: result.lastInsertRowid, message: 'Getränk angelegt' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireRole('admin', 'thekenwart', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const drink = db.prepare('SELECT * FROM drinks WHERE id = ?').get(req.params.id) as any;
  if (!drink) { res.status(404).json({ error: 'Getränk nicht gefunden' }); return; }
  const { name, category, price, purchase_price, stock, min_stock, unit, active, deposit, vat_rate } = req.body;
  db.prepare(`
    UPDATE drinks SET name=?, category=?, price=?, purchase_price=?, stock=?, min_stock=?, unit=?, active=?, deposit=?, vat_rate=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name ?? drink.name, category ?? drink.category, price ?? drink.price, purchase_price ?? drink.purchase_price, stock ?? drink.stock, min_stock ?? drink.min_stock, unit ?? drink.unit, active ?? drink.active, deposit ?? drink.deposit, vat_rate ?? drink.vat_rate, req.params.id);
  res.json({ message: 'Getränk aktualisiert' });
});

export default router;
