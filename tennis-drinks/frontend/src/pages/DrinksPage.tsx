import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import type { Drink } from '../types'
import { CATEGORY_LABELS } from '../types'
import { QRCodeSVG } from 'qrcode.react'

export default function DrinksPage() {
  const { isThekenwart } = useAuth()
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [showForm, setShowForm] = useState(false)
  const [qrDrink, setQrDrink] = useState<Drink | null>(null)
  const [form, setForm] = useState({ article_number: '', name: '', category: 'softdrinks', price: '', purchase_price: '', stock: '', min_stock: '5', unit: 'Flasche' })
  const [editId, setEditId] = useState<number | null>(null)

  const load = () => api.get('/drinks').then(r => setDrinks(r.data))
  useEffect(() => { load() }, [])

  const handleSave = async () => {
    const data = { ...form, price: parseFloat(form.price), purchase_price: parseFloat(form.purchase_price) || null, stock: parseInt(form.stock) || 0, min_stock: parseInt(form.min_stock) || 5 }
    if (editId) await api.put(`/drinks/${editId}`, data)
    else await api.post('/drinks', data)
    load(); setShowForm(false); setEditId(null)
    setForm({ article_number: '', name: '', category: 'softdrinks', price: '', purchase_price: '', stock: '', min_stock: '5', unit: 'Flasche' })
  }

  const startEdit = (d: Drink) => {
    setForm({ article_number: d.article_number, name: d.name, category: d.category, price: String(d.price), purchase_price: String(d.purchase_price || ''), stock: String(d.stock), min_stock: String(d.min_stock), unit: d.unit })
    setEditId(d.id); setShowForm(true)
  }

  const toggleActive = async (d: Drink) => {
    await api.put(`/drinks/${d.id}`, { active: d.active ? 0 : 1 })
    load()
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-tennis-dark">🍺 Getränke</h1>
        {isThekenwart && <button onClick={() => { setShowForm(!showForm); setEditId(null) }} className="bg-tennis-green text-white rounded-xl px-4 py-2">
          {showForm && !editId ? '✕' : '+ Neu'}
        </button>}
      </div>

      {showForm && isThekenwart && (
        <div className="card mb-4 space-y-3">
          <h3 className="font-bold">{editId ? 'Getränk bearbeiten' : 'Neues Getränk'}</h3>
          {[['article_number','Artikelnummer'],['name','Bezeichnung']].map(([k,l]) => (
            <input key={k} value={(form as any)[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} className="input-field" placeholder={l} />
          ))}
          <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="input-field">
            {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            {[['price','Preis (€)'],['purchase_price','EK-Preis'],['stock','Bestand'],['min_stock','Mindestbestand']].map(([k,l]) => (
              <input key={k} type="number" value={(form as any)[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} className="input-field" placeholder={l} />
            ))}
          </div>
          <select value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))} className="input-field">
            {['Flasche','Dose','Glas','Tasse','Becher'].map(u => <option key={u}>{u}</option>)}
          </select>
          <button onClick={handleSave} className="btn-primary">{editId ? 'Speichern' : 'Anlegen'}</button>
        </div>
      )}

      {qrDrink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQrDrink(null)}>
          <div className="bg-white rounded-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-3">{qrDrink.name}</h3>
            <QRCodeSVG value={`http://localhost:5173/book?item=${qrDrink.id}`} size={200} />
            <p className="text-xs text-gray-400 mt-3">Zum Schließen antippen</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {drinks.map(d => (
          <div key={d.id} className={`card ${!d.active ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{d.name} <span className="text-xs text-gray-400">{d.article_number}</span></div>
                <div className="text-sm text-gray-500">{CATEGORY_LABELS[d.category]} · {d.unit}</div>
                <div className={`text-sm mt-1 font-medium ${d.stock <= d.min_stock ? 'text-red-600' : 'text-green-600'}`}>
                  Bestand: {d.stock} {d.stock <= d.min_stock && '⚠️'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-tennis-green">{d.price.toFixed(2)} €</div>
                <div className="flex gap-1 mt-1 justify-end">
                  <button onClick={() => setQrDrink(d)} className="text-xs bg-gray-100 px-2 py-1 rounded">QR</button>
                  {isThekenwart && <>
                    <button onClick={() => startEdit(d)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">✏️</button>
                    <button onClick={() => toggleActive(d)} className={`text-xs px-2 py-1 rounded ${d.active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {d.active ? 'Deakt.' : 'Akt.'}
                    </button>
                  </>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
