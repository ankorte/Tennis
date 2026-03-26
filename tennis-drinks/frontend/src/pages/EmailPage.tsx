import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

interface EmailSettings {
  email_host: string
  email_port: string
  email_user: string
  email_pass: string
  email_from: string
  email_from_name: string
  email_reply_to: string
}

interface MemberWithBalance {
  id: number; first_name: string; last_name: string; email: string; open_amount: number
}

const EMPTY_SETTINGS: EmailSettings = {
  email_host: '', email_port: '587', email_user: '', email_pass: '',
  email_from: '', email_from_name: 'TV Bruvi', email_reply_to: '',
}

export default function EmailPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'reminder' | 'compose' | 'monthly' | 'settings'>('reminder')
  const [settings, setSettings] = useState<EmailSettings>(EMPTY_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Zahlungserinnerung
  const [members, setMembers] = useState<MemberWithBalance[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [customText, setCustomText] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; errors?: string[] } | null>(null)

  // Freie E-Mail
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [allMembers, setAllMembers] = useState<{ id: number; first_name: string; last_name: string; email: string }[]>([])
  const [composeSelected, setComposeSelected] = useState<Set<number>>(new Set())
  const [composeResult, setComposeResult] = useState<{ sent: number; failed: number } | null>(null)
  const [composeSending, setComposeSending] = useState(false)

  // Monatsübersicht
  const now = new Date()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const [reportMonth, setReportMonth] = useState(prevMonth)
  const [reportYear, setReportYear] = useState(prevYear)
  const [reportSending, setReportSending] = useState(false)
  const [reportResult, setReportResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null)

  // Test-E-Mail
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    api.get('/email/settings').then(r => {
      if (r.data && typeof r.data === 'object') setSettings({ ...EMPTY_SETTINGS, ...r.data })
    }).catch(() => {})

    // Mitglieder mit offenem Betrag laden
    api.get('/members').then(r => {
      if (!Array.isArray(r.data)) return
      setAllMembers(r.data.filter((m: any) => m.active && m.email))
      // Balance pro Mitglied laden
      Promise.all(
        r.data.filter((m: any) => m.active && m.email).map(async (m: any) => {
          try {
            const bal = await api.get(`/members/${m.id}/balance`)
            return { ...m, open_amount: bal.data?.open_amount ?? 0 }
          } catch { return { ...m, open_amount: 0 } }
        })
      ).then(all => {
        const withBalance = all.filter(m => m.open_amount > 0)
          .sort((a, b) => b.open_amount - a.open_amount)
        setMembers(withBalance)
        setSelectedIds(new Set(withBalance.map(m => m.id)))
      })
    }).catch(() => {})
  }, [])

  // ── Settings ─────────────────────────────────────────

  const handleSaveSettings = async () => {
    setSaving(true); setSaved(false)
    try {
      await api.put('/email/settings', settings)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { alert('Fehler beim Speichern') }
    finally { setSaving(false) }
  }

  const handleTestEmail = async () => {
    if (!testEmail) return
    setTestResult('Sende...')
    try {
      await api.post('/email/test', { to: testEmail })
      setTestResult('✅ Test-E-Mail gesendet!')
    } catch (e: any) {
      setTestResult('❌ ' + (e.response?.data?.error || 'Fehler'))
    }
  }

  // ── Zahlungserinnerung ───────────────────────────────

  const toggleMember = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSendReminder = async () => {
    if (selectedIds.size === 0) { alert('Keine Mitglieder ausgewählt'); return }
    if (!window.confirm(`Zahlungserinnerung an ${selectedIds.size} Mitglieder senden?`)) return
    setSending(true); setResult(null)
    try {
      const res = await api.post('/email/payment-reminder', {
        member_ids: Array.from(selectedIds),
        custom_text: customText || undefined,
      })
      setResult(res.data)
    } catch (e: any) {
      setResult({ sent: 0, failed: 0, errors: [e.response?.data?.error || 'Fehler'] })
    } finally { setSending(false) }
  }

  // ── Freie E-Mail ─────────────────────────────────────

  const handleSendCompose = async () => {
    if (!subject || !bodyText) { alert('Betreff und Text erforderlich'); return }
    const ids = composeSelected.size > 0 ? Array.from(composeSelected) : undefined
    const count = ids ? ids.length : allMembers.length
    if (!window.confirm(`E-Mail an ${count} Mitglieder senden?`)) return
    setComposeSending(true); setComposeResult(null)
    try {
      const res = await api.post('/email/send', {
        member_ids: ids, subject, body_text: bodyText,
      })
      setComposeResult(res.data)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Fehler')
    } finally { setComposeSending(false) }
  }

  // ── Monatsübersicht ─────────────────────────────────

  const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

  const handleSendMonthlyReport = async () => {
    if (!window.confirm(
      `Monatsübersicht ${MONTH_NAMES[reportMonth - 1]} ${reportYear} an alle aktiven Mitglieder senden?`
    )) return
    setReportSending(true); setReportResult(null)
    try {
      const res = await api.post('/email/monthly-report', {
        year: reportYear,
        month: reportMonth,
      })
      setReportResult(res.data)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Fehler beim Versand')
    } finally { setReportSending(false) }
  }

  const totalOpen = members.filter(m => selectedIds.has(m.id)).reduce((s, m) => s + m.open_amount, 0)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-tennis-dark">📧 E-Mail</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">Zahlungserinnerungen und Nachrichten an Mitglieder</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {([['reminder', '💶 Erinnerung'], ['compose', '✉️ Nachricht'], ['monthly', '📊 Monat'], ['settings', '⚙️ SMTP']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${tab === k ? 'bg-white shadow text-tennis-dark' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Zahlungserinnerung ── */}
      {tab === 'reminder' && (
        <div className="space-y-4">
          {/* Zusammenfassung */}
          <div className="card grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-tennis-dark">{members.length}</div>
              <div className="text-[10px] text-gray-500">Mit offenem Betrag</div>
            </div>
            <div>
              <div className="text-xl font-bold" style={{ color: '#1A3B8F' }}>{selectedIds.size}</div>
              <div className="text-[10px] text-gray-500">Ausgewählt</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-600">{totalOpen.toFixed(2)} €</div>
              <div className="text-[10px] text-gray-500">Gesamt offen</div>
            </div>
          </div>

          {/* Optionaler Zusatztext */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Zusatztext (optional)</label>
            <textarea value={customText} onChange={e => setCustomText(e.target.value)}
              className="input-field text-sm" rows={2}
              placeholder="z. B. Bankverbindung, Frist, Hinweise..." />
          </div>

          {/* Mitglieder-Liste */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-500">Empfänger</label>
              <div className="flex gap-2">
                <button onClick={() => setSelectedIds(new Set(members.map(m => m.id)))}
                  className="text-xs text-tennis-green">Alle</button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-gray-400">Keine</button>
              </div>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {members.map(m => (
                <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm
                  ${selectedIds.has(m.id) ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleMember(m.id)}
                    className="rounded" />
                  <span className="flex-1 truncate">{m.first_name} {m.last_name}</span>
                  <span className="font-bold text-red-600 text-xs">{m.open_amount.toFixed(2)} €</span>
                </label>
              ))}
              {members.length === 0 && (
                <p className="text-gray-400 text-center py-4 text-sm">Keine Mitglieder mit offenem Betrag</p>
              )}
            </div>
          </div>

          <button onClick={handleSendReminder} disabled={sending || selectedIds.size === 0}
            className="btn-primary">
            {sending ? '⏳ Sende...' : `💶 Erinnerung senden (${selectedIds.size})`}
          </button>

          {result && (
            <div className={`card border-l-4 ${result.failed === 0 ? 'border-green-500' : 'border-yellow-500'}`}>
              <div className="font-bold mb-1">{result.failed === 0 ? '✅' : '⚠️'} Versand abgeschlossen</div>
              <div className="text-sm text-gray-600">
                {result.sent} gesendet · {result.failed} fehlgeschlagen
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Freie Nachricht ── */}
      {tab === 'compose' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Betreff *</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="input-field" placeholder="z. B. Sommerfest am 15. Juli" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Nachricht *</label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
              className="input-field text-sm" rows={6}
              placeholder="Hallo zusammen,&#10;&#10;..." />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-500">
                Empfänger ({composeSelected.size > 0 ? composeSelected.size : `alle ${allMembers.length}`})
              </label>
              <div className="flex gap-2">
                <button onClick={() => setComposeSelected(new Set(allMembers.map(m => m.id)))}
                  className="text-xs text-tennis-green">Alle</button>
                <button onClick={() => setComposeSelected(new Set())}
                  className="text-xs text-gray-400">Keine (= alle)</button>
              </div>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {allMembers.map(m => (
                <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm
                  ${composeSelected.has(m.id) ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <input type="checkbox" checked={composeSelected.size === 0 || composeSelected.has(m.id)}
                    onChange={() => {
                      if (composeSelected.size === 0) {
                        // Wechsel von "alle" zu "einzeln" – alle außer diesem
                        setComposeSelected(new Set(allMembers.filter(x => x.id !== m.id).map(x => x.id)))
                      } else {
                        const next = new Set(composeSelected)
                        next.has(m.id) ? next.delete(m.id) : next.add(m.id)
                        if (next.size === allMembers.length) setComposeSelected(new Set())
                        else setComposeSelected(next)
                      }
                    }}
                    className="rounded" />
                  <span className="flex-1 truncate">{m.first_name} {m.last_name}</span>
                  <span className="text-xs text-gray-400 truncate">{m.email}</span>
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleSendCompose} disabled={composeSending || !subject || !bodyText}
            className="btn-primary">
            {composeSending ? '⏳ Sende...' : '✉️ Nachricht senden'}
          </button>

          {composeResult && (
            <div className="card border-l-4 border-green-500">
              <div className="font-bold">✅ {composeResult.sent} E-Mails gesendet</div>
              {composeResult.failed > 0 && (
                <div className="text-sm text-red-600">{composeResult.failed} fehlgeschlagen</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Monatsübersicht ── */}
      {tab === 'monthly' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-tennis-dark mb-3">📊 Monatsübersicht versenden</h3>
            <p className="text-sm text-gray-500 mb-4">
              Sendet jedem aktiven Mitglied eine persönliche Übersicht aller Getränkebuchungen
              für den gewählten Monat per E-Mail. Mitglieder ohne Buchungen werden übersprungen.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Monat</label>
                <select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))}
                  className="input-field text-sm">
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Jahr</label>
                <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))}
                  className="input-field text-sm">
                  {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800 mb-4">
              <strong>Vorschau:</strong> Übersicht für <strong>{MONTH_NAMES[reportMonth - 1]} {reportYear}</strong> wird
              an alle aktiven Mitglieder mit E-Mail-Adresse gesendet, die in diesem Monat Buchungen haben.
            </div>

            <button onClick={handleSendMonthlyReport} disabled={reportSending}
              className="btn-primary w-full">
              {reportSending ? '⏳ Sende Berichte...' : `📊 Monatsübersicht ${MONTH_NAMES[reportMonth - 1]} senden`}
            </button>
          </div>

          {reportResult && (
            <div className={`card border-l-4 ${reportResult.failed === 0 ? 'border-green-500' : 'border-yellow-500'}`}>
              <div className="font-bold mb-2">{reportResult.failed === 0 ? '✅' : '⚠️'} Versand abgeschlossen</div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="text-xl font-bold text-green-600">{reportResult.sent}</div>
                  <div className="text-[10px] text-gray-500">Gesendet</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-400">{reportResult.skipped}</div>
                  <div className="text-[10px] text-gray-500">Übersprungen</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600">{reportResult.failed}</div>
                  <div className="text-[10px] text-gray-500">Fehlgeschlagen</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Übersprungen = keine Buchungen in diesem Monat
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── SMTP-Einstellungen ── */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-bold text-tennis-dark">SMTP-Server</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Host *</label>
                <input value={settings.email_host}
                  onChange={e => setSettings(s => ({ ...s, email_host: e.target.value }))}
                  className="input-field text-sm" placeholder="smtp.example.de" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Port</label>
                <input value={settings.email_port}
                  onChange={e => setSettings(s => ({ ...s, email_port: e.target.value }))}
                  className="input-field text-sm" placeholder="587" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Benutzername *</label>
              <input value={settings.email_user}
                onChange={e => setSettings(s => ({ ...s, email_user: e.target.value }))}
                className="input-field text-sm" placeholder="getraenke@tv-bruvi.de" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Passwort *</label>
              <input type="password" value={settings.email_pass}
                onChange={e => setSettings(s => ({ ...s, email_pass: e.target.value }))}
                className="input-field text-sm" placeholder="••••••••" />
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="font-bold text-tennis-dark">Absender</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Absender-Name</label>
              <input value={settings.email_from_name}
                onChange={e => setSettings(s => ({ ...s, email_from_name: e.target.value }))}
                className="input-field text-sm" placeholder="TV Bruvi" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Absender-Adresse (leer = Benutzername)</label>
              <input value={settings.email_from}
                onChange={e => setSettings(s => ({ ...s, email_from: e.target.value }))}
                className="input-field text-sm" placeholder="getraenke@tv-bruvi.de" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Antwort-an (optional)</label>
              <input value={settings.email_reply_to}
                onChange={e => setSettings(s => ({ ...s, email_reply_to: e.target.value }))}
                className="input-field text-sm" placeholder="kassenwart@tv-bruvi.de" />
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={saving}
            className="btn-primary text-sm">
            {saving ? 'Speichere...' : saved ? '✅ Gespeichert' : '💾 Einstellungen speichern'}
          </button>

          {/* Test */}
          <div className="card space-y-2">
            <h3 className="font-bold text-tennis-dark text-sm">🧪 Test-E-Mail</h3>
            <div className="flex gap-2">
              <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                className="input-field text-sm flex-1" placeholder="deine@email.de" />
              <button onClick={handleTestEmail} className="btn-secondary text-sm whitespace-nowrap">Senden</button>
            </div>
            {testResult && <p className="text-xs text-gray-600">{testResult}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
