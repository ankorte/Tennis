import { Router, Response } from 'express';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const isStaff = ['admin', 'kassenwart', 'thekenwart'].includes(req.user!.role);
  // Normal members only see groups they created themselves
  const groups = isStaff
    ? db.prepare(`
        SELECT g.*, m.first_name || ' ' || m.last_name as created_by_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.group_id = g.id AND b.cancelled = 0) as booking_count
        FROM groups g JOIN members m ON m.id = g.created_by ORDER BY g.created_at DESC
      `).all()
    : db.prepare(`
        SELECT g.*, m.first_name || ' ' || m.last_name as created_by_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.group_id = g.id AND b.cancelled = 0) as booking_count
        FROM groups g JOIN members m ON m.id = g.created_by
        WHERE g.created_by = ? ORDER BY g.created_at DESC
      `).all(req.user!.id);
  res.json(groups);
});

// Groups where the current user is a member AND there are pending distributions
// Must be defined BEFORE /:id to avoid route conflict
router.get('/pending-distributions', (req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT g.id, g.name, g.status,
      COUNT(b.id) as pending_count,
      COALESCE(SUM(b.total_price), 0) as pending_amount
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    JOIN bookings b ON b.group_id = g.id AND b.status = 'offen_gruppe' AND b.cancelled = 0
    WHERE gm.member_id = ?
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all(req.user!.id);
  res.json(rows);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as any;
  if (!group) { res.status(404).json({ error: 'Gruppe nicht gefunden' }); return; }
  const isStaff = ['admin', 'kassenwart', 'thekenwart'].includes(req.user!.role);
  if (!isStaff && group.created_by !== req.user!.id) {
    res.status(403).json({ error: 'Kein Zugriff auf diese Gruppe' }); return;
  }
  const members = db.prepare(`SELECT m.id, m.first_name, m.last_name, m.member_number FROM group_members gm JOIN members m ON m.id = gm.member_id WHERE gm.group_id = ?`).all(req.params.id);
  const bookings = db.prepare(`SELECT b.*, d.name as drink_name FROM bookings b JOIN drinks d ON d.id = b.drink_id WHERE b.group_id = ? AND b.cancelled = 0`).all(req.params.id);
  res.json({ ...group, members, bookings });
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { name, group_type, event_date, member_ids, is_template } = req.body;
  if (!name) { res.status(400).json({ error: 'Name fehlt' }); return; }
  const result = db.prepare(`INSERT INTO groups (name, group_type, event_date, created_by, is_template) VALUES (?, ?, ?, ?, ?)`).run(name, group_type || 'spontan', event_date || null, req.user!.id, is_template ? 1 : 0);
  const groupId = result.lastInsertRowid;
  if (Array.isArray(member_ids)) {
    const insert = db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)');
    for (const mid of member_ids) insert.run(groupId, mid);
  }
  db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)').run(groupId, req.user!.id);
  res.json({ id: groupId, message: 'Gruppe angelegt' });
});

// Update group metadata (name, type, is_template)
router.put('/:id', requireRole('admin', 'kassenwart', 'thekenwart'), (req: AuthRequest, res: Response) => {
  const { name, group_type, is_template } = req.body;
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as any;
  if (!group) { res.status(404).json({ error: 'Gruppe nicht gefunden' }); return; }
  db.prepare(`UPDATE groups SET name=?, group_type=?, is_template=? WHERE id=?`)
    .run(name ?? group.name, group_type ?? group.group_type, is_template !== undefined ? (is_template ? 1 : 0) : group.is_template, req.params.id);
  res.json({ message: 'Gruppe aktualisiert' });
});

// Update group members
router.put('/:id/members', (req: AuthRequest, res: Response) => {
  const { member_ids } = req.body;
  if (!Array.isArray(member_ids)) { res.status(400).json({ error: 'member_ids fehlt' }); return; }
  db.prepare('DELETE FROM group_members WHERE group_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)');
  for (const mid of member_ids) insert.run(req.params.id, mid);
  res.json({ message: 'Mitglieder aktualisiert' });
});

// Reopen a closed group – creates a NEW group with same members, appends timestamp to name
// Allowed for staff OR for the original creator
router.put('/:id/reopen', (req: AuthRequest, res: Response) => {
  const groupId = req.params.id;
  const oldGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any;
  if (!oldGroup) { res.status(404).json({ error: 'Gruppe nicht gefunden' }); return; }
  const isStaff = ['admin', 'kassenwart', 'thekenwart'].includes(req.user!.role);
  if (!isStaff && oldGroup.created_by !== req.user!.id) {
    res.status(403).json({ error: 'Kein Zugriff' }); return;
  }

  // Build German timestamp: "20.03.2026 14:35"
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const newName = `${oldGroup.name} (${ts})`;

  const createGroup = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO groups (name, group_type, created_by, is_template) VALUES (?, ?, ?, ?)`
    ).run(newName, oldGroup.group_type, req.user!.id, oldGroup.is_template);
    const newGroupId = result.lastInsertRowid;

    // Copy all members from old group
    const members = db.prepare('SELECT member_id FROM group_members WHERE group_id = ?').all(groupId) as any[];
    const insertMember = db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)');
    for (const m of members) insertMember.run(newGroupId, m.member_id);

    return newGroupId;
  });

  const newGroupId = createGroup();
  res.json({ message: 'Neue Gruppe erstellt', new_group_id: newGroupId, name: newName });
});

router.put('/:id/close', (req: AuthRequest, res: Response) => {
  db.prepare(`UPDATE groups SET status = 'abgeschlossen' WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Gruppe abgeschlossen' });
});

// Delete group – admin only; cancels open bookings (restores stock), then removes group
router.delete('/:id', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const groupId = req.params.id;
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any;
  if (!group) { res.status(404).json({ error: 'Gruppe nicht gefunden' }); return; }

  const bookings = db.prepare('SELECT * FROM bookings WHERE group_id = ? AND cancelled = 0').all(groupId) as any[];

  db.transaction(() => {
    for (const b of bookings) {
      db.prepare('DELETE FROM distributions WHERE booking_id = ?').run(b.id);
      db.prepare(`UPDATE bookings SET cancelled = 1, status = 'storniert' WHERE id = ?`).run(b.id);
    }
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
  })();

  res.json({ message: 'Gruppe gelöscht', cancelledBookings: bookings.length });
});

export default router;
