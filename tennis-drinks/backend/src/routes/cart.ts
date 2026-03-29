import { Router, Response } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import db from '../db/schema'

const router = Router()
router.use(authenticate)

// GET /api/cart/all – Alle offenen Warenkörbe (Admin/Kassenwart/Thekenwart)
router.get('/all', requireRole('admin', 'kassenwart', 'thekenwart'), (_req: AuthRequest, res: Response) => {
  // Single-Query: alle Cart-Items mit Member + Drink Infos
  const allItems = db.prepare(`
    SELECT ci.member_id, ci.drink_id, ci.quantity, ci.updated_at,
           m.first_name || ' ' || m.last_name AS member_name,
           m.member_number,
           d.name, d.price, d.category, d.unit
    FROM cart_items ci
    JOIN members m ON m.id = ci.member_id
    JOIN drinks d ON d.id = ci.drink_id
    ORDER BY ci.updated_at DESC
  `).all() as any[]

  // Gruppieren nach member_id
  const grouped = new Map<number, any>()
  for (const item of allItems) {
    if (!grouped.has(item.member_id)) {
      grouped.set(item.member_id, {
        member_id: item.member_id,
        member_name: item.member_name,
        member_number: item.member_number,
        item_count: 0,
        total_price: 0,
        last_updated: item.updated_at,
        items: [],
      })
    }
    const g = grouped.get(item.member_id)!
    g.items.push({ drink_id: item.drink_id, quantity: item.quantity, updated_at: item.updated_at, name: item.name, price: item.price, category: item.category, unit: item.unit })
    g.item_count += 1
    g.total_price += item.quantity * item.price
    if (item.updated_at > g.last_updated) g.last_updated = item.updated_at
  }

  res.json(Array.from(grouped.values()))
})

// GET /api/cart/daily-spending – Heutige Ausgaben + Tageslimit des eingeloggten Nutzers
router.get('/daily-spending', (req: AuthRequest, res: Response) => {
  const memberId = req.user!.id
  const spending = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as today_total
    FROM bookings
    WHERE member_id = ? AND cancelled = 0 AND date(created_at) = date('now')
  `).get(memberId) as any
  const member = db.prepare('SELECT daily_limit FROM members WHERE id = ?').get(memberId) as any
  res.json({
    today_total: spending?.today_total || 0,
    daily_limit: member?.daily_limit ?? null,
  })
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
