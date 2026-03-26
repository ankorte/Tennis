import { useEffect, useState } from 'react'
import api from '../api'
import { CATEGORY_LABELS } from '../types'

interface ClubStats {
  topDrinksMonth: { name: string; category: string; qty: number; revenue: number }[]
  months: { month: string; qty: number; revenue: number }[]
  topMembers: { name: string; qty: number; total: number }[]
  forecast: { id: number; name: string; stock: number; min_stock: number; category: string; consumed_30d: number; daily_rate: number; days_left: number | null }[]
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { month: 'short' })
}

export default function ClubStatsPage() {
  const [stats, setStats] = useState<ClubStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'drinks' | 'revenue' | 'members' | 'forecast'>('drinks')

  useEffect(() => {
    api.get('/bookings/club-stats').then(r => {
      if (r.data && typeof r.data === 'object' && Array.isArray(r.data.months)) {
        setStats(r.data)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 text-center text-gray-500">Lade Statistiken...</div>
  if (!stats) return <div className="p-4 text-center text-red-500">Fehler beim Laden</div>

  const maxMonthRevenue = Math.max(...stats.months.map(m => m.revenue), 1)
  const maxMonthQty = Math.max(...stats.months.map(m => m.qty), 1)

  // Gesamtzahlen diesen Monat
  const thisMonth = stats.months[stats.months.length - 1]
  const lastMonth = stats.months.length >= 2 ? stats.months[stats.months.length - 2] : null
  const revenueChange = lastMonth && lastMonth.revenue > 0
    ? Math.round(((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100)
    : null

  // Kritische Bestände
  const critical = stats.forecast.filter(f => f.days_left !== null && f.days_left <= 7)
  const warning = stats.forecast.filter(f => f.days_left !== null && f.days_left > 7 && f.days_left <= 21)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-tennis-dark mb-2">📊 Vereinsstatistik</h1>

      {/* Kennzahlen-Karten */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card text-center py-3">
          <div className="text-xl font-black text-tennis-dark">{thisMonth.qty}</div>
          <div className="text-[10px] text-gray-400">Getränke d. Monat</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-xl font-black text-tennis-dark">{thisMonth.revenue.toFixed(0)} €</div>
          <div className="text-[10px] text-gray-400">Umsatz d. Monat</div>
        </div>
        <div className="card text-center py-3">
          <div className={`text-xl font-black ${critical.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {critical.length}
          </div>
          <div className="text-[10px] text-gray-400">Kritisch (≤7 T.)</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {([
          ['drinks', '🍺 Top Getränke'],
          ['revenue', '📈 Umsatz'],
          ['members', '👤 Aktivste'],
          ['forecast', '📦 Prognose'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
              tab === key ? 'text-white' : 'bg-gray-100 text-gray-600'
            }`}
            style={tab === key ? { background: '#1A3B8F' } : undefined}>
            {label}
          </button>
        ))}
      </div>

      {/* Top Getränke */}
      {tab === 'drinks' && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-400">Diesen Monat</h3>
          {stats.topDrinksMonth.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Noch keine Buchungen diesen Monat</p>
          ) : (
            stats.topDrinksMonth.map((d, i) => {
              const maxQty = stats.topDrinksMonth[0].qty
              const pct = maxQty > 0 ? (d.qty / maxQty) * 100 : 0
              return (
                <div key={i} className="card py-2.5">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-lg font-black text-gray-300 w-6 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-tennis-dark">{d.name}</div>
                      <div className="text-xs text-gray-400">{CATEGORY_LABELS[d.category]}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{d.qty}×</div>
                      <div className="text-xs text-gray-400">{d.revenue.toFixed(2)} €</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: '#1A3B8F' }} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Umsatz-Chart */}
      {tab === 'revenue' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-400">Letzte 12 Monate</h3>
            {revenueChange !== null && (
              <span className={`text-xs font-bold ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {revenueChange >= 0 ? '▲' : '▼'} {Math.abs(revenueChange)}% ggü. Vormonat
              </span>
            )}
          </div>

          {/* Umsatz-Balken */}
          <div className="card">
            <div className="text-xs text-gray-400 mb-2">Umsatz (€)</div>
            <div className="flex items-end gap-1 h-32">
              {stats.months.map((m, i) => {
                const pct = maxMonthRevenue > 0 ? Math.max(2, (m.revenue / maxMonthRevenue) * 100) : 2
                const isLast = i === stats.months.length - 1
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-gray-400 font-mono">
                      {m.revenue > 0 ? `${m.revenue.toFixed(0)}` : ''}
                    </span>
                    <div className="w-full rounded-t transition-all"
                      style={{ height: `${pct}%`, background: isLast ? '#1A3B8F' : '#c7d2fe', minHeight: '2px' }} />
                    <span className="text-[8px] text-gray-400">{monthLabel(m.month)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Menge-Balken */}
          <div className="card">
            <div className="text-xs text-gray-400 mb-2">Anzahl Getränke</div>
            <div className="flex items-end gap-1 h-24">
              {stats.months.map((m, i) => {
                const pct = maxMonthQty > 0 ? Math.max(2, (m.qty / maxMonthQty) * 100) : 2
                const isLast = i === stats.months.length - 1
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-gray-400 font-mono">{m.qty || ''}</span>
                    <div className="w-full rounded-t transition-all"
                      style={{ height: `${pct}%`, background: isLast ? '#E8002D' : '#fecaca', minHeight: '2px' }} />
                    <span className="text-[8px] text-gray-400">{monthLabel(m.month)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Aktivste Mitglieder */}
      {tab === 'members' && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-400">Diesen Monat</h3>
          {stats.topMembers.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Noch keine Buchungen</p>
          ) : (
            stats.topMembers.map((m, i) => (
              <div key={i} className="card py-2.5 flex items-center gap-3">
                <span className="text-lg font-black text-gray-300 w-6 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="font-bold text-sm text-tennis-dark">{m.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{m.qty}×</div>
                  <div className="text-xs text-gray-400">{m.total.toFixed(2)} €</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bestandsprognose */}
      {tab === 'forecast' && (
        <div className="space-y-3">
          {critical.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-red-600 mb-2">🚨 Kritisch (≤ 7 Tage)</h3>
              <div className="space-y-1.5">
                {critical.map(f => (
                  <div key={f.id} className="card py-2.5 border-l-4 border-red-500">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm">{f.name}</div>
                        <div className="text-xs text-gray-400">{f.daily_rate} / Tag · Bestand: {f.stock}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-red-600 text-lg">{f.days_left} T.</div>
                        <div className="text-[10px] text-gray-400">verbleibend</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {warning.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-yellow-600 mb-2">⚠️ Achtung (≤ 3 Wochen)</h3>
              <div className="space-y-1.5">
                {warning.map(f => (
                  <div key={f.id} className="card py-2.5 border-l-4 border-yellow-400">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm">{f.name}</div>
                        <div className="text-xs text-gray-400">{f.daily_rate} / Tag · Bestand: {f.stock}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-yellow-600 text-lg">{f.days_left} T.</div>
                        <div className="text-[10px] text-gray-400">verbleibend</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-gray-400 mb-2">📦 Alle Getränke – Verbrauchsprognose</h3>
            <div className="space-y-1.5">
              {stats.forecast.map(f => (
                <div key={f.id} className="card py-2 flex items-center gap-3">
                  <div className="text-lg">{CATEGORY_LABELS[f.category]?.split(' ')[0] || '🍹'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-tennis-dark truncate">{f.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {f.daily_rate} / Tag · {f.consumed_30d} in 30 T.
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-sm">{f.stock}</div>
                    <div className={`text-[10px] font-bold ${
                      f.days_left === null ? 'text-gray-300'
                        : f.days_left <= 7 ? 'text-red-600'
                        : f.days_left <= 21 ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}>
                      {f.days_left === null ? 'kein Verbr.' : `~${f.days_left} Tage`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
