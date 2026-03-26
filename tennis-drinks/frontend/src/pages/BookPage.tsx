import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'
import type { Drink } from '../types'
import { CATEGORY_LABELS } from '../types'
import { useCart } from '../context/CartContext'

const ALL_CATEGORIES = ['alle', 'bier', 'softdrinks', 'wasser', 'wein_sekt', 'kaffee', 'sonstiges'] as const
const TAB_LABELS: Record<string, string> = {
  alle: '🍹 Alle',
  bier: '🍺 Bier',
  softdrinks: '🥤 Soft',
  wasser: '💧 Wasser',
  wein_sekt: '🍷 Wein',
  kaffee: '☕ Kaffee',
  sonstiges: '🍽️ Sonst.',
}

export default function BookPage() {
  const [searchParams] = useSearchParams()
  const itemId = searchParams.get('item')
  const navigate = useNavigate()
  const { addItem, items, totalItems, totalPrice } = useCart()

  const [drinks, setDrinks] = useState<Drink[]>([])
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [filter, setFilter] = useState('')
  const [category, setCategory] = useState('alle')

  useEffect(() => {
    api.get('/drinks').then(r => {
      const active = r.data.filter((d: Drink) => d.active)
      setDrinks(active)
      if (itemId) {
        const found = active.find((d: Drink) => d.id === parseInt(itemId))
        if (found) setSelectedDrink(found)
      }
    })
  }, [])

  const handleAddToCart = () => {
    if (!selectedDrink) return
    addItem(selectedDrink, quantity)
    setAdded(true)
    setTimeout(() => {
      setAdded(false)
      setSelectedDrink(null)
      setQuantity(1)
    }, 1200)
  }

  const cartQty = (drinkId: number) => items.find(i => i.drink.id === drinkId)?.quantity ?? 0

  // Welche Kategorien haben Getränke?
  const availableCategories = ALL_CATEGORIES.filter(
    c => c === 'alle' || drinks.some(d => d.category === c)
  )

  const filtered = drinks
    .filter(d => category === 'alle' || d.category === category)
    .filter(d =>
      !filter || d.name.toLowerCase().includes(filter.toLowerCase())
    )

  if (added && selectedDrink) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-7xl mb-4 animate-bounce">🛒</div>
        <h2 className="text-2xl font-bold text-tennis-dark">In den Warenkorb!</h2>
        <p className="text-gray-600 mt-2">{quantity}× {selectedDrink.name}</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-tennis-dark">🍺 Getränke</h1>
        {totalItems > 0 && (
          <button onClick={() => navigate('/cart')}
            className="flex items-center gap-2 bg-tennis-green text-white rounded-xl px-4 py-2 font-bold text-sm active:scale-95 transition-transform">
            🛒 {totalItems} · {totalPrice.toFixed(2)} €
          </button>
        )}
      </div>

      {!selectedDrink ? (
        <>
          {/* Kategorie-Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-hide">
            {availableCategories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  category === c
                    ? 'bg-tennis-green text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {TAB_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Suchfeld */}
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-field mb-3"
            placeholder="🔍 Getränk suchen..."
          />

          {/* Getränke-Kacheln */}
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(d => {
              const inCart = cartQty(d.id)
              const emoji = CATEGORY_LABELS[d.category]?.split(' ')[0] || '🍹'
              return (
                <button
                  key={d.id}
                  onClick={() => d.stock > 0 ? setSelectedDrink(d) : undefined}
                  className={`card text-left relative overflow-hidden transition-all active:scale-[0.97] ${
                    d.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg'
                  }`}
                >
                  {inCart > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-tennis-green text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">
                      {inCart}
                    </span>
                  )}
                  <div className="text-2xl mb-1">{emoji}</div>
                  <div className="font-bold text-sm text-tennis-dark leading-tight">{d.name}</div>
                  <div className="flex justify-between items-end mt-1.5">
                    <span className="text-lg font-black text-tennis-green">{d.price.toFixed(2)} €</span>
                    <span className={`text-[10px] ${d.stock <= d.min_stock && d.stock > 0 ? 'text-orange-500 font-bold' : 'text-gray-400'}`}>
                      {d.stock <= d.min_stock && d.stock > 0 ? '⚠️ ' : ''}{d.stock} {d.unit}
                    </span>
                  </div>
                  {d.stock <= 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <span className="text-sm font-bold text-red-500">Ausverkauft</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8">Keine Getränke gefunden</p>
          )}

          {totalItems > 0 && (
            <div className="fixed bottom-20 left-0 right-0 px-4">
              <button onClick={() => navigate('/cart')}
                className="btn-primary shadow-xl flex items-center justify-center gap-2">
                🛒 Zum Warenkorb · {totalItems} Artikel · {totalPrice.toFixed(2)} €
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="card text-white" style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
            <div className="text-xl font-bold">{selectedDrink.name}</div>
            <div className="text-sm opacity-75">{CATEGORY_LABELS[selectedDrink.category]} · {selectedDrink.stock} verfügbar</div>
            <div className="text-3xl font-bold mt-2">{selectedDrink.price.toFixed(2)} €</div>
          </div>

          <div className="card">
            <label className="block font-bold mb-3">Menge</label>
            <div className="flex items-center gap-4 justify-center">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-14 h-14 rounded-full bg-gray-100 text-2xl font-bold active:scale-90 transition-transform">−</button>
              <span className="text-4xl font-bold w-16 text-center">{quantity}</span>
              <button onClick={() => setQuantity(Math.min(selectedDrink.stock, quantity + 1))}
                className="w-14 h-14 rounded-full text-white text-2xl font-bold active:scale-90 transition-transform"
                style={{ background: '#1A3B8F' }}>+</button>
            </div>
            <div className="text-center text-gray-500 mt-3">
              Gesamt: <strong>{(selectedDrink.price * quantity).toFixed(2)} €</strong>
            </div>
            {cartQty(selectedDrink.id) > 0 && (
              <div className="text-center text-xs text-blue-600 mt-2 bg-blue-50 rounded-lg py-1.5">
                🛒 Bereits {cartQty(selectedDrink.id)}× im Warenkorb
              </div>
            )}
          </div>

          <button onClick={handleAddToCart} className="btn-primary">
            🛒 In den Warenkorb
          </button>

          {totalItems > 0 && (
            <button onClick={() => navigate('/cart')} className="btn-secondary">
              Zum Warenkorb ({totalItems} Artikel · {totalPrice.toFixed(2)} €) →
            </button>
          )}

          <button onClick={() => setSelectedDrink(null)} className="btn-secondary">← Zurück zur Liste</button>
        </div>
      )}
    </div>
  )
}
