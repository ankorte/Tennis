import { useEffect, useState } from 'react'
import api from '../api'
import { CATEGORY_LABELS } from '../types'

interface CartMember {
  member_id: number
  member_name: string
  member_number: string
  item_count: number
  total_price: number
  last_updated: string
  items: {
    drink_id: number
    name: string
    category: string
    price: number
    quantity: number
    unit: string
    updated_at: string
  }[]
}

export default function AdminCartsPage() {
  const [carts, setCarts] = useState<CartMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = () => {
    setLoading(true)
    api.get('/cart/all').then(r => {
      if (Array.isArray(r.data)) setCarts(r.data)
      setLastRefresh(new Date())
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const grandTotal = carts.reduce((s, c) => s + c.total_price, 0)
  const totalItems = carts.reduce((s, c) => s + c.item_count, 0)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-tennis-dark">🛒 Offene Warenkörbe</h1>
        <button onClick={load} className="text-sm text-tennis-dark underline">Aktualisieren</button>
      </div>

      {/* Zusammenfassung */}
      <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
        <div className="flex justify-between items-center text-white">
          <div>
            <div className="text-sm text-white/70">Gesamt in Warenkörben</div>
            <div className="text-3xl font-bold mt-0.5">{grandTotal.toFixed(2)} €</div>
            <div className="text-xs text-white/50 mt-1">
              {carts.length} Mitglied{carts.length !== 1 ? 'er' : ''} · {totalItems} Position{totalItems !== 1 ? 'en' : ''}
            </div>
          </div>
          <div className="text-5xl">🛒</div>
        </div>
      </div>

      <div className="text-xs text-gray-400 mb-3 text-right">
        Stand: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Lade...</div>
      ) : carts.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <div className="text-5xl mb-3">✅</div>
          <div className="font-medium">Keine offenen Warenkörbe</div>
        </div>
      ) : (
        <div className="space-y-2">
          {carts.map(cart => {
            const isOpen = expanded.has(cart.member_id)
            const lastUpd = new Date(cart.last_updated)
            const minutesAgo = Math.floor((Date.now() - lastUpd.getTime()) / 60000)
            const timeLabel = minutesAgo < 1
              ? 'gerade eben'
              : minutesAgo < 60
              ? `vor ${minutesAgo} Min.`
              : lastUpd.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'

            return (
              <div key={cart.member_id} className="card overflow-hidden">
                {/* Header – immer sichtbar */}
                <button
                  className="w-full flex items-center justify-between gap-3"
                  onClick={() => toggleExpand(cart.member_id)}
                >
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-bold text-tennis-dark leading-tight">{cart.member_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      #{cart.member_number} · {cart.item_count} Position{cart.item_count !== 1 ? 'en' : ''} · {timeLabel}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-tennis-dark">{cart.total_price.toFixed(2)} €</div>
                    <div className="text-xs text-gray-400">{isOpen ? '▲' : '▼'} Details</div>
                  </div>
                </button>

                {/* Detail-Positionen */}
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    {cart.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-gray-400 ml-1.5">{CATEGORY_LABELS[item.category]}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-600">{item.quantity}×</span>
                          <span className="font-bold text-tennis-dark ml-2">
                            {(item.price * item.quantity).toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-sm">
                      <span>Summe</span>
                      <span className="text-tennis-dark">{cart.total_price.toFixed(2)} €</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
