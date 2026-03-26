import { Router, Response } from 'express';
import nodemailer from 'nodemailer';
import db from '../db/schema';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── Hilfsfunktionen ──────────────────────────────────────────────────────

function getSettings(): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM app_settings WHERE key LIKE 'email_%'`).all() as any[];
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

function createTransport(s: Record<string, string>) {
  if (!s.email_host || !s.email_user || !s.email_pass) {
    throw new Error('E-Mail-Einstellungen unvollständig. Bitte SMTP-Daten hinterlegen.');
  }
  return nodemailer.createTransport({
    host: s.email_host,
    port: parseInt(s.email_port || '587'),
    secure: (s.email_port || '587') === '465',
    auth: { user: s.email_user, pass: s.email_pass },
  });
}

// Umlaute-sicheres HTML-Encoding
function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Einstellungen ────────────────────────────────────────────────────────

router.get('/settings', requireRole('admin'), (_req: AuthRequest, res: Response) => {
  const s = getSettings();
  // Passwort nicht im Klartext zurückgeben
  if (s.email_pass) s.email_pass = '••••••••';
  res.json(s);
});

router.put('/settings', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const fields = ['email_host', 'email_port', 'email_user', 'email_pass', 'email_from', 'email_from_name', 'email_reply_to'];
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  db.transaction(() => {
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        const val = req.body[key].trim();
        // Passwort-Platzhalter nicht überschreiben
        if (key === 'email_pass' && val === '••••••••') continue;
        upsert.run(key, val);
      }
    }
  })();
  res.json({ message: 'E-Mail-Einstellungen gespeichert' });
});

// ── Test-E-Mail ──────────────────────────────────────────────────────────

router.post('/test', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { to } = req.body;
  if (!to) { res.status(400).json({ error: 'Empfänger fehlt' }); return; }

  try {
    const s = getSettings();
    const transport = createTransport(s);
    await transport.sendMail({
      from: `"${s.email_from_name || 'TV Bruvi'}" <${s.email_from || s.email_user}>`,
      replyTo: s.email_reply_to || undefined,
      to,
      subject: 'TV Bruvi – Test-E-Mail',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1A3B8F, #0F2566); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎾 TV Bruvi</h1>
            <p style="color: #FF9DB5; margin: 5px 0 0; font-size: 14px;">Getränke · Sparte Tennis</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1A3B8F; margin-top: 0;">✅ Test erfolgreich!</h2>
            <p style="color: #666;">Der E-Mail-Versand funktioniert. Diese Nachricht wurde von der TV Bruvi Getränke-App gesendet.</p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">TV Bruchhausen-Vilsen v. 1863 e.V.</p>
          </div>
        </div>
      `,
    });
    res.json({ message: 'Test-E-Mail gesendet' });
  } catch (err: any) {
    res.status(500).json({ error: 'Versand fehlgeschlagen: ' + err.message });
  }
});

// ── Zahlungserinnerung ───────────────────────────────────────────────────

