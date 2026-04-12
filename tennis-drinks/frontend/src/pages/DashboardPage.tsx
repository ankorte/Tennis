import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../components/Toast'
import api from '../api'
import { CATEGORY_LABELS } from '../types'

interface FavDrink {
  id: number; name: string; category: string; price: number; stock: number; unit: string; active: number; total_qty: number
}

export default function DashboardPage() {
  const { user, isThekenwart, isKassenwart } = useAuth()
  const { addItem } = useCart()
  const { showToast } = useToast()
  const [balance, setBalance] = useState<number>(0)
  const [dashboard, setDashboard] = useState<any>(null)
  const [lowStock, setLowStock] = useState<any[]>([])
  const [favorites, setFavorites] = useState<FavDrink[]>([])
  const [addedId, setAddedId] = useState<number | null>(null)
  const [lastBooking, setLastBooking] = useState<{ drink_name: string; quantity: number; total_price: number; created_at: string } | null>(null)

  useEffect(() => {
    api.get(`/members/${user!.id}/balance`).then(r => setBalance(r.data?.open_amount ?? 0)).catch(() => showToast('Kontostand konnte nicht geladen werden'))
    api.get('/bookings/favorites').then(r => {
      if (Array.isArray(r.data)) setFavorites(r.data)
    }).catch(() => {})
    // Letzte Buchung laden
    api.get(`/bookings?member_id=${user!.id}`).then(r => {
      if (Array.isArray(r.data) && r.data.length > 0) {
        const latest = r.data[0]
        setLastBooking({ drink_name: latest.drink_name, quantity: latest.quantity, total_price: latest.total_price, created_at: latest.created_at })
      }
    }).catch(() => {})
    if (isThekenwart) {
      api.get('/billing/dashboard').then(r => { if (r.data && typeof r.data === 'object') setDashboard(r.data) }).catch(() => showToast('Dashboard-Daten nicht verfügbar'))
      api.get('/inventory/low-stock').then(r => { if (Array.isArray(r.data)) setLowStock(r.data) }).catch(() => {})
    }
  }, [])

  const handleQuickAdd = (fav: FavDrink) => {
    if (fav.stock <= 0) return
    addItem({ id: fav.id, name: fav.name, category: fav.category, price: fav.price, stock: fav.stock, unit: fav.unit, active: fav.active, article_number: '', min_stock: 0 })
    setAddedId(fav.id)
    setTimeout(() => setAddedId(null), 1200)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="mt-2 mb-6">
        <h2 className="text-xl font-bold text-tennis-dark">Hallo, {user?.first_name}! 👋</h2>
        <p className="text-gray-500 text-sm">{user?.team || 'TV Bruvi – Sparte Tennis'}</p>
      </div>

      {/* Favoriten – Schnellbuchung */}
      {favorites.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">⚡ Schnellbuchung</h3>
          <div className="grid grid-cols-3 gap-2">
            {favorites.map(fav => (
              <button
                key={fav.id}
                onClick={() => handleQuickAdd(fav)}
                disabled={fav.stock <= 0}
                className={`card text-center py-3 transition-all active:scale-95 ${
                  addedId === fav.id ? 'ring-2 ring-tennis-green bg-green-50' : ''
                } ${fav.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg'}`}
              >
                <div className="text-2xl mb-1">
                  {addedId === fav.id ? '✅' : (CATEGORY_LABELS[fav.category]?.split(' ')[0] || '🍺')}
                </div>
                <div className="font-bold text-xs text-tennis-dark leading-tight truncate">{fav.name}</div>
                <div className="text-tennis-green font-bold text-sm mt-0.5">{fav.price.toFixed(2)} €</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{fav.total_qty}× bestellt</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link to="/book" className="card text-center hover:shadow-lg transition-shadow py-3">
          <div className="text-3xl mb-1">🍺</div>
          <div className="font-bold text-tennis-dark text-sm">Getränk eintragen</div>
        </Link>
        <Link to="/my-bookings" className="card text-center hover:shadow-lg transition-shadow py-3">
          <div className="text-3xl mb-1">💳</div>
          <div className="font-bold text-tennis-dark text-sm">Meine Karte</div>
        </Link>
      </div>

      {/* Letzte Buchung */}
      {lastBooking && (
        <Link to="/my-bookings" className="card mb-4 flex items-center gap-3 hover:shadow-lg transition-shadow">
          <div className="text-2xl">🕐</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-400">Letzte Buchung</div>
            <div className="font-bold text-tennis-dark text-sm truncate">
              {lastBooking.quantity}× {lastBooking.drink_name}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-tennis-green text-sm">{lastBooking.total_price.toFixed(2)} €</div>
            <div className="text-[10px] text-gray-400">
              {new Date(lastBooking.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
            </div>
          </div>
        </Link>
      )}

      {/* Balance */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-white/70">Offener Betrag</div>
            <div className="text-3xl font-bold text-white mt-1">{balance.toFixed(2)} €</div>
          </div>
          <div className="text-5xl">💶</div>
        </div>
      </div>

      {/* Admin stats */}
      {isThekenwart && dashboard && (
        <div className="space-y-3">
          <h3 className="font-bold text-tennis-dark">Übersicht</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center">
              <div className="text-2xl font-bold text-tennis-green">{dashboard.totalMembers}</div>
              <div className="text-xs text-gray-500">Aktive Mitglieder</div>
            </div>
            {isKassenwart && (
              <div className="card text-center">
                <div className="text-2xl font-bold text-tennis-dark">{(dashboard.openAmount || 0).toFixed(2)} €</div>
                <div className="text-xs text-gray-500">Offene Abrechnungen</div>
              </div>
            )}
            <div className="card text-center">
              <div className={`text-2xl font-bold ${dashboard.lowStock > 0 ? 'text-red-600' : 'text-green-600'}`}>{dashboard.lowStock}</div>
              <div className="text-xs text-gray-500">Niedriger Bestand</div>
            </div>
          </div>

          {lowStock.length > 0 && (
            <div className="card border-l-4 border-red-500">
              <h4 className="font-bold text-red-700 mb-2">⚠️ Niedriger Bestand</h4>
              {lowStock.map(d => (
                <div key={d.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                  <span>{d.name}</span>
                  <span className="font-bold text-red-600">{d.stock} {d.stock <= 0 ? '🚫' : '⚠️'}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
