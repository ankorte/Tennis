import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

interface SepaSettings {
  sepa_creditor_name: string
  sepa_creditor_iban: string
  sepa_creditor_bic: string
  sepa_creditor_id: string
  sepa_sequence_type: string
}

interface MissingIban {
  name: string
  member_number: string
  amount: number
}

const EMPTY_SETTINGS: SepaSettings = {
  sepa_creditor_name: '',
  sepa_creditor_iban: '',
  sepa_creditor_bic: '',
  sepa_creditor_id: '',
  sepa_sequence_type: 'RCUR',
}

export default function SepaPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<SepaSettings>(EMPTY_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Generierung
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [collectionDate, setCollectionDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14) // 14 Tage Vorlauf
    return d.toISOString().split('T')[0]
  })
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{
    included: number
    excluded: number
    total_amount: number
    missing_iban: MissingIban[]
    xml: string
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/sepa/settings').then(r => {
      if (r.data && typeof r.data === 'object') {
        setSettings({ ...EMPTY_SETTINGS, ...r.data })
      }
    }).catch(() => {})
  }, [])

  const handleSaveSettings = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await api.put('/sepa/settings', settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const res = await api.post('/sepa/generate', {
        period_from: from,
        period_to: to,
        collection_date: collectionDate,
      })
      setResult(res.data)
    } catch (e: any) {
      const data = e.response?.data
      setError(data?.error || 'Fehler bei der SEPA-Generierung')
      if (data?.missing) setError(prev => prev + '\n\nFehlende IBAN:\n' + data.missing.join('\n'))
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!result?.xml) return
    const blob = new Blob([result.xml], { type: 'application/xml; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sepa-lastschrift-${from}-${to}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-tennis-dark">🏦 SEPA Datei erstellen</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Erzeugt eine XML-Datei im Format pain.008.001.02 für das SEPA-Lastschriftverfahren.
      </p>

      {/* Gläubiger-Einstellungen */}
      <div className="card mb-6">
        <h3 className="font-bold text-tennis-dark mb-3 flex items-center gap-2">
          <span className="text-lg">⚙️</span> Gläubiger-Daten (Verein)
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Name des Vereins *</label>
            <input value={settings.sepa_creditor_name}
              onChange={e => setSettings({ ...settings, sepa_creditor_name: e.target.value })}
              className="input-field" placeholder="TV Bruchhausen-Vilsen v. 1863 e.V." />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">IBAN des Vereins *</label>
            <input value={settings.sepa_creditor_iban}
              onChange={e => setSettings({ ...settings, sepa_creditor_iban: e.target.value.toUpperCase() })}
              className="input-field font-mono" placeholder="DE89 3704 0044 0532 0130 00" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">BIC des Vereins *</label>
            <input value={settings.sepa_creditor_bic}
              onChange={e => setSettings({ ...settings, sepa_creditor_bic: e.target.value.toUpperCase() })}
              className="input-field font-mono" placeholder="COBADEFFXXX" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Gläubiger-ID *</label>
            <input value={settings.sepa_creditor_id}
              onChange={e => setSettings({ ...settings, sepa_creditor_id: e.target.value })}
              className="input-field font-mono" placeholder="DE98ZZZ09999999999" />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Wird von der Bundesbank vergeben. Format: DE + 2 Prüfziffern + ZZZ + 8-stellige Nummer
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Lastschrift-Typ</label>
            <select value={settings.sepa_sequence_type}
              onChange={e => setSettings({ ...settings, sepa_sequence_type: e.target.value })}
              className="input-field">
              <option value="FRST">FRST – Erstlastschrift</option>
              <option value="RCUR">RCUR – Folgelastschrift</option>
              <option value="OOFF">OOFF – Einmalige Lastschrift</option>
              <option value="FNAL">FNAL – Letzte Lastschrift</option>
            </select>
          </div>
          <button onClick={handleSaveSettings} disabled={saving}
            className="btn-primary text-sm">
            {saving ? 'Speichere...' : saved ? '✅ Gespeichert' : '💾 Einstellungen speichern'}
          </button>
        </div>
      </div>

      {/* SEPA-Datei generieren */}
      <div className="card mb-6">
        <h3 className="font-bold text-tennis-dark mb-3 flex items-center gap-2">
          <span className="text-lg">📄</span> Lastschriftdatei erzeugen
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500">Zeitraum von</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Zeitraum bis</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Einzugsdatum (Fälligkeitstag)</label>
            <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className="input-field" />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Mind. 5 Bankarbeitstage in der Zukunft (FRST: 5 Tage, RCUR: 2 Tage)
            </p>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="btn-primary">
            {generating ? 'Generiere...' : '🏦 SEPA-Datei erstellen'}
          </button>
        </div>
      </div>

      {/* Fehler */}
      {error && (
        <div className="card border-l-4 border-red-500 mb-4">
          <div className="font-bold text-red-700 mb-1">❌ Fehler</div>
          <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* Ergebnis */}
      {result && (
        <div className="space-y-4">
          <div className="card border-l-4 border-green-500">
            <div className="font-bold text-green-700 mb-2">✅ SEPA-Datei erfolgreich erstellt</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Enthaltene Lastschriften:</span>
                <span className="font-bold ml-1">{result.included}</span>
              </div>
              <div>
                <span className="text-gray-500">Gesamtbetrag:</span>
                <span className="font-bold ml-1">{result.total_amount.toFixed(2)} €</span>
              </div>
            </div>
            <button onClick={handleDownload}
              className="btn-primary mt-3 text-sm">
              📥 XML-Datei herunterladen
            </button>
          </div>

          {/* Fehlende IBANs */}
          {result.missing_iban.length > 0 && (
            <div className="card border-l-4 border-yellow-500">
              <div className="font-bold text-yellow-700 mb-2">
                ⚠️ {result.excluded} Mitglieder ohne IBAN (nicht enthalten)
              </div>
              <div className="space-y-1">
                {result.missing_iban.map((m, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span className="text-gray-700">{m.name} <span className="text-gray-400">({m.member_number})</span></span>
                    <span className="font-bold text-yellow-700">{m.amount.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Bitte IBAN unter Mitglieder → Bearbeiten hinterlegen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
