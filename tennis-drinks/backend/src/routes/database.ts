import { Router, Response } from 'express';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin'));

// Hilfsfunktion: Alle echten Tabellennamen laden
function getTableNames(): string[] {
  const rows = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as { name: string }[];
  return rows.map(r => r.name);
}

// Hilfsfunktion: Tabellennamen validieren (SQL-Injection verhindern)
function isValidTable(name: string): boolean {
  return getTableNames().includes(name);
}

// Hilfsfunktion: Spalten einer Tabelle laden
interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

function getColumns(tableName: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info("${tableName}")`).all() as ColumnInfo[];
}

// Hilfsfunktion: Audit-Log schreiben
function auditLog(
  entityType: string,
  entityId: number,
  action: string,
  oldValue: string | null,
  newValue: string | null,
  userId: number
) {
  db.prepare(
    `INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(entityType, entityId, action, oldValue, newValue, userId);
}

// Kritische Tabellen, die eine Bestätigung zum Löschen erfordern
const CRITICAL_TABLES = ['members', 'bookings', 'drinks', 'billings', 'groups'];

// ============================================================
// GET /api/database/tables – Alle Tabellen mit Zeilenanzahl
// ============================================================
router.get('/tables', (_req: AuthRequest, res: Response) => {
  try {
    const names = getTableNames();
    const tables = names.map(name => {
      const row = db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get() as { count: number };
      return { name, rowCount: row.count };
    });
    res.json(tables);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Tabellen konnten nicht geladen werden: ' + msg });
  }
});

// ============================================================
// GET /api/database/tables/:name – Tabellen-Schema (Spalten, Typen)
// ============================================================
router.get('/tables/:name', (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  if (!isValidTable(name)) {
    res.status(404).json({ error: `Tabelle "${name}" existiert nicht.` });
    return;
  }
  try {
    const columns = getColumns(name);
    res.json({ name, columns });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Schema konnte nicht geladen werden: ' + msg });
  }
});

