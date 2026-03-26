import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

      // 5. Server neu starten (Azure startet den Prozess automatisch neu)
      res.json({
        message: 'Datenbank wiederhergestellt. Server wird neu gestartet...',
        size: body.length,
        backup: path.basename(backupPath),
      });

      // Kurze Verzögerung damit die Antwort gesendet wird, dann Neustart
      setTimeout(() => {
        console.log('=== Server-Neustart nach DB-Restore ===');
        process.exit(0);
      }, 500);
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

app.listen(PORT, () => {
  console.log(`TV Bruvi Getränke läuft auf Port ${PORT} [${isProd ? 'production' : 'development'}]`);
  if (!isProd) console.log(`Standard-Login: Admin Tennisclub / PIN: 1234`);
});
