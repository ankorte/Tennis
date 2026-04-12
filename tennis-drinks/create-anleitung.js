const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, ImageRun, LevelFormat
} = require('docx');
const fs = require('fs');
const path = require('path');

// Farben TV Bruvi
const BLAU     = '1A3B8F';
const ROT      = 'E8002D';
const HELLBLAU = 'EEF2FF';
const GRUEN    = '16A34A';
const ORANGE   = 'EA580C';
const GRAU     = 'F1F5F9';
const DUNKEL   = '1E293B';
const WEISS    = 'FFFFFF';

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function zelle(children, bg, width, opts = {}) {
  return new TableCell({
    borders: noBorders,
    width: { size: width, type: WidthType.DXA },
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    margins: { top: opts.padV || 100, bottom: opts.padV || 100, left: opts.padH || 160, right: opts.padH || 160 },
    verticalAlign: opts.vAlign || VerticalAlign.TOP,
    children,
  });
}

function abstand(pt = 160) {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', size: pt })] });
}

// Nummerierter Schritt
function schritt(nr, titel, text) {
  const grenze = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [700, 8660],
    borders: { top: grenze, bottom: grenze, left: grenze, right: grenze, insideH: grenze, insideV: grenze },
    rows: [new TableRow({ children: [
      zelle([new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(nr), bold: true, size: 28, color: WEISS, font: 'Arial' })],
      })], ROT, 700, { padV: 80, padH: 80, vAlign: VerticalAlign.CENTER }),
      zelle([
        new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: titel, bold: true, size: 22, color: DUNKEL, font: 'Arial' })],
        }),
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text, size: 20, color: '475569', font: 'Arial' })],
        }),
      ], GRAU, 8660, { padV: 100, padH: 200 }),
    ]})]
  });
}

// Hinweisbox
function hinweis(icon, text, bg, textColor) {
  const grenze = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [600, 8760],
    borders: { top: grenze, bottom: grenze, left: grenze, right: grenze, insideH: grenze, insideV: grenze },
    rows: [new TableRow({ children: [
      zelle([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: icon, size: 28, font: 'Segoe UI Emoji' })] })], bg, 600, { padV: 100, padH: 60, vAlign: VerticalAlign.CENTER }),
      zelle([new Paragraph({ children: [new TextRun({ text, size: 20, color: textColor || DUNKEL, font: 'Arial' })] })], bg, 8760, { padV: 100, padH: 160 }),
    ]})]
  });
}

// Abschnittsüberschrift
function sectionTitle(icon, titel, color) {
  const linkeBorder = { style: BorderStyle.SINGLE, size: 12, color: color || BLAU };
  return new Paragraph({
    spacing: { before: 260, after: 120 },
    border: { left: linkeBorder },
    indent: { left: 200 },
    children: [
      new TextRun({ text: icon + '  ', size: 28, font: 'Segoe UI Emoji' }),
      new TextRun({ text: titel, bold: true, size: 28, color: color || BLAU, font: 'Arial' }),
    ],
  });
}

// Logo laden
const logoPath = path.join(__dirname, 'frontend/public/logo.svg');
// Kein SVG-Support in docx – nur PNG/JPG; wir lassen Logo weg und nutzen Text-Header

