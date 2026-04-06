import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import type { Booking, Member } from '../types'
import { CATEGORY_LABELS, STATUS_COLORS } from '../types'

function fmt(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function AdminKartenPage() {
  const navigate = useNavigate()

  const [members, setMembers]     = useState<Member[]>([])
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [memberId, setMemberId]   = useState<string>('')
  const [from, setFrom]           = useState<string>('')
  const [to, setTo]               = useState<string>('')
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerMsg, setTriggerMsg]         = useState('')
  const [visibleCount, setVisibleCount]     = useState(50)

  // Mitglieder laden (für Dropdown)
  useEffect(() => {
    api.get('/members').then(r => {
      if (Array.isArray(r.data)) {
        setMembers(r.data.filter((m: Member) => m.active))
      }
    }).catch(() => {})
  }, [])

  // Buchungen laden
  const load = () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (memberId) params.member_id = memberId
    if (from)     params.from      = from
    if (to)       params.to        = to
    api.get('/bookings', { params })
      .then(r => { if (Array.isArray(r.data)) setBookings(r.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // Initiales Laden aller Buchungen
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Statistiken
  const stats = useMemo(() => {
    const active = bookings.filter(b => !b.cancelled)
    const total  = active.reduce((s, b) => s + b.total_price, 0)
    const qty    = active.reduce((s, b) => s + b.quantity, 0)

    // Top-Getränk
    const drinkMap = new Map<string, { name: string; qty: number; total: number }>()
    for (const b of active) {
      const existing = drinkMap.get(b.drink_name) ?? { name: b.drink_name, qty: 0, total: 0 }
      drinkMap.set(b.drink_name, { name: b.drink_name, qty: existing.qty + b.quantity, total: existing.total + b.total_price })
    }
    const topDrink = [...drinkMap.values()].sort((a, b) => b.qty - a.qty)[0]

    return { count: active.length, total, qty, topDrink }
  }, [bookings])

  // Excel-Download
  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, string> = {}
      if (memberId) params.member_id = memberId
      if (from)     params.from      = from
      if (to)       params.to        = to
      const res = await api.get('/bookings/export', { params, responseType: 'blob' })
      const url  = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href  = url
      // Dateinamen aus Content-Disposition lesen oder Fallback
      const cd = res.headers['content-disposition'] ?? ''
      const match = cd.match(/filename="?([^"]+)"?/)
      link.download = match?.[1] ?? 'buchungen.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export fehlgeschlagen')
    } finally {
      setExporting(false)
    }
  }

  // Manueller Auto-Checkout-Trigger
  const handleTriggerAutoCheckout = async () => {
    if (!confirm('Auto-Checkout JETZT manuell auslösen? Alle offenen Warenkörbe werden sofort gebucht!')) return
    setTriggerLoading(true)
    setTriggerMsg('')
    try {
      await api.post('/auto-checkout/trigger')
      setTriggerMsg('✅ Auto-Checkout erfolgreich ausgelöst!')
      load()
    } catch {
      setTriggerMsg('❌ Fehler beim Auslösen')
    } finally {
      setTriggerLoading(false)
      setTimeout(() => setTriggerMsg(''), 5000)
    }
  }

  const selectedMember = members.find(m => String(m.id) === memberId)

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <div>
          <h1 className="text-2xl font-bold text-tennis-dark">🃏 Getränkekarten</h1>
          <p className="text-xs text-gray-400">Admin-Übersicht · Alle gebuchten Getränke</p>
        </div>
      </div>

      {/* Auto-Checkout Info-Box */}
      <div className="card mb-4 p-3" style={{ background: 'linear-gradient(135deg,#1A3B8F,#0F2566)', color: 'white' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold text-sm mb-0.5">⏰ Auto-Checkout: täglich 03:00 Uhr</div>
            <div className="text-xs opacity-80">Offene Warenkörbe werden automatisch gebucht</div>
            {triggerMsg && <div className="mt-1.5 text-xs font-medium">{triggerMsg}</div>}
          </div>
          <button
            onClick={handleTriggerAutoCheckout}
            disabled={triggerLoading}
            className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
            {triggerLoading ? '⏳' : '▶ Jetzt'}</button>
        </div>
      </div>

      {/* Filter */}
      <div className="card mb-4 p-3 space-y-3">
        <div className="font-semibold text-sm text-tennis-dark">🔍 Filter</div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Person</label>
          <select
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
            className="input-field text-sm">
            <option value="">Alle Personen</option>
            {members.map(m => (
              <option key={m.id} value={String(m.id)}>
                {m.first_name} {m.last_name} ({m.member_number})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Von</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Bis</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
            style={{ background: '#1A3B8F' }}>
            {loading ? '⏳ Laden...' : '🔍 Anzeigen'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || bookings.length === 0}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
            style={{ background: '#1a7a40' }}>
            {exporting ? '⏳ Export...' : '📥 Excel'}
          </button>
        </div>
      </div>

      {/* Statistik-Banner */}
      {selectedMember && (
        <div className="card mb-4 p-3" style={{ background: '#F0F7FF', borderLeft: '4px solid #1A3B8F' }}>
          <div className="font-bold text-tennis-dark">
            👤 {selectedMember.first_name} {selectedMember.last_name}
          </div>
          <div className="text-xs text-gray-500">#{selectedMember.member_number}</div>
        </div>
      )}

      <div className="card mb-4 grid grid-cols-3 gap-2 text-center p-3">
        <div>
          <div className="text-2xl font-black text-tennis-dark">{stats.count}</div>
          <div className="text-xs text-gray-500">Buchungen</div>
        </div>
        <div>
          <div className="text-2xl font-black text-tennis-dark">{stats.qty}</div>
          <div className="text-xs text-gray-500">Getränke</div>
        </div>
        <div>
          <div className="text-xl font-black" style={{ color: '#1a7a40' }}>{stats.total.toFixed(2)} €</div>
          <div className="text-xs text-gray-500">Gesamt</div>
        </div>
      </div>

      {stats.topDrink && (
        <div className="card mb-4 p-3 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#F0FFF4,#DCFCE7)' }}>
          <span className="text-2xl">🏅</span>
          <div>
            <div className="text-xs font-semibold text-gray-500">Meist gebucht</div>
            <div className="font-bold text-tennis-dark">{stats.topDrink.name}</div>
            <div className="text-xs text-gray-500">{stats.topDrink.qty}× · {stats.topDrink.total.toFixed(2)} €</div>
          </div>
        </div>
      )}

      {/* Buchungsliste (Karten) */}
      <div className="space-y-2">
        {bookings.slice(0, visibleCount).map(b => {
          const { date, time } = fmt(b.created_at)
          const isFremd = b.member_id !== b.created_by
          return (
            <div key={b.id}
              className={`card p-3 ${b.cancelled ? 'opacity-40' : ''}`}
              style={{ borderLeft: `4px solid ${isFremd ? '#1A3B8F' : '#1a7a40'}` }}>
              {isFremd && (
                <div className="text-xs font-semibold mb-1.5 px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                  <span>👤</span>
                  Gebucht von <strong>{b.created_by_name}</strong>
                  <span className="mx-1">→</span>
                  <strong>{b.member_name || 'Gast'}</strong>
                </div>
              )}
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-tennis-dark truncate">{b.drink_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {CATEGORY_LABELS[b.drink_category]} · {b.quantity}× · {b.unit_price.toFixed(2)} €/Stk
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    <span className="text-xs text-gray-400">📅 {date}</span>
                    <span className="text-xs text-gray-400">🕐 {time}</span>
                    {!isFremd && <span className="text-xs text-gray-400">👤 {b.member_name || 'Gast'}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-tennis-dark">{b.total_price.toFixed(2)} €</div>
                  <span className={`badge text-xs ${STATUS_COLORS[b.status] ?? 'bg-gray-100'}`}>
                    {b.status === 'bestaetigt' ? 'offen' : b.status.replace('_', ' ')}
                  </span>
                  <div className="text-xs text-gray-300 mt-0.5">#{b.id}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {bookings.length > visibleCount && (
        <button
          onClick={() => setVisibleCount(c => c + 50)}
          className="w-full mt-3 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
          Mehr laden ({bookings.length - visibleCount} weitere)
        </button>
      )}

      {!loading && bookings.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🃏</div>
          <p>Keine Buchungen gefunden</p>
        </div>
      )}

      {bookings.length > 0 && (
        <p className="text-center text-xs text-gray-300 mt-4 pb-2">
          {Math.min(visibleCount, bookings.length)} von {bookings.length} Buchungen
        </p>
      )}
    </div>
  )
}
