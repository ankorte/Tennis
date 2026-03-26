import { Router, Response } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import db from '../db/schema'

const router = Router()
router.use(authenticate)

// GET /api/cart/all – Alle offenen Warenkörbe (Admin/Kassenwart/Thekenwart)
router.get('/all', requireRole('admin', 'kassenwart', 'thekenwart'), (_req: AuthRequest, res: Response) => {
  const members = db.prepare(`
    SELECT ci.member_id,
           m.first_name || ' ' || m.last_name AS member_name,
           m.member_number,
           COUNT(ci.id) AS item_count,
           SUM(ci.quantity * d.price) AS total_price,
           MAX(ci.updated_at) AS last_updated
    FROM cart_items ci
    JOIN members m ON m.id = ci.member_id
    JOIN drinks d ON d.id = ci.drink_id
    GROUP BY ci.member_id
    ORDER BY last_updated DESC
  `).all()

  const result = (members as any[]).map(m => {
    const items = db.prepare(`
      SELECT ci.drink_id, ci.quantity, ci.updated_at,
             d.name, d.price, d.category, d.unit
      FROM cart_items ci
      JOIN drinks d ON d.id = ci.drink_id
      WHERE ci.member_id = ?
      ORDER BY ci.updated_at DESC
    `).all(m.member_id)
    return { ...m, items }
  })

  res.json(result)
})

// GET /api/cart – Warenkorb des eingeloggten Nutzers laden
router.get('/', (req: AuthRequest, res: Response) => {
  const items = db.prepare(`
    SELECT ci.drink_id, ci.quantity,
           d.name, d.price, d.category, d.stock, d.unit,
           d.article_number, d.active
    FROM cart_items ci
    JOIN drinks d ON d.id = ci.drink_id
    WHERE ci.member_id = ?
    ORDER BY ci.updated_at DESC
  `).all(req.user!.id)
  res.json(items)
})

// PUT /api/cart – Warenkorb komplett ersetzen
// Body: { items: [{ drink_id: number, quantity: number }] }
router.put('/', (req: AuthRequest, res: Response) => {
  const { items } = req.body as { items: { drink_id: number; quantity: number }[] }
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items muss ein Array sein' })

  const memberId = req.user!.id
  const del = db.prepare('DELETE FROM cart_items WHERE member_id = ?')
  const ins = db.prepare(`
    INSERT INTO cart_items (member_id, drink_id, quantity, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `)

  db.transaction(() => {
    del.run(memberId)
    for (const item of items) {
      if (item.quantity > 0) ins.run(memberId, item.drink_id, item.quantity)
    }
  })()

  res.json({ ok: true })
})

// DELETE /api/cart – Warenkorb leeren
router.delete('/', (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM cart_items WHERE member_id = ?').run(req.user!.id)
  res.json({ ok: true })
})

export default router
