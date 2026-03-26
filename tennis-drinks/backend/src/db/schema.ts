import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/tennis.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

export function initializeDatabase(): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_number TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'aktiv' CHECK(status IN ('aktiv','inaktiv','gast','jugend','trainer')),
      role TEXT NOT NULL DEFAULT 'mitglied' CHECK(role IN ('mitglied','thekenwart','kassenwart','admin')),
      pin_hash TEXT NOT NULL,
      team TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(first_name, last_name)
    );

    CREATE TABLE IF NOT EXISTS drinks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('bier','softdrinks','wasser','wein_sekt','kaffee','sonstiges')),
      price REAL NOT NULL,
      purchase_price REAL,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      unit TEXT NOT NULL DEFAULT 'Flasche',
      active INTEGER NOT NULL DEFAULT 1,
      qr_code TEXT,
      deposit REAL DEFAULT 0,
      vat_rate REAL DEFAULT 19.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      group_type TEXT NOT NULL DEFAULT 'spontan' CHECK(group_type IN ('spontan','mannschaft','event','sonstiges')),
      event_date TEXT,
      created_by INTEGER NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'offen' CHECK(status IN ('offen','in_verteilung','abgeschlossen','storniert')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id),
      member_id INTEGER NOT NULL REFERENCES members(id),
      PRIMARY KEY (group_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drink_id INTEGER NOT NULL REFERENCES drinks(id),
      member_id INTEGER REFERENCES members(id),
      group_id INTEGER REFERENCES groups(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      booking_type TEXT NOT NULL DEFAULT 'einzeln' CHECK(booking_type IN ('einzeln','gruppe','gast','manuell','admin')),
      status TEXT NOT NULL DEFAULT 'bestaetigt' CHECK(status IN ('neu','bestaetigt','offen_gruppe','verteilt','storniert','abgerechnet')),
      guest_note TEXT,
      created_by INTEGER NOT NULL REFERENCES members(id),
      cancelled INTEGER NOT NULL DEFAULT 0,
      cancel_ref INTEGER REFERENCES bookings(id),
      billing_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id),
      member_id INTEGER NOT NULL REFERENCES members(id),
      quantity REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drink_id INTEGER NOT NULL REFERENCES drinks(id),
      movement_type TEXT NOT NULL CHECK(movement_type IN ('verbrauch','wareneingang','korrektur','inventur','storno')),
      quantity INTEGER NOT NULL,
      comment TEXT,
      created_by INTEGER NOT NULL REFERENCES members(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS billings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_from TEXT NOT NULL,
      period_to TEXT NOT NULL,
      member_id INTEGER NOT NULL REFERENCES members(id),
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'offen' CHECK(status IN ('offen','erstellt','bezahlt','teilweise_bezahlt')),
      exported_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_by INTEGER REFERENCES members(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      drink_id INTEGER NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(member_id, drink_id)
    );
  `);

  // SEPA-Einstellungen (Key-Value)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations – add columns that may not exist yet
  try { db.exec(`ALTER TABLE groups ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0`) } catch {}
  // SEPA-Felder für Mitglieder
  try { db.exec(`ALTER TABLE members ADD COLUMN iban TEXT`) } catch {}
  try { db.exec(`ALTER TABLE members ADD COLUMN bic TEXT`) } catch {}
  try { db.exec(`ALTER TABLE members ADD COLUMN mandate_ref TEXT`) } catch {}
  try { db.exec(`ALTER TABLE members ADD COLUMN mandate_date TEXT`) } catch {}

  // Migration: Login per Vorname+Nachname statt E-Mail
  // - Email UNIQUE entfernen (erlaubt doppelte E-Mails)
  // - UNIQUE Index auf (first_name, last_name) anlegen
  try {
    const tableSql = (db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='members'`).get() as any)?.sql || '';
    const needsEmailMigration = /email\s+TEXT[^,]*UNIQUE/i.test(tableSql);

    if (needsEmailMigration) {
      console.log('Migration: Entferne UNIQUE constraint von email...');
      console.log('Aktuelle Tabelle:', tableSql);

      // Vorhandene Spalten der alten Tabelle ermitteln
      const colInfo = db.prepare(`PRAGMA table_info(members)`).all() as any[];
      const oldCols = colInfo.map((c: any) => c.name);
      console.log('Vorhandene Spalten:', oldCols.join(', '));

      // Neue Tabelle hat diese Spalten
      const allNewCols = ['id', 'member_number', 'first_name', 'last_name', 'email', 'phone', 'status', 'role', 'pin_hash', 'team', 'active', 'created_at', 'updated_at', 'iban', 'bic', 'mandate_ref', 'mandate_date'];

      // Nur Spalten kopieren die in der alten Tabelle existieren
      const colsToCopy = allNewCols.filter(c => oldCols.includes(c));
      // Für fehlende Spalten: NULL einfügen
      const selectParts = allNewCols.map(c => colsToCopy.includes(c) ? c : `NULL as ${c}`);

      db.exec(`PRAGMA foreign_keys = OFF`);
      db.exec(`BEGIN TRANSACTION`);
      db.exec(`ALTER TABLE members RENAME TO members_old`);
      db.exec(`
        CREATE TABLE members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_number TEXT UNIQUE NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          status TEXT NOT NULL DEFAULT 'aktiv' CHECK(status IN ('aktiv','inaktiv','gast','jugend','trainer')),
          role TEXT NOT NULL DEFAULT 'mitglied' CHECK(role IN ('mitglied','thekenwart','kassenwart','admin')),
          pin_hash TEXT NOT NULL,
          team TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          iban TEXT,
          bic TEXT,
          mandate_ref TEXT,
          mandate_date TEXT
        )
      `);
      db.exec(`INSERT INTO members (${allNewCols.join(', ')}) SELECT ${selectParts.join(', ')} FROM members_old`);
      db.exec(`DROP TABLE members_old`);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_name ON members(first_name, last_name)`);
      db.exec(`COMMIT`);
      db.exec(`PRAGMA foreign_keys = ON`);
      console.log('Migration: Email UNIQUE entfernt, Name UNIQUE hinzugefügt.');
    } else {
      // Kein Table-Rebuild nötig, nur Index sicherstellen
      try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_name ON members(first_name, last_name)`) } catch {}
    }
  } catch (e) {
    console.error('Email-UNIQUE Migration FEHLER:', e);
    try { db.exec(`ROLLBACK`) } catch {}
    try { db.exec(`PRAGMA foreign_keys = ON`) } catch {}
  }

  // Seed admin user if not exists
  const admin = db.prepare('SELECT id FROM members WHERE role = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('1234', 10);
    db.prepare(`
      INSERT INTO members (member_number, first_name, last_name, email, role, pin_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('M001', 'Admin', 'Tennisclub', 'admin@tennisclub.de', 'admin', hash, 'aktiv');

    // Seed sample drinks
    const drinks = [
      ['D001', 'Cola', 'softdrinks', 2.50, 1.20, 24, 6, 'Dose'],
      ['D002', 'Fanta', 'softdrinks', 2.50, 1.20, 18, 6, 'Dose'],
      ['D003', 'Wasser still', 'wasser', 1.50, 0.50, 30, 12, 'Flasche'],
      ['D004', 'Wasser sprudel', 'wasser', 1.50, 0.50, 30, 12, 'Flasche'],
      ['D005', 'Weizen', 'bier', 3.00, 1.20, 20, 6, 'Flasche'],
      ['D006', 'Pils', 'bier', 2.80, 1.10, 24, 6, 'Flasche'],
      ['D007', 'Kaffee', 'kaffee', 2.00, 0.30, 50, 10, 'Tasse'],
      ['D008', 'Apfelsaft', 'softdrinks', 2.00, 0.80, 15, 6, 'Flasche'],
    ];
    const insertDrink = db.prepare(`
      INSERT INTO drinks (article_number, name, category, price, purchase_price, stock, min_stock, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of drinks) insertDrink.run(...d);

    // Seed sample members
    const members = [
      ['M002', 'Max', 'Mustermann', 'max@example.de', 'mitglied', bcrypt.hashSync('1234', 10), 'Herren 40'],
      ['M003', 'Maria', 'Muster', 'maria@example.de', 'mitglied', bcrypt.hashSync('1234', 10), 'Damen'],
      ['M004', 'Thomas', 'Theke', 'thomas@example.de', 'thekenwart', bcrypt.hashSync('1234', 10), null],
      ['M005', 'Karl', 'Kasse', 'karl@example.de', 'kassenwart', bcrypt.hashSync('1234', 10), null],
    ];
    const insertMember = db.prepare(`
      INSERT INTO members (member_number, first_name, last_name, email, role, pin_hash, team)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of members) insertMember.run(...m);
  }
}

export default db;
