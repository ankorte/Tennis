import { useEffect, useState } from 'react'
import api from '../api'
import type { Drink } from '../types'
import { CATEGORY_LABELS } from '../types'

export default function InventoryPage() {
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [tab, setTab] = useState<'stock' | 'incoming' | 'correction' | 'history'>('stock')
  const [drinkId, setDrinkId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [comment, setComment] = useState('')
  const [newStock, setNewStock] = useState('')

  useEffect(() => {
    api.get('/drinks').then(r => setDrinks(r.data))
    api.get('/inventory/movements').then(r => setMovements(r.data))
  }, [])

  const handleIncoming = async () => {
    await api.post('/inventory/incoming', { drink_id: drinkId, quantity, comment })
    const [d, m] = await Promise.all([api.get('/drinks'), api.get('/inventory/movements')])
    setDrinks(d.data); setMovements(m.data)
    setDrinkId(''); setQuantity(''); setComment(''); alert('Wareneingang gespeichert')
  }

  const handleCorrection = async () => {
    await api.post('/inventory/correction', { drink_id: drinkId, new_stock: newStock, comment })
    const [d, m] = await Promise.all([api.get('/drinks'), api.get('/inventory/movements')])
    setDrinks(d.data); setMovements(m.data)
    setDrinkId(''); setNewStock(''); setComment(''); alert('Korrektur gespeichert')
  }

  const movTypeLabel: Record<string, string> = { verbrauch: '📉 Verbrauch', wareneingang: '📦 Eingang', korrektur: '✏️ Korrektur', inventur: '📋 Inventur', storno: '🔄 Storno' }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-tennis-dark mb-4">📦 Lagerverwaltung</h1>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[['stock','Bestand'],['incoming','Wareneingang'],['correction','Korrektur'],['history','Historie']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-3 py-2 rounded-xl font-medium text-sm whitespace-nowrap ${tab === k ? 'bg-tennis-green text-white' : 'bg-white text-gray-700 border'}`}>{l}</button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="space-y-2">
          {drinks.map(d => (
            <div key={d.id} className={`card flex justify-between items-center ${d.stock <= d.min_stock ? 'border-l-4 border-red-400' : ''}`}>
              <div>
                <div className="font-bold">{d.name}</div>
                <div className="text-sm text-gray-500">{CATEGORY_LABELS[d.category]}</div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold ${d.stock <= d.min_stock ? 'text-red-600' : 'text-tennis-green'}`}>{d.stock}</div>
                <div className="text-xs text-gray-400">Min: {d.min_stock} {d.unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(tab === 'incoming' || tab === 'correction') && (
        <div className="card space-y-3">
          <h3 className="font-bold">{tab === 'incoming' ? '📦 Wareneingang' : '✏️ Korrektur'}</h3>
          <select value={drinkId} onChange={e => setDrinkId(e.target.value)} className="input-field">
            <option value="">-- Getränk wählen --</option>
            {drinks.map(d => <option key={d.id} value={d.id}>{d.name} (Bestand: {d.stock})</option>)}
          </select>
          {tab === 'incoming'
            ? <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="input-field" placeholder="Menge" />
            : <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} className="input-field" placeholder="Neuer Gesamtbestand" />
          }
          <input value={comment} onChange={e => setComment(e.target.value)} className="input-field" placeholder="Kommentar (optional)" />
          <button onClick={tab === 'incoming' ? handleIncoming : handleCorrection} className="btn-primary">Speichern</button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {movements.map(m => (
            <div key={m.id} className="card">
              <div className="flex justify-between">
                <div>
                  <div className="font-bold text-sm">{m.drink_name}</div>
                  <div className="text-xs text-gray-500">{movTypeLabel[m.movement_type]} · {m.created_by_name}</div>
                  {m.comment && <div className="text-xs text-gray-400 mt-1">{m.comment}</div>}
                </div>
                <div className="text-right">
                  <div className={`font-bold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</div>
                  <div className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('de-DE')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