const doc = new Document({
  numbering: { config: [] },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22, color: DUNKEL } } },
  },
  sections: [
    // ═══════════════════════════════════════════════════
    // SEITE 1
    // ═══════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 720, right: 1000, bottom: 720, left: 1000 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Table({
              width: { size: 9906, type: WidthType.DXA },
              columnWidths: [6500, 3406],
              borders: {
                top: noBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: ROT },
                left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder,
              },
              rows: [new TableRow({ children: [
                zelle([new Paragraph({
                  children: [
                    new TextRun({ text: '🎾  TV Bruvi ', bold: true, size: 26, color: BLAU, font: 'Arial' }),
                    new TextRun({ text: '– Getränke Sparte Tennis', size: 22, color: '64748B', font: 'Arial' }),
                  ],
                })], null, 6500, { padV: 60, padH: 0 }),
                zelle([new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: 'Benutzer-Anleitung', size: 20, color: '94A3B8', font: 'Arial' })],
                })], null, 3406, { padV: 60, padH: 0 }),
              ]})]
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
            spacing: { before: 80 },
            children: [
              new TextRun({ text: 'TV Bruchhausen-Vilsen v. 1863 e.V.  ·  Sparte Tennis', size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ text: '    Seite ', size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ text: ' von ', size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '94A3B8', font: 'Arial' }),
            ],
          })],
        }),
      },
      children: [
        // ── TITELBEREICH ──────────────────────────────
        abstand(200),
        new Table({
          width: { size: 9906, type: WidthType.DXA },
          columnWidths: [9906],
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
          rows: [new TableRow({ children: [
            zelle([
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 60 },
                children: [new TextRun({ text: 'Schritt-für-Schritt', size: 48, bold: true, color: WEISS, font: 'Arial' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 200 },
                children: [new TextRun({ text: 'So buchst du dein Getränk', size: 28, color: 'BFD4FF', font: 'Arial' })],
              }),
            ], BLAU, 9906, { padV: 0, padH: 200 }),
          ]})]
        }),
        abstand(160),

        // ── ANMELDEN ─────────────────────────────────
        sectionTitle('🔐', 'Anmelden', BLAU),
        abstand(80),
        schritt(1, 'App öffnen', 'Öffne den Browser auf deinem Smartphone oder PC und rufe die TV Bruvi App auf. Du siehst die Anmeldemaske mit dem TV-Bruvi-Logo.'),
        abstand(80),
        schritt(2, 'Name und PIN eingeben', 'Trage deinen Vornamen und Nachnamen ein, wie du beim Verein registriert bist. Gib anschließend deinen 4–6-stelligen PIN ein.'),
        abstand(80),
        schritt(3, 'Anmelden tippen', 'Tippe auf den roten Button „Anmelden". Du gelangst zur Startseite.'),
        abstand(100),
        hinweis('💡', 'Tipp: Speichere die App auf deinem Homebildschirm (iOS: Teilen → Zum Home-Bildschirm; Android: Browsermenü → App installieren), damit du sie wie eine normale App nutzen kannst.', 'FFF7ED', ORANGE),
        abstand(160),

        // ── GETRÄNK BESTELLEN ─────────────────────────
        sectionTitle('🍺', 'Getränk eintragen', ROT),
        abstand(80),
        schritt(1, 'Eintragen antippen', 'Tippe in der unteren Navigationsleiste auf „Eintragen" (Bier-Symbol). Du siehst alle verfügbaren Getränke.'),
        abstand(80),
        schritt(2, 'Getränk auswählen', 'Blättere durch die Kategorien (Alle, Favoriten, Wasser, Soft, Bier …) oder nutze die Suchleiste. Tippe auf ein Getränk, um es dem Warenkorb hinzuzufügen.'),
        abstand(80),
        schritt(3, 'Menge anpassen', 'Über die + und − Buttons kannst du die Menge ändern. Die aktuelle Anzahl wird blau am Getränk angezeigt.'),
        abstand(80),
        schritt(4, 'Favoriten speichern', 'Halte ein Getränk gedrückt oder tippe auf den ⭐-Button, um es als Favoriten zu speichern. Favoriten erscheinen oben in der Kategorie „Favoriten".'),
        abstand(100),
        hinweis('ℹ️', 'Die rote Leiste unten zeigt immer an, wie viele Getränke noch nicht gebucht sind und den aktuellen Gesamtbetrag.', HELLBLAU, BLAU),
        abstand(160),

        // ── WARENKORB / BUCHEN ────────────────────────
        sectionTitle('🛒', 'Warenkorb & Buchen', GRUEN),
        abstand(80),
        schritt(1, 'Warenkorb öffnen', 'Tippe auf die rote Leiste unten oder auf das Warenkorb-Symbol oben rechts. Du siehst alle ausgewählten Getränke.'),
        abstand(80),
        schritt(2, 'Prüfen und buchen', 'Kontrolliere deine Auswahl. Tippe dann auf „✓ Alle eintragen (X,XX €)", um die Getränke auf deine Karte zu buchen.'),
        abstand(80),
        schritt(3, 'Stornieren falls nötig', 'Nach dem Buchen erscheint ein grüner Haken. Mit „Stornieren" kannst du die letzte Buchung sofort rückgängig machen – die Artikel kommen zurück in den Warenkorb.'),
        abstand(100),
        hinweis('⚠️', 'Nicht gebuchte Getränke im Warenkorb werden automatisch um 3:00 Uhr nachts gebucht, falls du es vergisst.', 'FFF7ED', ORANGE),
      ],
    },

    // ═══════════════════════════════════════════════════
    // SEITE 2
    // ═══════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 1000, bottom: 720, left: 1000 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Table({
              width: { size: 9906, type: WidthType.DXA },
              columnWidths: [6500, 3406],
              borders: {
                top: noBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: ROT },
                left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder,
              },
              rows: [new TableRow({ children: [
                zelle([new Paragraph({
                  children: [
                    new TextRun({ text: '🎾  TV Bruvi ', bold: true, size: 26, color: BLAU, font: 'Arial' }),
                    new TextRun({ text: '– Getränke Sparte Tennis', size: 22, color: '64748B', font: 'Arial' }),
                  ],
                })], null, 6500, { padV: 60, padH: 0 }),
                zelle([new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: 'Benutzer-Anleitung', size: 20, color: '94A3B8', font: 'Arial' })],
                })], null, 3406, { padV: 60, padH: 0 }),
              ]})]
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
            spacing: { before: 80 },
            children: [
              new TextRun({ text: 'TV Bruchhausen-Vilsen v. 1863 e.V.  ·  Sparte Tennis', size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ text: '    Seite ', size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ text: ' von ', size: 16, color: '94A3B8', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '94A3B8', font: 'Arial' }),
            ],
          })],
        }),
      },
      children: [
        abstand(160),

        // ── MEINE KARTE ───────────────────────────────
        sectionTitle('📋', 'Meine Karte – Buchungsübersicht', '0F766E'),
        abstand(80),
        schritt(1, 'Karte öffnen', 'Tippe auf das Karteikasten-Symbol „Karte" in der Navigation unten. Du siehst deinen offenen Betrag, deine Statistik und alle bisherigen Buchungen.'),
        abstand(80),
        schritt(2, 'Buchungen einsehen', 'Alle Buchungen sind chronologisch aufgelistet. Grün „offen" = noch nicht abgerechnet. Grau „storniert" = rückgängig gemacht.'),
        abstand(80),
        schritt(3, 'Karte drucken', 'Tippe oben rechts auf „🖨 Drucken", um eine Übersicht deiner Buchungen auszudrucken oder als PDF zu speichern.'),
        abstand(100),
        hinweis('💡', 'Der blaue Balken oben zeigt deinen aktuell offenen Betrag. Dieser wird vom Kassenwart regelmäßig abgerechnet.', HELLBLAU, BLAU),
        abstand(160),

        // ── PIN ÄNDERN ────────────────────────────────
        sectionTitle('🔑', 'PIN ändern', ORANGE),
        abstand(80),
        schritt(1, 'Profil öffnen', 'Tippe in der unteren Leiste auf „Mehr" und dann auf „⚙️ Profil". Scrolle nach unten zum Bereich „PIN ändern".'),
        abstand(80),
        schritt(2, 'PINs eingeben', 'Gib deinen aktuellen PIN ein, dann deinen neuen PIN (mind. 4 Stellen) und bestätige ihn. Tippe auf „PIN ändern".'),
        abstand(80),
        schritt(3, 'Kontaktdaten pflegen', 'Im selben Profil kannst du E-Mail-Adresse und Telefonnummer hinterlegen – das wird benötigt, wenn du deinen PIN vergisst.'),
        abstand(100),
        hinweis('⚠️', 'Merke dir deinen PIN gut! Ohne hinterlegte E-Mail oder Telefonnummer kann nur ein Administrator deinen PIN zurücksetzen.', 'FFF7ED', ORANGE),
        abstand(160),

        // ── PIN VERGESSEN ─────────────────────────────
        sectionTitle('🆘', 'PIN vergessen', ROT),
        abstand(80),
        schritt(1, 'PIN vergessen antippen', 'Auf der Anmeldeseite findest du rechts neben dem PIN-Feld den Link „PIN vergessen?". Tippe darauf.'),
        abstand(80),
        schritt(2, 'Daten eingeben', 'Gib deinen Vor- und Nachnamen sowie deine hinterlegte E-Mail-Adresse oder Telefonnummer ein.'),
        abstand(80),
        schritt(3, 'Neuen Temp-PIN notieren', 'Nach erfolgreicher Verifikation wird dir ein temporärer PIN angezeigt. Melde dich damit an und ändere den PIN sofort im Profil.'),
        abstand(80),
        schritt(4, 'Kein Zugang möglich?', 'Falls keine Kontaktdaten hinterlegt sind, wende dich direkt an den Vereins-Administrator. Er kann deinen PIN zurücksetzen.'),
        abstand(160),

        // ── SCHNELLREFERENZ ───────────────────────────
        new Table({
          width: { size: 9906, type: WidthType.DXA },
          columnWidths: [9906],
          borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
          rows: [new TableRow({ children: [
            zelle([
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 140, after: 100 },
                children: [new TextRun({ text: 'Schnellübersicht Navigation', bold: true, size: 24, color: WEISS, font: 'Arial' })],
              }),
              new Table({
                width: { size: 9200, type: WidthType.DXA },
                columnWidths: [2300, 2300, 2300, 2300],
                borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
                rows: [new TableRow({ children: [
                  zelle([
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '🏠', size: 40, font: 'Segoe UI Emoji' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: 'Start', bold: true, size: 22, color: WEISS, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dashboard &', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Schnellbuchung', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                  ], '0F2566', 2300, { padV: 120 }),
                  zelle([
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '🍺', size: 40, font: 'Segoe UI Emoji' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: 'Eintragen', bold: true, size: 22, color: WEISS, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Getränke', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'auswählen', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                  ], '0F2566', 2300, { padV: 120 }),
                  zelle([
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '📋', size: 40, font: 'Segoe UI Emoji' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: 'Karte', bold: true, size: 22, color: WEISS, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Meine Buchungen', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '& Kontostand', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                  ], '0F2566', 2300, { padV: 120 }),
                  zelle([
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '☰', size: 40, font: 'Segoe UI Emoji' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: 'Mehr', bold: true, size: 22, color: WEISS, font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Profil, Einstellungen', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '& Admin-Bereich', size: 18, color: 'BFD4FF', font: 'Arial' })] }),
                  ], '0F2566', 2300, { padV: 120 }),
                ]})]
              }),
              new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
            ], BLAU, 9906, { padV: 0, padH: 180 }),
          ]})]
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('TV-Bruvi-Anleitung.docx', buffer);
  console.log('✅ TV-Bruvi-Anleitung.docx erstellt (' + Math.round(buffer.length/1024) + ' KB)');
}).catch(e => { console.error('Fehler:', e.message); process.exit(1); });
