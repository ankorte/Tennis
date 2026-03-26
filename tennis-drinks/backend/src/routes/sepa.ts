import { Router, Response } from 'express';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

// sepa.js hat keine TypeScript-Typen – require statt import
const SEPA = require('sepa');

const router = Router();
router.use(authenticate);

// Umlaute und Sonderzeichen entfernen (SEPA erlaubt nur Latin ohne Umlaute)
function sanitize(str: string): string {
  return str
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/[^a-zA-Z0-9 \/\-?:().,'+]/g, '')
    .slice(0, 70);
}

// IBAN-Format validieren (grob)
function isValidIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,34}$/.test(cleaned);
}

// === SEPA-Einstellungen ===

// GET /api/sepa/settings – Aktuelle SEPA-Konfiguration laden
router.get('/settings', requireRole('admin', 'kassenwart'), (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`SELECT key, value FROM app_settings WHERE key LIKE 'sepa_%'`).all() as any[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

// PUT /api/sepa/settings – SEPA-Konfiguration speichern
router.put('/settings', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const fields = ['sepa_creditor_name', 'sepa_creditor_iban', 'sepa_creditor_bic', 'sepa_creditor_id', 'sepa_sequence_type'];
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  db.transaction(() => {
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        upsert.run(key, req.body[key].trim());
      }
    }
  })();
  res.json({ message: 'SEPA-Einstellungen gespeichert' });
});

// === SEPA XML generieren ===

// POST /api/sepa/generate – pain.008.001.02 XML erstellen
router.post('/generate', requireRole('admin', 'kassenwart'), (req: AuthRequest, res: Response) => {
  const { period_from, period_to, collection_date } = req.body;
  if (!period_from || !period_to || !collection_date) {
    res.status(400).json({ error: 'Zeitraum und Einzugsdatum erforderlich' });
    return;
  }

  // SEPA-Einstellungen laden
  const settingsRows = db.prepare(`SELECT key, value FROM app_settings WHERE key LIKE 'sepa_%'`).all() as any[];
  const s: Record<string, string> = {};
  for (const row of settingsRows) s[row.key] = row.value;

  if (!s.sepa_creditor_name || !s.sepa_creditor_iban || !s.sepa_creditor_bic || !s.sepa_creditor_id) {
    res.status(400).json({ error: 'SEPA-Einstellungen unvollständig. Bitte zuerst Gläubiger-Daten hinterlegen.' });
    return;
  }

  // Offene Abrechnungen mit IBAN laden
  const billings = db.prepare(`
    SELECT b.id, b.total_amount, b.period_from, b.period_to,
           m.id as member_id, m.first_name, m.last_name, m.member_number,
           m.iban, m.bic, m.mandate_ref, m.mandate_date
    FROM billings b
    JOIN members m ON m.id = b.member_id
    WHERE b.status = 'offen'
      AND b.period_from = ? AND b.period_to = ?
      AND b.total_amount > 0
    ORDER BY m.last_name, m.first_name
  `).all(period_from, period_to) as any[];

  if (billings.length === 0) {
    res.status(400).json({ error: 'Keine offenen Abrechnungen für diesen Zeitraum gefunden' });
    return;
  }

  // Mitglieder ohne IBAN herausfiltern und merken
  const withIban = billings.filter(b => b.iban && isValidIBAN(b.iban));
  const withoutIban = billings.filter(b => !b.iban || !isValidIBAN(b.iban));

  if (withIban.length === 0) {
    res.status(400).json({
      error: 'Keines der Mitglieder hat eine gültige IBAN hinterlegt',
      missing: withoutIban.map(b => `${b.first_name} ${b.last_name} (${b.member_number})`)
    });
    return;
  }

  // Mitglieder ohne Mandat-Referenz automatisch generieren
  const updateMandate = db.prepare(`UPDATE members SET mandate_ref = ?, mandate_date = ? WHERE id = ? AND mandate_ref IS NULL`);
  for (const b of withIban) {
    if (!b.mandate_ref) {
      b.mandate_ref = `MNDT-${b.member_number}-${new Date().getFullYear()}`;
      b.mandate_date = new Date().toISOString().split('T')[0];
      updateMandate.run(b.mandate_ref, b.mandate_date, b.member_id);
    }
  }

  try {
    // SEPA Document erstellen
    const doc = new SEPA.Document('pain.008.001.02');
    doc.grpHdr.id = `TVBRUVI-${period_from.replace(/-/g, '')}-${Date.now()}`.slice(0, 35);
    doc.grpHdr.created = new Date();
    doc.grpHdr.initiatorName = sanitize(s.sepa_creditor_name);

    // Payment Info Block
    const info = doc.createPaymentInfo();
    info.collectionDate = new Date(collection_date);
    info.creditorIBAN = s.sepa_creditor_iban.replace(/\s/g, '');
    info.creditorBIC = s.sepa_creditor_bic.replace(/\s/g, '');
    info.creditorName = sanitize(s.sepa_creditor_name);
    info.creditorId = s.sepa_creditor_id;
    info.requestedExecutionDate = new Date(collection_date);
    info.batchBooking = true;

    // Sequence Type: FRST (Erstlastschrift), RCUR (Folgelastschrift), OOFF (Einmalig)
    const seqType = s.sepa_sequence_type || 'RCUR';

    doc.addPaymentInfo(info);

    // Transaktionen hinzufügen
    for (const b of withIban) {
      const tx = info.createTransaction();
      tx.debtorName = sanitize(`${b.first_name} ${b.last_name}`);
      tx.debtorIBAN = b.iban.replace(/\s/g, '').toUpperCase();
      if (b.bic) tx.debtorBIC = b.bic.replace(/\s/g, '').toUpperCase();
      tx.mandateId = b.mandate_ref;
      tx.mandateSignatureDate = new Date(b.mandate_date || '2024-01-01');
      tx.amount = Math.round(b.total_amount * 100) / 100;
      tx.remittanceInfo = sanitize(`TV Bruvi Getraenke ${b.period_from} bis ${b.period_to}`);
      tx.end2endId = `BRUVI-${b.member_number}-${b.period_from.replace(/-/g, '')}`.slice(0, 35);
      info.addTransaction(tx);
    }

    const xml = doc.toString();

    // Antwort
    res.json({
      message: 'SEPA-Datei erstellt',
      included: withIban.length,
      excluded: withoutIban.length,
      total_amount: withIban.reduce((sum: number, b: any) => sum + b.total_amount, 0),
      missing_iban: withoutIban.map(b => ({
        name: `${b.first_name} ${b.last_name}`,
        member_number: b.member_number,
        amount: b.total_amount,
      })),
      xml,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SEPA-Generierung fehlgeschlagen: ' + (err.message || err) });
  }
});

export default router;
