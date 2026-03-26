import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function BillingPage() {
  const navigate = useNavigate()
  const [billings, setBillings] = useState<any[]>([])
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [running, setRunning] = useState(false)
  const [tab, setTab] = useState<'run' | 'list'>('run')

  const load = () => api.get('/billing').then(r => setBillings(r.data))
  useEffect(() => { load() }, [])

  const handleRun = async () => {
    setRunning(true)
    try {
      const r = await api.post('/billing/run', { period_from: from, period_to: to })
      alert(`Abrechnung erstellt: ${r.data.count} Mitglieder`)
      load(); setTab('list')
    } catch (e: any) { alert(e.response?.data?.error || 'Fehler') }
    finally { setRunning(false) }
  }

  const handleStatus = async (id: number, status: string) => {
    await api.put(`/billing/${id}/status`, { status })
    load()
  }

  const handleExportXlsx = async () => {
    try {
      const res = await api.get(`/billing/export/xlsx?period_from=${from}&period_to=${to}`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `abrechnung-${from}-bis-${to}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Excel-Export fehlgeschlagen')
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.get(`/billing/export/csv?period_from=${from}&period_to=${to}`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'text/csv; charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `abrechnung-${from}-bis-${to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Export fehlgeschlagen')
    }
  }

  const statusColor: Record<string, string> = { offen: 'bg-yellow-100 text-yellow-800', erstellt: 'bg-blue-100 text-blue-800', bezahlt: 'bg-green-100 text-green-800', teilweise_bezahlt: 'bg-orange-100 text-orange-800' }

  const total = billings.reduce((s, b) => s + b.total_amount, 0)
  const totalOpen = billings.filter(b => b.status === 'offen').reduce((s, b) => s + b.total_amount, 0)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-tennis-dark">💶 Abrechnung</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {[['run','Abrechnungslauf'],['list','Übersicht']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 rounded-xl font-medium text-sm ${tab===k ? 'bg-tennis-green text-white' : 'bg-white border text-gray-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'run' && (
        <div className="card space-y-3">
          <h3 className="font-bold">Abrechnungszeitraum</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Von</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field" /></div>
            <div><label className="text-xs text-gray-500">Bis</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field" /></div>
          </div>
          <button onClick={handleRun} disabled={running} className="btn-primary">{running ? 'Berechne...' : '🔄 Abrechnung erstellen'}</button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleExportXlsx} className="btn-secondary text-sm">📊 Excel Export</button>
            <button onClick={handleExport} className="btn-secondary text-sm">📥 CSV Export</button>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card text-center"><div className="text-2xl font-bold text-tennis-dark">{total.toFixed(2)} €</div><div className="text-xs text-gray-500">Gesamt</div></div>
            <div className="card text-center"><div className="text-2xl font-bold text-yellow-600">{totalOpen.toFixed(2)} €</div><div className="text-xs text-gray-500">Offen</div></div>
          </div>
          <div className="space-y-2">
            {billings.map(b => (
              <div key={b.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold">{b.member_name}</div>
                    <div className="text-xs text-gray-500">{b.member_number} · {b.period_from} – {b.period_to}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-tennis-dark">{b.total_amount.toFixed(2)} €</div>
                    <span className={`badge ${statusColor[b.status]}`}>{b.status}</span>
                  </div>
                </div>
                {b.status !== 'bezahlt' && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleStatus(b.id, 'bezahlt')} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg">Bezahlt</button>
                    <button onClick={() => handleStatus(b.id, 'teilweise_bezahlt')} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg">Teilw. bezahlt</button>
                  </div>
                )}
              </div>
            ))}
            {billings.length === 0 && <p className="text-center text-gray-500 py-8">Keine Abrechnungen vorhanden</p>}
          </div>
        </>
      )}
    </div>
  )
}
