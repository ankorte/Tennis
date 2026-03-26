import { Router, Response } from 'express';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/movements', requireRole('admin','kassenwart','thekenwart'), (req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT im.*, d.name as drink_name, m.first_name || ' ' || m.last_name as created_by_name
    FROM inventory_movements im
    JOIN drinks d ON d.id = im.drink_id
    JOIN members m ON m.id = im.created_by
    ORDER BY im.created_at DESC LIMIT 200
  `).all();
  res.json(rows);
});

router.post('/incoming', requireRole('admin','kassenwart','thekenwart'), (req: AuthRequest, res: Response) => {
  const { drink_id, quantity, comment } = req.body;
  if (!drink_id || !quantity) { res.status(400).json({ error: 'Felder fehlen' }); return; }
  const qty = parseInt(quantity);
  db.prepare(`UPDATE drinks SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`).run(qty, drink_id);
  db.prepare(`INSERT INTO inventory_movements (drink_id, movement_type, quantity, comment, created_by) VALUES (?, 'wareneingang', ?, ?, ?)`).run(drink_id, qty, comment || null, req.user!.id);
  res.json({ message: 'Wareneingang erfasst' });
});

router.post('/correction', requireRole('admin','thekenwart'), (req: AuthRequest, res: Response) => {
  const { drink_id, new_stock, comment } = req.body;
  if (!drink_id || new_stock == null) { res.status(400).json({ error: 'Felder fehlen' }); return; }
  const drink = db.prepare('SELECT stock FROM drinks WHERE id = ?').get(drink_id) as any;
  const diff = parseInt(new_stock) - drink.stock;
  db.prepare(`UPDATE drinks SET stock = ?, updated_at = datetime('now') WHERE id = ?`).run(parseInt(new_stock), drink_id);
  db.prepare(`INSERT INTO inventory_movements (drink_id, movement_type, quantity, comment, created_by) VALUES (?, 'korrektur', ?, ?, ?)`).run(drink_id, diff, comment || 'Korrekturbuchung', req.user!.id);
  res.json({ message: 'Korrektur gespeichert' });
});

// Bulk import: update stock for multiple drinks at once (from Excel)
router.post('/import', requireRole('admin', 'kassenwart', 'thekenwart'), (req: AuthRequest, res: Response) => {
  const { items } = req.body; // [{article_number?, name?, new_stock, comment?}]
  if (!Array.isArray(items) || !items.length) { res.status(400).json({ error: 'items fehlt' }); return; }
  const results: any[] = [];
  const updateDrink = db.prepare(`UPDATE drinks SET stock = ?, updated_at = datetime('now') WHERE id = ?`);
  const logMove = db.prepare(`INSERT INTO inventory_movements (drink_id, movement_type, quantity, comment, created_by) VALUES (?, 'korrektur', ?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const item of items) {
      let drink: any = null;
      if (item.article_number) drink = db.prepare('SELECT * FROM drinks WHERE article_number = ?').get(item.article_number);
      if (!drink && item.name) drink = db.prepare('SELECT * FROM drinks WHERE name = ? COLLATE NOCASE').get(item.name);
      if (!drink) { results.push({ ...item, status: 'nicht gefunden' }); continue; }
      const newStock = parseInt(item.new_stock);
      if (isNaN(newStock) || newStock < 0) { results.push({ ...item, status: 'ungültiger Bestand' }); continue; }
      const diff = newStock - drink.stock;
      updateDrink.run(newStock, drink.id);
      logMove.run(drink.id, diff, item.comment || 'Excel-Import', req.user!.id);
      results.push({ id: drink.id, name: drink.name, old_stock: drink.stock, new_stock: newStock, status: 'ok' });
    }
  });
  tx();
  res.json({ results, imported: results.filter(r => r.status === 'ok').length, errors: results.filter(r => r.status !== 'ok').length });
});

router.get('/low-stock', (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT id, name, stock, min_stock, category FROM drinks WHERE stock <= min_stock AND active = 1 ORDER BY stock').all();
  res.json(rows);
});

export default router;