router.post('/payment-reminder', requireRole('admin', 'kassenwart'), async (req: AuthRequest, res: Response) => {
  const { member_ids, custom_text } = req.body;
  // member_ids: number[] oder undefined (= alle mit offenem Betrag)

  try {
    const s = getSettings();
    const transport = createTransport(s);

    // Mitglieder mit offenem Betrag laden
    let members: any[];
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      const placeholders = member_ids.map(() => '?').join(',');
      members = db.prepare(`
        SELECT m.id, m.first_name, m.last_name, m.email,
               COALESCE(SUM(b.total_price), 0) as open_amount
        FROM members m
        LEFT JOIN bookings b ON b.member_id = m.id AND b.cancelled = 0 AND b.status NOT IN ('storniert','abgerechnet')
        WHERE m.id IN (${placeholders}) AND m.active = 1 AND m.email IS NOT NULL
        GROUP BY m.id
        HAVING open_amount > 0
      `).all(...member_ids);
    } else {
      members = db.prepare(`
        SELECT m.id, m.first_name, m.last_name, m.email,
               COALESCE(SUM(b.total_price), 0) as open_amount
        FROM members m
        LEFT JOIN bookings b ON b.member_id = m.id AND b.cancelled = 0 AND b.status NOT IN ('storniert','abgerechnet')
        WHERE m.active = 1 AND m.email IS NOT NULL
        GROUP BY m.id
        HAVING open_amount > 0
      `).all();
    }

    if (members.length === 0) {
      res.json({ message: 'Keine Mitglieder mit offenem Betrag gefunden', sent: 0, failed: 0 });
      return;
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const fromAddr = `"${s.email_from_name || 'TV Bruvi'}" <${s.email_from || s.email_user}>`;

    for (const m of members) {
      try {
        const extraText = custom_text
          ? `<p style="color: #333; margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #1A3B8F;">${esc(custom_text)}</p>`
          : '';

        await transport.sendMail({
          from: fromAddr,
          replyTo: s.email_reply_to || undefined,
          to: m.email,
          subject: `TV Bruvi – Zahlungserinnerung (${m.open_amount.toFixed(2)} €)`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1A3B8F, #0F2566); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎾 TV Bruvi</h1>
                <p style="color: #FF9DB5; margin: 5px 0 0; font-size: 14px;">Getränke · Sparte Tennis</p>
              </div>
              <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1A3B8F; margin-top: 0;">Zahlungserinnerung</h2>
                <p style="color: #333;">Hallo ${esc(m.first_name)},</p>
                <p style="color: #333;">für dein Getränkekonto beim TV Bruvi (Sparte Tennis) ist noch ein offener Betrag vorhanden:</p>
                <div style="background: #f0f4ff; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                  <div style="font-size: 36px; font-weight: bold; color: #1A3B8F;">${m.open_amount.toFixed(2)} €</div>
                  <div style="color: #666; font-size: 14px; margin-top: 4px;">Offener Betrag</div>
                </div>
                ${extraText}
                <p style="color: #333;">Bitte überweise den Betrag zeitnah oder sprich den Kassenwart an.</p>
                <p style="color: #333;">Vielen Dank und sportliche Grüße,<br>dein TV Bruvi Team</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #999; font-size: 11px;">
                  Diese E-Mail wurde automatisch von der TV Bruvi Getränke-App versendet.
                  Bei Fragen wende dich bitte an den Kassenwart.
                </p>
              </div>
            </div>
          `,
        });
        sent++;
      } catch (err: any) {
        failed++;
        errors.push(`${m.first_name} ${m.last_name}: ${err.message}`);
      }
    }

    // Audit-Log
    db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, new_value, created_by)
      VALUES ('email', 0, 'payment_reminder', ?, ?)`).run(
      JSON.stringify({ sent, failed, member_count: members.length }),
      req.user!.id
    );

    res.json({ message: `Zahlungserinnerung versendet`, sent, failed, errors: errors.slice(0, 10) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Freie E-Mail an ausgewählte Mitglieder ──────────────────────────────

router.post('/send', requireRole('admin', 'kassenwart'), async (req: AuthRequest, res: Response) => {
  const { member_ids, subject, body_text } = req.body;
  if (!subject || !body_text) { res.status(400).json({ error: 'Betreff und Text erforderlich' }); return; }

  try {
    const s = getSettings();
    const transport = createTransport(s);

    // Empfänger laden
    let members: any[];
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      const placeholders = member_ids.map(() => '?').join(',');
      members = db.prepare(`SELECT id, first_name, last_name, email FROM members WHERE id IN (${placeholders}) AND email IS NOT NULL`).all(...member_ids);
    } else {
      members = db.prepare(`SELECT id, first_name, last_name, email FROM members WHERE active = 1 AND email IS NOT NULL`).all();
    }

    if (members.length === 0) {
      res.status(400).json({ error: 'Keine Empfänger gefunden' });
      return;
    }

    let sent = 0;
    let failed = 0;
    const fromAddr = `"${s.email_from_name || 'TV Bruvi'}" <${s.email_from || s.email_user}>`;

    // Text in HTML-Absätze umwandeln
    const bodyHtml = body_text.split('\n').map((line: string) =>
      line.trim() ? `<p style="color: #333; margin: 8px 0;">${esc(line)}</p>` : '<br>'
    ).join('');

    for (const m of members) {
      try {
        await transport.sendMail({
          from: fromAddr,
          replyTo: s.email_reply_to || undefined,
          to: m.email,
          subject: `TV Bruvi – ${subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1A3B8F, #0F2566); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎾 TV Bruvi</h1>
                <p style="color: #FF9DB5; margin: 5px 0 0; font-size: 14px;">Getränke · Sparte Tennis</p>
              </div>
              <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1A3B8F; margin-top: 0;">${esc(subject)}</h2>
                <p style="color: #333;">Hallo ${esc(m.first_name)},</p>
                ${bodyHtml}
                <p style="color: #333; margin-top: 20px;">Sportliche Grüße,<br>dein TV Bruvi Team</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #999; font-size: 11px;">TV Bruchhausen-Vilsen v. 1863 e.V. · Sparte Tennis</p>
              </div>
            </div>
          `,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, new_value, created_by)
      VALUES ('email', 0, 'send', ?, ?)`).run(
      JSON.stringify({ subject, sent, failed, recipients: members.length }),
      req.user!.id
    );

    res.json({ message: 'E-Mails versendet', sent, failed, total: members.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Monatliche Verbrauchsübersicht ───────────────────────────────────────

router.post('/monthly-report', requireRole('admin', 'kassenwart'), async (req: AuthRequest, res: Response) => {
  const { year, month } = req.body;
  if (!year || !month) { res.status(400).json({ error: 'Jahr und Monat erforderlich' }); return; }

  const monthStr = String(month).padStart(2, '0');
  const periodStart = `${year}-${monthStr}-01`;
  // Letzter Tag des Monats
  const nextMonth = new Date(Number(year), Number(month), 1);
  const periodEnd = nextMonth.toISOString().split('T')[0];
  const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const monthName = monthNames[Number(month)] || month;

  try {
    const s = getSettings();
    const transport = createTransport(s);

    // Alle aktiven Mitglieder mit Buchungen in diesem Monat
    const members = db.prepare(`
      SELECT m.id, m.first_name, m.last_name, m.email
      FROM members m
      WHERE m.active = 1 AND m.email IS NOT NULL
    `).all() as any[];

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];
    const fromAddr = `"${s.email_from_name || 'TV Bruvi'}" <${s.email_from || s.email_user}>`;

    for (const m of members) {
      // Buchungen dieses Mitglieds im Monat
      const bookings = db.prepare(`
        SELECT b.quantity, b.unit_price, b.total_price, b.created_at,
               d.name as drink_name, d.category,
               c.first_name || ' ' || c.last_name as created_by_name,
               b.created_by
        FROM bookings b
        JOIN drinks d ON d.id = b.drink_id
        LEFT JOIN members c ON c.id = b.created_by
        WHERE b.member_id = ? AND b.cancelled = 0
          AND b.created_at >= ? AND b.created_at < ?
        ORDER BY b.created_at ASC
      `).all(m.id, periodStart, periodEnd) as any[];

      if (bookings.length === 0) { skipped++; continue; }

      const totalQty = bookings.reduce((s: number, b: any) => s + b.quantity, 0);
      const totalAmount = bookings.reduce((s: number, b: any) => s + b.total_price, 0);

      // Zusammenfassung nach Getränk
      const drinkSummary: Record<string, { qty: number; total: number }> = {};
      for (const b of bookings) {
        if (!drinkSummary[b.drink_name]) drinkSummary[b.drink_name] = { qty: 0, total: 0 };
        drinkSummary[b.drink_name].qty += b.quantity;
        drinkSummary[b.drink_name].total += b.total_price;
      }
      const sortedDrinks = Object.entries(drinkSummary).sort((a, b) => b[1].qty - a[1].qty);

      // Getränke-Tabelle als HTML
      const drinkRows = sortedDrinks.map(([name, { qty, total }]) =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${esc(name)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${qty}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${total.toFixed(2)} €</td>
        </tr>`
      ).join('');

      // Einzelbuchungen als HTML
      const bookingRows = bookings.map((b: any) => {
        const dt = new Date(b.created_at);
        const dateStr = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        const timeStr = dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const isSelf = b.created_by === m.id;
        const bookerHint = isSelf ? '' : ` <span style="color: #3B82F6; font-size: 11px;">(${esc(b.created_by_name)})</span>`;
        return `<tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #666;">${dateStr} ${timeStr}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${esc(b.drink_name)}${bookerHint}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center;">${b.quantity}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right;">${b.total_price.toFixed(2)} €</td>
        </tr>`;
      }).join('');

      try {
        await transport.sendMail({
          from: fromAddr,
          replyTo: s.email_reply_to || undefined,
          to: m.email,
          subject: `TV Bruvi – Deine Getränkeübersicht ${monthName} ${year}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1A3B8F, #0F2566); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎾 TV Bruvi</h1>
                <p style="color: #FF9DB5; margin: 5px 0 0; font-size: 14px;">Getränke · Sparte Tennis</p>
              </div>
              <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1A3B8F; margin-top: 0;">Deine Getränkeübersicht</h2>
                <p style="color: #333;">Hallo ${esc(m.first_name)},</p>
                <p style="color: #333;">hier ist deine Zusammenfassung für <strong>${monthName} ${year}</strong>:</p>

                <!-- Zusammenfassung -->
                <div style="display: flex; gap: 12px; margin: 20px 0;">
                  <div style="flex: 1; background: #f0f4ff; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #1A3B8F;">${totalQty}</div>
                    <div style="color: #666; font-size: 12px;">Getränke</div>
                  </div>
                  <div style="flex: 1; background: #fef3f2; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #E8002D;">${totalAmount.toFixed(2)} €</div>
                    <div style="color: #666; font-size: 12px;">Gesamtbetrag</div>
                  </div>
                </div>

                <!-- Getränke-Übersicht -->
                <h3 style="color: #1A3B8F; font-size: 16px; margin: 24px 0 8px;">Zusammenfassung nach Getränk</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <thead>
                    <tr style="background: #f8fafc;">
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Getränk</th>
                      <th style="padding: 8px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Anzahl</th>
                      <th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>${drinkRows}</tbody>
                  <tfoot>
                    <tr style="background: #f0f4ff; font-weight: bold;">
                      <td style="padding: 10px 12px;">Gesamt</td>
                      <td style="padding: 10px 12px; text-align: center;">${totalQty}</td>
                      <td style="padding: 10px 12px; text-align: right;">${totalAmount.toFixed(2)} €</td>
                    </tr>
                  </tfoot>
                </table>

                <!-- Einzelbuchungen -->
                <details style="margin-top: 20px;">
                  <summary style="cursor: pointer; color: #1A3B8F; font-weight: bold; font-size: 14px; padding: 8px 0;">
                    📋 Alle ${bookings.length} Einzelbuchungen anzeigen
                  </summary>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
                    <thead>
                      <tr style="background: #f8fafc;">
                        <th style="padding: 6px 12px; text-align: left; font-size: 12px; border-bottom: 1px solid #e5e7eb;">Datum</th>
                        <th style="padding: 6px 12px; text-align: left; font-size: 12px; border-bottom: 1px solid #e5e7eb;">Getränk</th>
                        <th style="padding: 6px 12px; text-align: center; font-size: 12px; border-bottom: 1px solid #e5e7eb;">Anz.</th>
                        <th style="padding: 6px 12px; text-align: right; font-size: 12px; border-bottom: 1px solid #e5e7eb;">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>${bookingRows}</tbody>
                  </table>
                </details>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                <p style="color: #999; font-size: 11px;">
                  Diese Übersicht wurde automatisch von der TV Bruvi Getränke-App erstellt.
                  Bei Fragen wende dich bitte an den Kassenwart.
                </p>
              </div>
            </div>
          `,
        });
        sent++;
      } catch (err: any) {
        failed++;
        errors.push(`${m.first_name} ${m.last_name}: ${err.message}`);
      }
    }

    db.prepare(`INSERT INTO audit_log (entity_type, entity_id, action, new_value, created_by)
      VALUES ('email', 0, 'monthly_report', ?, ?)`).run(
      JSON.stringify({ year, month, sent, failed, skipped }),
      req.user!.id
    );

    res.json({
      message: `Monatsübersicht ${monthName} ${year} versendet`,
      sent, failed, skipped,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
