import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import type { Booking } from '../types'
import { STATUS_COLORS, CATEGORY_LABELS } from '../types'

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

interface MyStats {
  thisMonth: { qty: number; total: number }
  avgPerWeek: number
  favorite: { name: string; qty: number } | null
  weeks: { week: string; qty: number; total: number }[]
}

export default function MyBookingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [balance, setBalance] = useState(0)
  const [stats, setStats] = useState<MyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStats, setShowStats] = useState(true)
  const [visibleCount, setVisibleCount] = useState(20)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const canCancel = (b: Booking) => {
    if (b.cancelled || b.status === 'abgerechnet' || b.status === 'storniert') return false
    // Innerhalb von 30 Minuten stornierbar
    const age = Date.now() - new Date(b.created_at).getTime()
    return age < 30 * 60 * 1000
  }

  const handleCancel = async (b: Booking) => {
    if (!window.confirm(`${b.quantity}× ${b.drink_name} (${b.total_price.toFixed(2)} €) stornieren?`)) return
    setCancellingId(b.id)
    try {
      await api.put(`/bookings/${b.id}/cancel`)
      // Buchungsliste und Balance neu laden
      const [bRes, balRes] = await Promise.all([
        api.get(`/bookings?member_id=${user!.id}`).catch(() => ({ data: [] })),
        api.get(`/members/${user!.id}/balance`).catch(() => ({ data: { open_amount: 0 } })),
      ])
      if (Array.isArray(bRes.data)) setBookings(bRes.data)
      setBalance(balRes.data?.open_amount ?? 0)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Stornierung fehlgeschlagen')
    } finally { setCancellingId(null) }
  }

  useEffect(() => {
    Promise.all([
      api.get(`/bookings?member_id=${user!.id}`).catch(() => ({ data: [] })),
      api.get(`/members/${user!.id}/balance`).catch(() => ({ data: { open_amount: 0 } })),
      api.get('/bookings/my-stats').catch(() => ({ data: null })),
    ]).then(([b, bal, s]) => {
      if (Array.isArray(b.data)) setBookings(b.data)
      setBalance(bal.data?.open_amount ?? 0)
      if (s.data && typeof s.data === 'object' && s.data.weeks) setStats(s.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 text-center text-gray-500">Lade...</div>

  const openBookings = bookings.filter(b => !b.cancelled && b.status !== 'abgerechnet')
  const maxWeekQty = stats ? Math.max(...stats.weeks.map(w => w.qty), 1) : 1

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-tennis-dark">💳 Meine Karte</h1>
      </div>

      {/* Kontostand */}
      <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-white/70">Offener Betrag</div>
            <div className="text-3xl font-bold text-white mt-0.5">{balance.toFixed(2)} €</div>
            <div className="text-xs text-white/50 mt-1">{openBookings.length} offene Buchung{openBookings.length !== 1 ? 'en' : ''}</div>
          </div>
          <div className="text-5xl">💳</div>
        </div>
      </div>

      {/* Statistik */}
      {stats && (
        <div className="mb-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            📊 Meine Statistik {showStats ? '▲' : '▼'}
          </button>
          {showStats && (
            <div className="card space-y-3">
              {/* Kennzahlen */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-black text-tennis-dark">{stats.thisMonth.qty}</div>
                  <div className="text-[10px] text-gray-400">diesen Monat</div>
                </div>
                <div>
                  <div className="text-lg font-black text-tennis-dark">{stats.avgPerWeek}</div>
                  <div className="text-[10px] text-gray-400">Ø pro Woche</div>
                </div>
                <div>
                  <div className="text-lg font-black text-tennis-dark">{stats.thisMonth.total.toFixed(0)} €</div>
                  <div className="text-[10px] text-gray-400">diesen Monat</div>
                </div>
              </div>

              {/* Lieblingsgetränk */}
              {stats.favorite && (
                <div className="text-center text-sm text-gray-500">
                  ❤️ Lieblingsgetränk: <strong className="text-tennis-dark">{stats.favorite.name}</strong>
                  <span className="text-gray-400 ml-1">({stats.favorite.qty}×)</span>
                </div>
              )}

              {/* Wochen-Chart */}
              <div>
                <div className="text-xs text-gray-400 mb-1.5">Letzte 8 Wochen</div>
                <div className="flex items-end gap-1 h-16">
                  {stats.weeks.map((w, i) => {
                    const height = maxWeekQty > 0 ? Math.max(4, (w.qty / maxWeekQty) * 100) : 4
                    const isLast = i === stats.weeks.length - 1
                    return (
                      <div key={w.week} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-gray-400 font-mono">{w.qty || ''}</span>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${height}%`,
                            background: isLast ? '#1A3B8F' : '#c7d2fe',
                            minHeight: '3px',
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buchungsliste */}
      {bookings.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Noch keine Buchungen</p>
      ) : (
        <div className="space-y-2">
          {bookings.slice(0, visibleCount).map(b => {
            const { date, time } = formatDateTime(b.created_at)
            const isSelf = b.created_by === user!.id
            const bookedForOther = b.member_id !== b.created_by
            return (
              <div key={b.id} className={`card ${b.cancelled ? 'opacity-40' : ''} ${!isSelf ? 'border-l-4 border-blue-400' : ''}`}>
                {/* Fremdbuchungs-Banner */}
                {!isSelf && (
                  <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                    <span className="text-sm">👤</span>
                    Gebucht von <strong>{b.created_by_name}</strong>
                  </div>
                )}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-tennis-dark leading-tight">{b.drink_name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {CATEGORY_LABELS[b.drink_category]} · {b.quantity}×
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                      <span className="text-xs text-gray-400">📅 {date}</span>
                      <span className="text-xs text-gray-400">🕐 {time} Uhr</span>
                      {isSelf && <span className="text-xs text-gray-400">👤 Selbst gebucht</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-tennis-dark">{b.total_price.toFixed(2)} €</div>
                    <span className={`badge text-xs ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-800'}`}>
                      {b.cancelled ? 'storniert' : b.status === 'bestaetigt' ? 'offen' : b.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {canCancel(b) && (
                  <button
                    onClick={() => handleCancel(b)}
                    disabled={cancellingId === b.id}
                    className="mt-2 w-full text-center py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50">
                    {cancellingId === b.id ? '⏳ Wird storniert...' : '↩️ Stornieren (30 Min)'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {bookings.length > visibleCount && (
        <button onClick={() => setVisibleCount(c => c + 20)}
          className="w-full mt-3 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
          Mehr laden ({bookings.length - visibleCount} weitere)
        </button>
      )}

      {bookings.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-400">
          {Math.min(visibleCount, bookings.length)} von {bookings.length} Buchung{bookings.length !== 1 ? 'en' : ''}
        </div>
      )}
    </div>
  )
}
