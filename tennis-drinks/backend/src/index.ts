import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { initializeDatabase } from './db/schema';

// App-Version aus package.json (Root)
let APP_VERSION = '0.0.0';
try {
  const pkgPath = path.join(__dirname, '../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8').replace(/^\uFEFF/, ''));
  APP_VERSION = pkg.version || '0.0.0';
} catch { /* falls nicht gefunden */ }
import authRoutes from './routes/auth';
import memberRoutes from './routes/members';
import drinkRoutes from './routes/drinks';
import bookingRoutes from './routes/bookings';
import groupRoutes from './routes/groups';
import inventoryRoutes from './routes/inventory';
import billingRoutes from './routes/billing';
import cartRoutes from './routes/cart';
import sepaRoutes from './routes/sepa';
import emailRoutes from './routes/email';
import databaseRoutes from './routes/database';

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Security Headers (alle Cross-Origin-Policies deaktiviert für PWA-Kompatibilität)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Trust proxy (Azure App Service sitzt hinter einem Reverse Proxy)
app.set('trust proxy', 1);

// In production: no CORS needed (same origin). In dev: allow Vite dev server.
if (!isProd) app.use(cors());

// JSON Body Parser (multer übernimmt multipart für Restore)
app.use(express.json());

// Rate Limiting: allgemein
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 500, // Max 500 Requests pro Fenster
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen – bitte warte kurz.' },
});
app.use('/api/', apiLimiter);

// Login: strenges Rate Limiting (5 Versuche pro 15 Min.)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Login-Versuche – bitte warte 15 Minuten.' },
});
app.use('/api/auth/login', loginLimiter);

initializeDatabase();

// Version-Endpoint (kein Auth nötig)
app.get('/api/version', (_req, res) => res.json({ version: APP_VERSION }));

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/drinks', drinkRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/sepa', sepaRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/database', databaseRoutes);

// DB-Backup Download (Admin)
import { authenticate, requireRole, AuthRequest } from './middleware/auth';
import db from './db/schema';

app.get('/api/backup', authenticate, requireRole('admin'), (req: AuthRequest, res: any) => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/tennis.db');
  if (!fs.existsSync(dbPath)) { res.status(404).json({ error: 'Datenbank nicht gefunden' }); return; }
  try {
    // WAL-Checkpoint erzwingen, damit alle Daten in der Hauptdatei sind
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) { console.log('WAL checkpoint Warnung:', e); }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="tennis-backup-${timestamp}.db"`);
  res.setHeader('Content-Length', fs.statSync(dbPath).size);
  const stream = fs.createReadStream(dbPath);
  stream.pipe(res);
});

// DB-Backup Restore (Admin) – akzeptiert .db Datei als Binary-Body oder multipart/form-data
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

app.post('/api/backup/restore',
  authenticate,
  requireRole('admin'),
  upload.single('file'),
  (req: AuthRequest, res: any) => {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/tennis.db');

    // Datei aus multer (FormData) oder raw body
    let body: Buffer | undefined;
    if (req.file) {
      body = req.file.buffer;
      console.log(`[Restore] Multer-Upload: ${req.file.originalname}, ${body.length} Bytes`);
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body;
      console.log(`[Restore] Raw-Upload: ${body.length} Bytes`);
    }

    if (!body || body.length < 100) {
      res.status(400).json({ error: `Keine oder zu kleine Datei empfangen (${body?.length ?? 0} Bytes)` });
      return;
    }

    // Prüfen ob es eine SQLite-Datei ist (Magic Bytes: "SQLite format 3\0")
    const header = body.slice(0, 16).toString('ascii');
    if (!header.startsWith('SQLite format 3')) {
      res.status(400).json({ error: 'Ungültige Datei – keine SQLite-Datenbank' });
      return;
    }

    try {
      // 1. Aktuelle DB sichern
      const backupPath = dbPath + '.before-restore.' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`[Restore] Backup der aktuellen DB: ${backupPath}`);
      }

      // 2. Aktuelle DB-Verbindung schließen & WAL-Dateien bereinigen
      try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { console.log('WAL checkpoint Warnung:', e); }
      try { db.close(); } catch (e) { console.log('DB close Warnung:', e); }

      // 3. WAL- und SHM-Dateien löschen (sonst kann die neue DB sie nicht nutzen)
      try { fs.unlinkSync(dbPath + '-wal'); } catch {}
      try { fs.unlinkSync(dbPath + '-shm'); } catch {}

      // 4. Hochgeladene Datei als neue DB schreiben
      fs.writeFileSync(dbPath, body);
      console.log(`[Restore] DB wiederhergestellt: ${body.length} Bytes geschrieben`);

      // 5. Integritätsprüfung
      try {
        const Database = require('better-sqlite3');
        const testDb = new Database(dbPath, { readonly: true });
        const check = testDb.pragma('integrity_check') as any[];
        testDb.close();
        if (check.length > 0 && check[0]?.integrity_check !== 'ok') {
          // DB korrupt – Backup wiederherstellen
          console.error('[Restore] Integritätsprüfung fehlgeschlagen:', check);
          fs.copyFileSync(backupPath, dbPath);
          res.status(400).json({ error: 'Datenbank-Integritätsprüfung fehlgeschlagen. Alte DB wiederhergestellt.' });
          return;
        }
        console.log('[Restore] Integritätsprüfung bestanden');
      } catch (intErr) {
        console.error('[Restore] Integritätsprüfung-Fehler:', intErr);
      }

      // 5. Antwort senden, dann Server neu starten
      res.json({
        message: 'Datenbank wiederhergestellt. Server wird neu gestartet...',
        size: body.length,
        backup: path.basename(backupPath),
      });

      // Kurze Verzögerung damit die Antwort gesendet wird, dann Neustart
      setTimeout(() => {
        console.log('=== Server-Neustart nach DB-Restore ===');
        process.exit(0);
      }, 1000);
    } catch (err: any) {
      console.error('[Restore] Fehler:', err);
      res.status(500).json({ error: 'Restore fehlgeschlagen: ' + err.message });
    }
  }
);

// Serve the built React frontend if dist folder exists (production / Azure)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  console.log(`Frontend wird ausgeliefert aus: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  console.log('Frontend dist nicht gefunden – nur API-Modus (Entwicklung)');
}

