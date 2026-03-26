import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import api from '../api'

type Tab = 'bestand' | 'mitglieder'

interface StockRow { article_number?: string; name?: string; new_stock: number; comment?: string }
interface MemberRow { member_number: string; first_name: string; last_name: string; email?: string; phone?: string; status?: string; role?: string; team?: string; pin?: string }

// Normalize header names from various Excel column names
function normalizeStockRow(raw: Record<string, any>): StockRow | null {
  const keys = Object.keys(raw).map(k => k.trim())
  const get = (aliases: string[]) => {
    for (const a of aliases) {
      const k = keys.find(k => k.toLowerCase() === a.toLowerCase())
      if (k !== undefined && raw[k] !== undefined && raw[k] !== '') return raw[k]
    }
    return undefined
  }
  const article_number = get(['artikelnummer', 'article_number', 'artikel', 'nr', 'artikelnr'])
  const name = get(['name', 'bezeichnung', 'artikel'])
  const new_stock = get(['bestand', 'new_stock', 'menge', 'anzahl', 'lagerbestand', 'neuer bestand'])
  const comment = get(['kommentar', 'comment', 'bemerkung', 'notiz'])
  if (new_stock == null) return null
  const stockNum = parseInt(String(new_stock))
  if (isNaN(stockNum)) return null
  return { article_number: article_number ? String(article_number).trim() : undefined, name: name ? String(name).trim() : undefined, new_stock: stockNum, comment: comment ? String(comment).trim() : undefined }
}

function normalizeMemberRow(raw: Record<string, any>): MemberRow | null {
  const keys = Object.keys(raw)
  const get = (aliases: string[]) => {
    for (const a of aliases) {
      const k = keys.find(k => k.trim().toLowerCase() === a.toLowerCase())
      if (k !== undefined && raw[k] !== undefined && raw[k] !== '') return String(raw[k]).trim()
    }
    return undefined
  }
  const member_number = get(['mitgliedsnummer', 'member_number', 'mitgliedsnr', 'nr', 'nummer', 'id'])
  const first_name = get(['vorname', 'first_name', 'firstname'])
  const last_name = get(['nachname', 'last_name', 'lastname', 'familienname'])
  const email = get(['email', 'e-mail', 'mail'])
  if (!member_number || !first_name || !last_name) return null
  return {
    member_number, first_name, last_name, email: email || undefined,
    phone: get(['telefon', 'phone', 'tel', 'handy', 'mobil']),
    status: get(['status']),
    role: get(['rolle', 'role']),
    team: get(['mannschaft', 'team', 'gruppe', 'sparte']),
    pin: get(['pin', 'passwort', 'password', 'kennwort']),
  }
}

