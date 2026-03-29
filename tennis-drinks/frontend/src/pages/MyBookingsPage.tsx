import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import type { Booking } from '../types'
import { STATUS_COLORS, CATEGORY_LABELS } from '../types'
import ConfirmModal from '../components/ConfirmModal'

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr)
  return {
    date: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  }
}

interface MyStats {
  thisMonth: { qty: number; total: number }
  avgPerWeek: number
  favorite: { name: string; qty: number } | null
  weeks: { week: string; qty: number; total: number }[]
}

function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton h-4 w-2/3 mb-2" />
      <div className="skeleton h-3 w-1/2 mb-3" />
      <div className="flex justify-between">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-5 w-16" />
      </div>
    </div>
  )
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
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null)

  const canCancel = (b: Booking) => {
    if (b.cancelled || b.status === 'abgerechnet' || b.status === 'storniert') return false
    return Date.now() - new Date(b.created_at).getTime() < 30 * 60 * 1000
  }

  const doCancel = async (b: Booking) => {
    setConfirmCancel(null)
    setCancellingId(b.id)
    try {
      await api.put(`/bookings/${b.id}/cancel`)
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

  const handlePrint = () => window.print()

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

  if (loading) return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="skeleton h-8 w-40 mb-4" />
      <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
        <div className="skeleton h-8 w-32 mb-2" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="skeleton h-4 w-24" style={{ background: 'rgba(255,255,255,0.15)' }} />
      </div>
      {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
    </div>
  )

  const openBookings = bookings.filter(b => !b.cancelled && b.status !== 'abgerechnet')
  const maxWeekQty = stats ? Math.max(...stats.weeks.map(w => w.qty), 1) : 1

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {confirmCancel && (
        <ConfirmModal
          title="Buchung stornieren?"
          message={`${confirmCancel.quantity}× ${confirmCancel.drink_name}\n${confirmCancel.total_price.toFixed(2)} €`}
          confirmLabel="Stornieren"
          danger
          onConfirm={() => doCancel(confirmCancel)}
          onCancel={() => setConfirmCancel(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 no-print">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="text-2xl font-bold text-tennis-dark">💳 Meine Karte</h1>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-tennis-dark border border-gray-200 rounded-xl px-3 py-1.5 transition-colors">
          🖨️ Drucken
        </button>
      </div>

      {/* Print-Kopfzeile (nur beim Drucken) */}
      <div className="print-only hidden mb-4 pb-3 border-b">
        <div className="text-xl font-bold">TV Bruvi – Meine Buchungen</div>
        <div className="text-sm text-gray-600">{user?.first_name} {user?.last_name} · {new Date().toLocaleDateString('de-DE')}</div>
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
        <div className="mb-4 no-print">
          <button onClick={() => setShowStats(!showStats)}
            className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            📊 Meine Statistik {showStats ? '▲' : '▼'}
          </button>
          {showStats && (
            <div className="card space-y-3">
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
              {stats.favorite && (
                <div className="text-center text-sm text-gray-500">
                  ❤️ Lieblingsgetränk: <strong className="text-tennis-dark">{stats.favorite.name}</strong>
                  <span className="text-gray-400 ml-1">({stats.favorite.qty}×)</span>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-400 mb-1.5">Letzte 8 Wochen</div>
                <div className="flex items-end gap-1 h-16">
                  {stats.weeks.map((w, i) => {
                    const height = Math.max(4, (w.qty / maxWeekQty) * 100)
                    return (
                      <div key={w.week} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-gray-400 font-mono">{w.qty || ''}</span>
                        <div className="w-full rounded-t transition-all"
                          style={{ height: `${height}%`, background: i === stats.weeks.length - 1 ? '#1A3B8F' : '#c7d2fe', minHeight: '3px' }} />
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
            return (
              <div key={b.id} className={`card ${b.cancelled ? 'opacity-40' : ''} ${!isSelf ? 'border-l-4 border-blue-400' : ''}`}>
                {!isSelf && (
                  <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                    <span>👤</span> Gebucht von <strong>{b.created_by_name}</strong>
                  </div>
                )}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-tennis-dark leading-tight">{b.drink_name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{CATEGORY_LABELS[b.drink_category]} · {b.quantity}×</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                      <span className="text-xs text-gray-400">📅 {date}</span>
                      <span className="text-xs text-gray-400">🕐 {time} Uhr</span>
                    </div>
                    {(b as any).guest_note && (
                      <div className="text-xs text-gray-500 mt-1 italic">📝 {(b as any).guest_note}</div>
                    )}
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
                    onClick={() => setConfirmCancel(b)}
                    disabled={cancellingId === b.id}
                    className="mt-2 w-full text-center py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 no-print">
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
          className="w-full mt-3 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors no-print">
          Mehr laden ({bookings.length - visibleCount} weitere)
        </button>
      )}

      {bookings.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-400 no-print">
          {Math.min(visibleCount, bookings.length)} von {bookings.length} Buchung{bookings.length !== 1 ? 'en' : ''}
        </div>
      )}
    </div>
  )
}
