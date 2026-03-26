import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { enqueueBooking } from '../lib/offlineQueue'
import api from '../api'
import { CATEGORY_LABELS } from '../types'

type BookingMode = 'einzeln' | 'aufteilen' | 'fuer-andere'

interface SavedPerson {
  id: number
  first_name: string
  last_name: string
  member_number: string
}

const SPLIT_KEY = 'bruvi-split-persons-v1'

function loadSavedPersons(): SavedPerson[] {
  try { return JSON.parse(localStorage.getItem(SPLIT_KEY) || '[]') } catch { return [] }
}
function saveSavedPersons(p: SavedPerson[]) {
  try { localStorage.setItem(SPLIT_KEY, JSON.stringify(p)) } catch {}
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart()
  const { user, isThekenwart } = useAuth()
  const { isOnline, refreshPendingCount } = useSync()
  const navigate = useNavigate()

  const [mode, setMode] = useState<BookingMode>('einzeln')
  const [savedPersons, setSavedPersons] = useState<SavedPerson[]>(loadSavedPersons)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(loadSavedPersons().map(p => p.id)))
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SavedPerson[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [offlineQueued, setOfflineQueued] = useState(false)
  const [bookedSummary, setBookedSummary] = useState({ count: 0, total: 0 })

  // Für-andere-Modus: Zielperson
  const [targetPerson, setTargetPerson] = useState<SavedPerson | null>(null)
  const [targetSearch, setTargetSearch] = useState('')
  const [targetResults, setTargetResults] = useState<SavedPerson[]>([])

  // Personen suchen (Aufteilen)
  useEffect(() => {
    if (!showSearch || searchQuery.trim().length < 1) { setSearchResults([]); return }
    const timer = setTimeout(() => {
      api.get('/members').then(r => {
        const q = searchQuery.toLowerCase()
        const savedIds = new Set(savedPersons.map(p => p.id))
        setSearchResults(
          r.data
            .filter((m: any) => m.id !== user!.id && !savedIds.has(m.id) && m.active !== 0)
            .filter((m: any) => `${m.first_name} ${m.last_name} ${m.member_number}`.toLowerCase().includes(q))
            .sort((a: any, b: any) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'de'))
            .slice(0, 8)
        )
      }).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, showSearch, savedPersons, user])

  // Zielperson suchen (Für andere)
  useEffect(() => {
    if (mode !== 'fuer-andere' || targetSearch.trim().length < 1) { setTargetResults([]); return }
    const timer = setTimeout(() => {
      api.get('/members').then(r => {
        const q = targetSearch.toLowerCase()
        setTargetResults(
          r.data
            .filter((m: any) => m.active !== 0)
            .filter((m: any) => `${m.first_name} ${m.last_name} ${m.member_number}`.toLowerCase().includes(q))
            .sort((a: any, b: any) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'de'))
            .slice(0, 8)
        )
      }).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [targetSearch, mode])

  const addPerson = useCallback((p: SavedPerson) => {
    const updated = [...savedPersons, p]
    setSavedPersons(updated)
    saveSavedPersons(updated)
    setSelectedIds(prev => new Set([...prev, p.id]))
    setSearchQuery('')
    setShowSearch(false)
  }, [savedPersons])

  const removePerson = useCallback((id: number) => {
    const updated = savedPersons.filter(p => p.id !== id)
    setSavedPersons(updated)
    saveSavedPersons(updated)
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }, [savedPersons])

  const togglePerson = useCallback((id: number) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }, [])

  const totalPersons = (mode === 'aufteilen' ? selectedIds.size : 0) + 1
  const perPersonAmount = mode === 'aufteilen' && totalPersons > 1
    ? totalPrice / totalPersons
    : totalPrice

  const handleCheckout = async () => {
    if (!items.length) return
    if (mode === 'aufteilen' && selectedIds.size === 0) return
    if (mode === 'fuer-andere' && !targetPerson) return

    // Bestätigung vor Buchung
    const itemList = items.map(i => `${i.quantity}× ${i.drink.name}`).join(', ')
    const confirmMsg = mode === 'einzeln'
      ? `${totalPrice.toFixed(2)} € auf dein Konto buchen?\n\n${itemList}`
      : mode === 'fuer-andere' && targetPerson
        ? `${totalPrice.toFixed(2)} € auf ${targetPerson.first_name} ${targetPerson.last_name} buchen?\n\n${itemList}`
        : `${totalPrice.toFixed(2)} € auf ${totalPersons} Personen aufteilen (${perPersonAmount.toFixed(2)} €/Person)?\n\n${itemList}`
    if (!window.confirm(confirmMsg)) return

    setLoading(true)

    const bookedCount = items.reduce((s, i) => s + i.quantity, 0)
    const bookedTotal = items.reduce((s, i) => s + i.drink.price * i.quantity, 0)

    // OFFLINE
    if (!isOnline) {
      try {
        await enqueueBooking({
          timestamp: Date.now(),
          items: items.map(i => ({ drink_id: i.drink.id, quantity: i.quantity, price: i.drink.price, name: i.drink.name })),
          booking_type: 'einzeln',
          member_id: mode === 'fuer-andere' && targetPerson ? targetPerson.id : user!.id,
          group_id: null,
          total_price: bookedTotal,
        })
        await refreshPendingCount()
        clearCart()
        setBookedSummary({ count: bookedCount, total: bookedTotal })
        setOfflineQueued(true)
        setSuccess(true)
      } catch {
        alert('Fehler beim Speichern der Offline-Buchung')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      if (mode === 'einzeln') {
        // Alle Buchungen parallel senden
        await Promise.all(items.map(item =>
          api.post('/bookings', {
            drink_id: item.drink.id,
            member_id: user!.id,
            quantity: item.quantity,
            booking_type: 'einzeln',
          })
        ))
      } else if (mode === 'fuer-andere' && targetPerson) {
        // Für andere Person buchen – parallel
        await Promise.all(items.map(item =>
          api.post('/bookings', {
            drink_id: item.drink.id,
            member_id: targetPerson.id,
            quantity: item.quantity,
            booking_type: 'einzeln',
          })
        ))
      } else if (mode === 'aufteilen') {
        // Server-Side Split (atomar)
        const personIds = savedPersons.filter(p => selectedIds.has(p.id)).map(p => p.id)
        await api.post('/bookings/split', {
          items: items.map(i => ({ drink_id: i.drink.id, quantity: i.quantity })),
          person_ids: personIds,
        })
      }

      clearCart()
      setBookedSummary({ count: bookedCount, total: bookedTotal })
      setSuccess(true)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Fehler beim Buchen')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        {offlineQueued ? (
          <>
            <div className="text-7xl mb-4">📵</div>
            <h2 className="text-2xl font-bold text-tennis-dark">Offline gespeichert</h2>
            <p className="text-gray-600 mt-2 text-center">{bookedSummary.count} Artikel · {bookedSummary.total.toFixed(2)} €</p>
            <p className="text-gray-500 mt-2 text-sm text-center">Wird automatisch synchronisiert sobald du wieder online bist.</p>
          </>
        ) : (
          <>
            <div className="text-7xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-tennis-dark">Alles gebucht!</h2>
            <p className="text-gray-600 mt-2">{bookedSummary.count} Artikel · {bookedSummary.total.toFixed(2)} €</p>
            {mode === 'fuer-andere' && targetPerson && (
              <p className="text-gray-500 mt-1 text-sm">Gebucht für: {targetPerson.first_name} {targetPerson.last_name}</p>
            )}
            {mode === 'aufteilen' && (
              <p className="text-gray-500 mt-1 text-sm">Aufgeteilt auf {totalPersons} Personen · {perPersonAmount.toFixed(2)} € / Person</p>
            )}
          </>
        )}
        <button onClick={() => navigate('/')} className="btn-primary mt-6">Zurück zum Start</button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-xl font-bold text-gray-500">Warenkorb ist leer</h2>
        <button onClick={() => navigate('/book')} className="btn-primary mt-6">Getränke auswählen</button>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {!isOnline && (
        <div className="mb-4 p-3 rounded-xl text-sm text-white font-medium text-center" style={{ background: '#6b7280' }}>
          📵 Offline – Buchung wird gespeichert und später synchronisiert
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-tennis-dark">🛒 Warenkorb</h1>
        <button onClick={() => { clearCart(); navigate('/book') }} className="text-sm text-red-500 underline">Leeren</button>
      </div>

      {/* Artikel */}
      <div className="space-y-2 mb-4">
        {items.map(item => (
          <div key={item.drink.id} className="card">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-bold">{item.drink.name}</div>
                <div className="text-sm text-gray-500">{CATEGORY_LABELS[item.drink.category]} · {item.drink.price.toFixed(2)} € / Stk.</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.drink.id, item.quantity - 1)}
                  className="w-9 h-9 rounded-full bg-gray-100 text-xl font-bold flex items-center justify-center active:scale-90 transition-transform">−</button>
                <span className="w-8 text-center text-lg font-bold">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.drink.id, item.quantity + 1)}
                  className="w-9 h-9 rounded-full text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: '#1A3B8F' }}>+</button>
              </div>
              <div className="text-right min-w-[60px]">
                <div className="font-bold text-tennis-green">{(item.drink.price * item.quantity).toFixed(2)} €</div>
                <button onClick={() => removeItem(item.drink.id)} className="text-xs text-red-400">entfernen</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gesamtbetrag */}
      <div className="card text-white mb-4 flex justify-between items-center"
        style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
        <div>
          <div className="text-sm opacity-75">{totalItems} Artikel</div>
          <div className="text-3xl font-bold">{totalPrice.toFixed(2)} €</div>
        </div>
        {mode === 'aufteilen' && totalPersons > 1 && (
          <div className="text-right">
            <div className="text-sm opacity-75">{totalPersons} Personen</div>
            <div className="text-xl font-bold">{perPersonAmount.toFixed(2)} € / Person</div>
          </div>
        )}
        {mode === 'fuer-andere' && targetPerson && (
          <div className="text-right">
            <div className="text-sm opacity-75">Für</div>
            <div className="text-base font-bold">{targetPerson.first_name} {targetPerson.last_name}</div>
          </div>
        )}
        {mode === 'einzeln' && <div className="text-4xl">💶</div>}
      </div>

      {/* Modus wählen */}
      <div className="card mb-4">
        <label className="block font-bold mb-3">Buchen auf</label>
        <div className={`grid ${isThekenwart ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-3`}>
          <button onClick={() => setMode('einzeln')}
            className={`py-3 rounded-xl font-medium text-sm transition-colors ${mode === 'einzeln' ? 'text-white' : 'bg-gray-100 text-gray-700'}`}
            style={mode === 'einzeln' ? { background: '#1A3B8F' } : undefined}>
            👤 Auf mich
          </button>
          <button onClick={() => setMode('aufteilen')}
            className={`py-3 rounded-xl font-medium text-sm transition-colors ${mode === 'aufteilen' ? 'text-white' : 'bg-gray-100 text-gray-700'}`}
            style={mode === 'aufteilen' ? { background: '#1A3B8F' } : undefined}>
            👥 Aufteilen
          </button>
          {isThekenwart && (
            <button onClick={() => setMode('fuer-andere')}
              className={`py-3 rounded-xl font-medium text-sm transition-colors ${mode === 'fuer-andere' ? 'text-white' : 'bg-gray-100 text-gray-700'}`}
              style={mode === 'fuer-andere' ? { background: '#1A3B8F' } : undefined}>
              🔄 Für andere
            </button>
          )}
        </div>

        {/* Aufteilen: Personenliste */}
        {mode === 'aufteilen' && (
          <div className="mt-1">
            <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50 mb-1">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#1A3B8F' }}>
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="flex-1 text-sm font-medium">{user?.first_name} {user?.last_name} <span className="text-gray-400 text-xs">(Du)</span></span>
              <span className="text-xs text-gray-400">{perPersonAmount.toFixed(2)} €</span>
            </div>

            {savedPersons.map(p => {
              const isSelected = selectedIds.has(p.id)
              return (
                <div key={p.id} className={`flex items-center gap-3 py-2 px-3 rounded-xl mb-1 transition-colors ${isSelected ? 'bg-gray-50' : 'bg-gray-50 opacity-50'}`}>
                  <button onClick={() => togglePerson(p.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? 'border-[#1A3B8F] bg-[#1A3B8F]' : 'border-gray-300 bg-white'}`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </button>
                  <span className="flex-1 text-sm">{p.first_name} {p.last_name}</span>
                  {isSelected && <span className="text-xs text-gray-500">{perPersonAmount.toFixed(2)} €</span>}
                  <button onClick={() => removePerson(p.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
                    title="Aus Liste entfernen">×</button>
                </div>
              )
            })}

            {!showSearch ? (
              <button onClick={() => setShowSearch(true)}
                className="w-full mt-2 py-2 px-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#1A3B8F] hover:text-[#1A3B8F] transition-colors">
                + Person hinzufügen
              </button>
            ) : (
              <div className="mt-2">
                <div className="flex gap-2">
                  <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Name oder Mitgl.-Nr. suchen…" className="input-field flex-1 text-sm" />
                  <button onClick={() => { setShowSearch(false); setSearchQuery('') }}
                    className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm">✕</button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-1 rounded-xl border border-gray-200 overflow-hidden">
                    {searchResults.map(r => (
                      <button key={r.id} onClick={() => addPerson(r)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center justify-between">
                        <span>{r.first_name} {r.last_name}</span>
                        <span className="text-xs text-gray-400">{r.member_number}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length > 0 && searchResults.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1 px-1">Keine Treffer</p>
                )}
              </div>
            )}

            {savedPersons.length === 0 && !showSearch && (
              <p className="text-xs text-gray-400 mt-2 text-center">Füge Personen hinzu – sie werden für das nächste Mal gespeichert</p>
            )}
          </div>
        )}

        {/* Für andere: Zielperson wählen */}
        {mode === 'fuer-andere' && (
          <div className="mt-1">
            {targetPerson ? (
              <div className="flex items-center gap-3 py-3 px-3 rounded-xl bg-blue-50">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#1A3B8F' }}>
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="flex-1 text-sm font-medium">{targetPerson.first_name} {targetPerson.last_name}</span>
                <span className="text-xs text-gray-400">{targetPerson.member_number}</span>
                <button onClick={() => setTargetPerson(null)}
                  className="text-gray-400 hover:text-red-400 text-lg">×</button>
              </div>
            ) : (
              <div>
                <input autoFocus value={targetSearch} onChange={e => setTargetSearch(e.target.value)}
                  placeholder="Mitglied suchen…" className="input-field text-sm" />
                {targetResults.length > 0 && (
                  <div className="mt-1 rounded-xl border border-gray-200 overflow-hidden">
                    {targetResults.map(r => (
                      <button key={r.id} onClick={() => { setTargetPerson(r); setTargetSearch(''); setTargetResults([]) }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center justify-between">
                        <span>{r.first_name} {r.last_name}</span>
                        <span className="text-xs text-gray-400">{r.member_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={handleCheckout}
        disabled={loading || (mode === 'aufteilen' && selectedIds.size === 0) || (mode === 'fuer-andere' && !targetPerson)}
        className="btn-primary disabled:opacity-50">
        {loading ? 'Buchen…' : isOnline
          ? mode === 'aufteilen'
            ? `✓ Aufteilen (${perPersonAmount.toFixed(2)} € / Person)`
            : mode === 'fuer-andere' && targetPerson
              ? `✓ Buchen für ${targetPerson.first_name} (${totalPrice.toFixed(2)} €)`
              : `✓ Alle buchen (${totalPrice.toFixed(2)} €)`
          : `📵 Offline speichern (${totalPrice.toFixed(2)} €)`}
      </button>
      <button onClick={() => navigate('/book')} className="btn-secondary mt-2">
        + Weitere Getränke
      </button>
    </div>
  )
}