function parseExcel(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(rows as Record<string, any>[])
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('bestand')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Stock import
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [stockFile, setStockFile] = useState<string>('')
  const [stockResult, setStockResult] = useState<any>(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')

  // Member import
  const [memberRows, setMemberRows] = useState<MemberRow[]>([])
  const [memberFile, setMemberFile] = useState<string>('')
  const [memberResult, setMemberResult] = useState<any>(null)
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberError, setMemberError] = useState('')

  const handleStockFile = async (file: File) => {
    setStockError(''); setStockResult(null)
    setStockFile(file.name)
    try {
      const raw = await parseExcel(file)
      const rows = raw.map(normalizeStockRow).filter(Boolean) as StockRow[]
      if (!rows.length) { setStockError('Keine verwertbaren Zeilen gefunden. Prüfe die Spaltenüberschriften.'); return }
      setStockRows(rows)
    } catch { setStockError('Datei konnte nicht gelesen werden.') }
  }

  const handleMemberFile = async (file: File) => {
    setMemberError(''); setMemberResult(null)
    setMemberFile(file.name)
    try {
      const raw = await parseExcel(file)
      const rows = raw.map(normalizeMemberRow).filter(Boolean) as MemberRow[]
      if (!rows.length) { setMemberError('Keine verwertbaren Zeilen gefunden. Prüfe die Spaltenüberschriften.'); return }
      setMemberRows(rows)
    } catch { setMemberError('Datei konnte nicht gelesen werden.') }
  }

  const handleStockImport = async () => {
    setStockLoading(true)
    try {
      const r = await api.post('/inventory/import', { items: stockRows })
      setStockResult(r.data)
      setStockRows([])
      setStockFile('')
    } catch (e: any) {
      setStockError(e.response?.data?.error || 'Import fehlgeschlagen')
    } finally { setStockLoading(false) }
  }

  const handleMemberImport = async () => {
    setMemberLoading(true)
    try {
      const r = await api.post('/members/import', { members: memberRows })
      setMemberResult(r.data)
      setMemberRows([])
      setMemberFile('')
    } catch (e: any) {
      setMemberError(e.response?.data?.error || 'Import fehlgeschlagen')
    } finally { setMemberLoading(false) }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-tennis-dark mb-4">📥 Excel Import</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('bestand')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === 'bestand' ? 'bg-tennis-green text-white' : 'bg-gray-100 text-gray-700'}`}>
          📦 Warenbestand
        </button>
        <button onClick={() => setTab('mitglieder')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === 'mitglieder' ? 'bg-tennis-green text-white' : 'bg-gray-100 text-gray-700'}`}>
          👤 Mitglieder
        </button>
      </div>

      {tab === 'bestand' && (
        <div className="space-y-4">
          {/* Info */}
          <div className="card bg-blue-50 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-1">📋 Excel-Format</h3>
            <p className="text-sm text-blue-700">Unterstützte Spaltenüberschriften:</p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-blue-600">
              <div><strong>Artikelnummer</strong> → Artikelnummer, Nr</div>
              <div><strong>Name</strong> → Name, Bezeichnung</div>
              <div><strong>Bestand</strong> → Bestand, Menge, Anzahl</div>
              <div><strong>Kommentar</strong> → Kommentar (optional)</div>
            </div>
            <button onClick={() => {
              const ws = XLSX.utils.aoa_to_sheet([['Artikelnummer','Name','Bestand','Kommentar'],['D001','Cola',24,'Lieferung Mai'],['D002','Fanta',18,'']])
              const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Bestand')
              XLSX.writeFile(wb, 'warenbestand_vorlage.xlsx')
            }} className="mt-3 text-xs text-blue-700 underline">⬇ Vorlage herunterladen</button>
          </div>

          {/* Upload */}
          <div className="card border-2 border-dashed border-gray-200 text-center cursor-pointer hover:border-tennis-green transition-colors"
            onClick={() => { fileInputRef.current!.value = ''; fileInputRef.current?.click() }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleStockFile(e.target.files[0])} />
            <div className="text-4xl mb-2">📂</div>
            <p className="font-medium">{stockFile || 'Excel-Datei auswählen'}</p>
            <p className="text-sm text-gray-400">.xlsx · .xls · .csv</p>
          </div>

          {stockError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{stockError}</div>}

          {/* Preview */}
          {stockRows.length > 0 && !stockResult && (
            <div className="card">
              <h3 className="font-bold mb-3">👁 Vorschau ({stockRows.length} Zeilen)</h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-gray-500">
                    <th className="pb-1">Artikel</th><th className="pb-1">Neuer Bestand</th><th className="pb-1">Kommentar</th>
                  </tr></thead>
                  <tbody>
                    {stockRows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">{r.article_number && <span className="text-xs text-gray-400 mr-1">{r.article_number}</span>}{r.name || '—'}</td>
                        <td className="py-1 font-bold text-tennis-green">{r.new_stock}</td>
                        <td className="py-1 text-gray-400 text-xs">{r.comment || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleStockImport} disabled={stockLoading} className="btn-primary">
                  {stockLoading ? 'Importiere...' : `✓ ${stockRows.length} Artikel importieren`}
                </button>
                <button onClick={() => { setStockRows([]); setStockFile('') }} className="btn-secondary">Abbrechen</button>
              </div>
            </div>
          )}

          {/* Result */}
          {stockResult && (
            <div className="card">
              <h3 className="font-bold mb-2">✅ Import abgeschlossen</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{stockResult.imported}</div>
                  <div className="text-xs text-green-600">aktualisiert</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{stockResult.errors}</div>
                  <div className="text-xs text-red-600">Fehler</div>
                </div>
              </div>
              {stockResult.results.filter((r: any) => r.status !== 'ok').length > 0 && (
                <div className="bg-red-50 rounded-xl p-2 text-xs text-red-700">
                  {stockResult.results.filter((r: any) => r.status !== 'ok').map((r: any, i: number) => (
                    <div key={i}>⚠ {r.article_number || r.name || '?'}: {r.status}</div>
                  ))}
                </div>
              )}
              <button onClick={() => setStockResult(null)} className="btn-secondary mt-3">Weiterer Import</button>
            </div>
          )}
        </div>
      )}

      {tab === 'mitglieder' && (
        <div className="space-y-4">
          {/* Info */}
          <div className="card bg-blue-50 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-1">📋 Excel-Format</h3>
            <p className="text-sm text-blue-700">Pflichtfelder: Mitgliedsnummer, Vorname, Nachname, Email</p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-blue-600">
              <div><strong>Mitgliedsnummer</strong></div>
              <div><strong>Status</strong>: aktiv, inaktiv, gast, jugend, trainer</div>
              <div><strong>Vorname / Nachname</strong></div>
              <div><strong>Rolle</strong>: mitglied, thekenwart, kassenwart</div>
              <div><strong>Email</strong></div>
              <div><strong>PIN</strong> (Standard: letzte 4 Ziffern der Mitgliedsnr.)</div>
              <div><strong>Telefon / Mannschaft</strong> (optional)</div>
            </div>
            <button onClick={() => {
              const ws = XLSX.utils.aoa_to_sheet([
                ['Mitgliedsnummer','Vorname','Nachname','Email','Telefon','Status','Mannschaft','PIN'],
                ['M010','Hans','Meier','hans@example.de','0172-1234567','aktiv','Herren 40','1234'],
                ['M011','Petra','Schmidt','petra@example.de','','aktiv','Damen','']
              ])
              const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Mitglieder')
              XLSX.writeFile(wb, 'mitglieder_vorlage.xlsx')
            }} className="mt-3 text-xs text-blue-700 underline">⬇ Vorlage herunterladen</button>
          </div>

          {/* Upload */}
          <div className="card border-2 border-dashed border-gray-200 text-center cursor-pointer hover:border-tennis-green transition-colors"
            onClick={() => { const i = document.getElementById('member-file-input') as HTMLInputElement; i.value=''; i.click() }}>
            <input id="member-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleMemberFile(e.target.files[0])} />
            <div className="text-4xl mb-2">📂</div>
            <p className="font-medium">{memberFile || 'Excel-Datei auswählen'}</p>
            <p className="text-sm text-gray-400">.xlsx · .xls · .csv</p>
          </div>

          {memberError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{memberError}</div>}

          {/* Preview */}
          {memberRows.length > 0 && !memberResult && (
            <div className="card">
              <h3 className="font-bold mb-3">👁 Vorschau ({memberRows.length} Mitglieder)</h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-gray-500">
                    <th className="pb-1">Nr.</th><th className="pb-1">Name</th><th className="pb-1">Email</th><th className="pb-1">Team</th>
                  </tr></thead>
                  <tbody>
                    {memberRows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1 text-xs text-gray-400">{r.member_number}</td>
                        <td className="py-1 font-medium">{r.first_name} {r.last_name}</td>
                        <td className="py-1 text-xs text-gray-500">{r.email || '—'}</td>
                        <td className="py-1 text-xs text-gray-400">{r.team || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleMemberImport} disabled={memberLoading} className="btn-primary">
                  {memberLoading ? 'Importiere...' : `✓ ${memberRows.length} Mitglieder importieren`}
                </button>
                <button onClick={() => { setMemberRows([]); setMemberFile('') }} className="btn-secondary">Abbrechen</button>
              </div>
            </div>
          )}

          {/* Result */}
          {memberResult && (
            <div className="card">
              <h3 className="font-bold mb-2">✅ Import abgeschlossen</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{memberResult.created}</div>
                  <div className="text-xs text-green-600">neu angelegt</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{memberResult.updated}</div>
                  <div className="text-xs text-blue-600">aktualisiert</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{memberResult.errors}</div>
                  <div className="text-xs text-red-600">Fehler</div>
                </div>
              </div>
              {/* Show newly created members with their default PINs */}
              {memberResult.results.filter((r: any) => r.default_pin).length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-2">
                  <p className="text-xs font-bold text-yellow-800 mb-1">⚠ Standard-PINs (bitte weitergeben):</p>
                  {memberResult.results.filter((r: any) => r.default_pin).map((r: any, i: number) => (
                    <div key={i} className="text-xs text-yellow-700">{r.name} ({r.member_number}): PIN <strong>{r.default_pin}</strong></div>
                  ))}
                </div>
              )}
              {memberResult.results.filter((r: any) => !['neu angelegt','aktualisiert'].includes(r.status_result)).length > 0 && (
                <div className="bg-red-50 rounded-xl p-2 text-xs text-red-700">
                  {memberResult.results.filter((r: any) => !['neu angelegt','aktualisiert'].includes(r.status_result)).map((r: any, i: number) => (
                    <div key={i}>⚠ {r.member_number}: {r.status_result}</div>
                  ))}
                </div>
              )}
              <button onClick={() => setMemberResult(null)} className="btn-secondary mt-3">Weiterer Import</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
