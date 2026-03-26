import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import type { Booking } from '../types'
import { STATUS_COLORS, CATEGORY_LABELS } from '../types'

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

export default function BookingsAdminPage() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(30)

  const load = () => api.get('/bookings').then(r => {
    if (Array.isArray(r.data)) setBookings(r.data)
  }).catch(() => {})
  useEffect(() => { load() }, [])

  const handleCancel = async (id: number) => {
    if (!confirm('Buchung wirklich stornieren?')) return
    await api.put(`/bookings/${id}/cancel`)
    load()
  }

  const filtered = bookings.filter(b =>
    (!filter ||
      b.drink_name.toLowerCase().includes(filter.toLowerCase()) ||
      b.member_name?.toLowerCase().includes(filter.toLowerCase()) ||
      b.created_by_name?.toLowerCase().includes(filter.toLowerCase())
    ) &&
    (!statusFilter || b.status === statusFilter)
  )

  const total = filtered.filter(b => !b.cancelled).reduce((s, b) => s + b.total_price, 0)
  // Fremdbuchungen zählen
  const fremdCount = filtered.filter(b => !b.cancelled && b.member_id !== b.created_by).length

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-tennis-dark">📋 Alle Buchungen</h1>
      </div>

      <div className="card mb-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-bold text-tennis-dark">{filtered.length}</div>
          <div className="text-xs text-gray-500">Buchungen</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-tennis-green">{total.toFixed(2)} €</div>
          <div className="text-xs text-gray-500">Gesamt</div>
        </div>
        <div>
          <div className="text-2xl font-bold" style={{ color: fremdCount > 0 ? '#1D4ED8' : '#9CA3AF' }}>{fremdCount}</div>
          <div className="text-xs text-gray-500">Fremdbuchungen</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} className="input-field"
          placeholder="Name, Getränk oder Bucher suchen..." />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field">
          <option value="">Alle Status</option>
          {['bestaetigt','offen_gruppe','verteilt','storniert','abgerechnet'].map(s =>
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          )}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.slice(0, visibleCount).map(b => {
          const { date, time } = formatDateTime(b.created_at)
          const isFremd = b.member_id !== b.created_by
          return (
            <div key={b.id} className={`card ${b.cancelled ? 'opacity-50' : ''} ${isFremd ? 'border-l-4 border-blue-400' : ''}`}>
              {/* Fremdbuchungs-Banner */}
              {isFremd && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                  <span className="text-sm">👤</span>
                  Gebucht von <strong>{b.created_by_name}</strong>
                  <span className="mx-1">→</span>
                  auf Konto <strong>{b.member_name || 'Gast'}</strong>
                </div>
              )}
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-tennis-dark">{b.drink_name}</div>
                  <div className="text-sm text-gray-500">
                    {CATEGORY_LABELS[b.drink_category]} · {b.quantity}× · {b.unit_price.toFixed(2)} €
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    <span className="text-xs text-gray-400">📅 {date}</span>
                    <span className="text-xs text-gray-400">🕐 {time} Uhr</span>
                    {!isFremd && (
                      <span className="text-xs text-gray-400">👤 {b.member_name || 'Gast'}</span>
                    )}
                  </div>
                  {b.guest_note && <div className="text-xs text-gray-400 mt-0.5">{b.guest_note}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-tennis-dark">{b.total_price.toFixed(2)} €</div>
                  <span className={`badge text-xs ${STATUS_COLORS[b.status] || 'bg-gray-100'}`}>
                    {b.status === 'bestaetigt' ? 'offen' : b.status.replace('_',' ')}
                  </span>
                  {!b.cancelled && b.status !== 'storniert' && (
                    <button onClick={() => handleCancel(b.id)} className="block mt-1 text-xs text-red-600 underline">
                      Stornieren
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length > visibleCount && (
        <button onClick={() => setVisibleCount(c => c + 30)}
          className="w-full mt-3 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
          Mehr laden ({filtered.length - visibleCount} weitere)
        </button>
      )}

      {filtered.length === 0 && (
        <p className="text-gray-400 text-center py-8">Keine Buchungen gefunden</p>
      )}

      {filtered.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-400">
          {Math.min(visibleCount, filtered.length)} von {filtered.length} Buchungen
        </div>
      )}
    </div>
  )
}