// ============================================================
// GET /api/database/tables/:name/data – Paginierte Daten
// ============================================================
router.get('/tables/:name/data', (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  if (!isValidTable(name)) {
    res.status(404).json({ error: `Tabelle "${name}" existiert nicht.` });
    return;
  }

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const search = (req.query.search as string || '').trim();
    const sortCol = (req.query.sort as string || '').trim();
    const order = (req.query.order as string || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const columns = getColumns(name);
    const colNames = columns.map(c => c.name);

    // Sortierung validieren
    let orderClause = '';
    if (sortCol && colNames.includes(sortCol)) {
      orderClause = ` ORDER BY "${sortCol}" ${order}`;
    }

    // Suche über alle TEXT-Spalten
    let whereClause = '';
    const params: string[] = [];
    if (search) {
      const textCols = columns.filter(c =>
        c.type.toUpperCase().includes('TEXT') || c.type === '' || c.type.toUpperCase().includes('VARCHAR')
      );
      if (textCols.length > 0) {
        const conditions = textCols.map(c => `"${c.name}" LIKE ?`);
        whereClause = ' WHERE ' + conditions.join(' OR ');
        for (let i = 0; i < textCols.length; i++) {
          params.push(`%${search}%`);
        }
      }
    }

    // Gesamtanzahl
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM "${name}"${whereClause}`).get(...params) as { total: number };
    const total = countRow.total;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const rows = db.prepare(
      `SELECT * FROM "${name}"${whereClause}${orderClause} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({ rows, total, page, totalPages, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Daten konnten nicht geladen werden: ' + msg });
  }
});

// ============================================================
// PUT /api/database/tables/:name/data/:id – Zeile aktualisieren
// ============================================================
router.put('/tables/:name/data/:id', (req: AuthRequest, res: Response) => {
  const { name, id } = req.params;
  if (!isValidTable(name)) {
    res.status(404).json({ error: `Tabelle "${name}" existiert nicht.` });
    return;
  }

  try {
    const columns = getColumns(name);
    const colNames = columns.map(c => c.name);
    const pkCol = columns.find(c => c.pk === 1);
    if (!pkCol) {
      res.status(400).json({ error: 'Tabelle hat keinen Primärschlüssel.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      res.status(400).json({ error: 'Keine Daten zum Aktualisieren übergeben.' });
      return;
    }

    // Spaltennamen validieren
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [col, val] of Object.entries(body)) {
      if (!colNames.includes(col)) {
        res.status(400).json({ error: `Spalte "${col}" existiert nicht in Tabelle "${name}".` });
        return;
      }
      if (col === pkCol.name) continue; // PK nicht ändern
      updates.push(`"${col}" = ?`);
      values.push(val);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'Keine gültigen Spalten zum Aktualisieren.' });
      return;
    }

    // Alten Wert für Audit laden
    const oldRow = db.prepare(`SELECT * FROM "${name}" WHERE "${pkCol.name}" = ?`).get(id);
    if (!oldRow) {
      res.status(404).json({ error: `Datensatz mit ID ${id} nicht gefunden.` });
      return;
    }

    values.push(id);
    db.prepare(`UPDATE "${name}" SET ${updates.join(', ')} WHERE "${pkCol.name}" = ?`).run(...values);

    const newRow = db.prepare(`SELECT * FROM "${name}" WHERE "${pkCol.name}" = ?`).get(id);

    // Audit-Log
    auditLog(
      `db_explorer:${name}`,
      parseInt(id),
      'UPDATE',
      JSON.stringify(oldRow),
      JSON.stringify(newRow),
      req.user!.id
    );

    res.json({ message: 'Datensatz aktualisiert.', row: newRow });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Aktualisierung fehlgeschlagen: ' + msg });
  }
});

// ============================================================
// POST /api/database/tables/:name/data – Neue Zeile einfügen
// ============================================================
router.post('/tables/:name/data', (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  if (!isValidTable(name)) {
    res.status(404).json({ error: `Tabelle "${name}" existiert nicht.` });
    return;
  }

  try {
    const columns = getColumns(name);
    const colNames = columns.map(c => c.name);

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      res.status(400).json({ error: 'Keine Daten zum Einfügen übergeben.' });
      return;
    }

    const insertCols: string[] = [];
    const placeholders: string[] = [];
    const values: unknown[] = [];

    for (const [col, val] of Object.entries(body)) {
      if (!colNames.includes(col)) {
        res.status(400).json({ error: `Spalte "${col}" existiert nicht in Tabelle "${name}".` });
        return;
      }
      insertCols.push(`"${col}"`);
      placeholders.push('?');
      values.push(val);
    }

    const result = db.prepare(
      `INSERT INTO "${name}" (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`
    ).run(...values);

    const newId = result.lastInsertRowid;
    const newRow = db.prepare(`SELECT * FROM "${name}" WHERE rowid = ?`).get(newId);

    // Audit-Log
    auditLog(
      `db_explorer:${name}`,
      Number(newId),
      'INSERT',
      null,
      JSON.stringify(newRow),
      req.user!.id
    );

    res.json({ message: 'Datensatz erstellt.', row: newRow, id: newId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Einfügen fehlgeschlagen: ' + msg });
  }
});

// ============================================================
// DELETE /api/database/tables/:name/data/:id – Zeile löschen
// ============================================================
router.delete('/tables/:name/data/:id', (req: AuthRequest, res: Response) => {
  const { name, id } = req.params;
  if (!isValidTable(name)) {
    res.status(404).json({ error: `Tabelle "${name}" existiert nicht.` });
    return;
  }

  try {
    // Sicherheitsprüfung für kritische Tabellen
    if (CRITICAL_TABLES.includes(name)) {
      const confirm = req.body?.confirm;
      if (confirm !== true) {
        res.status(400).json({
          error: `Löschen in "${name}" erfordert eine Bestätigung. Sende { "confirm": true } im Body.`,
          requireConfirm: true,
        });
        return;
      }
    }

    const columns = getColumns(name);
    const pkCol = columns.find(c => c.pk === 1);
    if (!pkCol) {
      res.status(400).json({ error: 'Tabelle hat keinen Primärschlüssel.' });
      return;
    }

    // Alten Wert für Audit laden
    const oldRow = db.prepare(`SELECT * FROM "${name}" WHERE "${pkCol.name}" = ?`).get(id);
    if (!oldRow) {
      res.status(404).json({ error: `Datensatz mit ID ${id} nicht gefunden.` });
      return;
    }

    db.prepare(`DELETE FROM "${name}" WHERE "${pkCol.name}" = ?`).run(id);

    // Audit-Log
    auditLog(
      `db_explorer:${name}`,
      parseInt(id),
      'DELETE',
      JSON.stringify(oldRow),
      null,
      req.user!.id
    );

    res.json({ message: 'Datensatz gelöscht.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen: ' + msg });
  }
});

export default router;