// ── Auto-Checkout: Jeden Tag um 03:00 Uhr alle offenen Warenkörbe automatisch buchen ──
function autoCheckoutAllCarts() {
  console.log('[AutoCheckout] Starte automatische Buchung aller offenen Warenkörbe...');
  try {
    const cartItems = db.prepare(`
      SELECT ci.member_id, ci.drink_id, ci.quantity,
             d.price, d.stock, d.name AS drink_name, d.active
      FROM cart_items ci
      JOIN drinks d ON d.id = ci.drink_id
      WHERE d.active = 1
      ORDER BY ci.member_id
    `).all() as any[];

    if (cartItems.length === 0) {
      console.log('[AutoCheckout] Keine offenen Warenkörbe – nichts zu tun.');
      return;
    }

    // Grupieren nach member_id
    const byMember = new Map<number, any[]>();
    for (const item of cartItems) {
      if (!byMember.has(item.member_id)) byMember.set(item.member_id, []);
      byMember.get(item.member_id)!.push(item);
    }

    const insBooking  = db.prepare(`INSERT INTO bookings (drink_id, member_id, quantity, unit_price, total_price, booking_type, status, created_by) VALUES (?, ?, ?, ?, ?, 'einzeln', 'bestaetigt', ?)`);
    const updStock    = db.prepare(`UPDATE drinks SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?`);
    const insMovement = db.prepare(`INSERT INTO inventory_movements (drink_id, movement_type, quantity, comment, created_by) VALUES (?, 'verbrauch', ?, ?, ?)`);
    const delCart     = db.prepare('DELETE FROM cart_items WHERE member_id = ?');
    const insAudit    = db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, created_by) VALUES ('cart', ?, 'auto_checkout', 'offen', 'gebucht', ?)`);

    let totalBooked = 0, skipped = 0, errors = 0;

    for (const [memberId, items] of byMember) {
      try {
        db.transaction(() => {
          for (const item of items) {
            // Bestand neu abfragen (atomar)
            const drink = db.prepare('SELECT stock FROM drinks WHERE id = ? AND active = 1').get(item.drink_id) as any;
            if (!drink || drink.stock < item.quantity) {
              console.warn(`[AutoCheckout] Übersprungen: ${item.drink_name} (Bestand: ${drink?.stock ?? 0}, benötigt: ${item.quantity})`);
              skipped++;
              continue;
            }
            const total = parseFloat((item.price * item.quantity).toFixed(2));
            const ins = insBooking.run(item.drink_id, memberId, item.quantity, item.price, total, memberId);
            updStock.run(item.quantity, item.drink_id);
            insMovement.run(item.drink_id, -item.quantity, `Auto-Checkout #${ins.lastInsertRowid}`, memberId);
            totalBooked++;
          }
          delCart.run(memberId);
          insAudit.run(memberId, memberId);
        })();
      } catch (e: any) {
        console.error(`[AutoCheckout] Fehler bei Mitglied ${memberId}:`, e.message);
        errors++;
      }
    }
    console.log(`[AutoCheckout] Fertig: ${totalBooked} Buchungen erstellt, ${skipped} übersprungen, ${errors} Fehler`);
  } catch (e: any) {
    console.error('[AutoCheckout] Kritischer Fehler:', e.message);
  }
}

// Cron-Job: täglich 03:00 Uhr (Europe/Berlin)
cron.schedule('0 3 * * *', autoCheckoutAllCarts, { timezone: 'Europe/Berlin' });
console.log('[AutoCheckout] Nacht-Job registriert: täglich 03:00 Uhr (Europe/Berlin)');

// Manueller Trigger-Endpoint (Admin)
app.post('/api/auto-checkout/trigger', authenticate, requireRole('admin'), (_req: AuthRequest, res: any) => {
  autoCheckoutAllCarts();
  res.json({ message: 'Auto-Checkout manuell ausgelöst' });
});

app.listen(PORT, () => {
  console.log(`TV Bruvi Getränke läuft auf Port ${PORT} [${isProd ? 'production' : 'development'}]`);
  if (!isProd) console.log(`Standard-Login: Admin Tennisclub / PIN: 1234`);
});
