import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { STATUS_COLORS } from '../types'
import type { Member } from '../types'

// ─── Distribution Panel ──────────────────────────────────────────────────────

interface DistPanelProps {
  booking: any
  members: any[]
  onDone: () => void
  onCancel: () => void
}

function DistributionPanel({ booking, members, onDone, onCancel }: DistPanelProps) {
  const [manual, setManual] = useState<Record<number, number>>(
    Object.fromEntries(members.map(m => [m.id, 0]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalQty = booking.quantity
  const unitPrice = booking.unit_price
  const numMembers = members.length

  const assignedQty = Object.values(manual).reduce((s, v) => s + v, 0)
  const remainingQty = totalQty - assignedQty
  const remainingAmount = parseFloat((remainingQty * unitPrice).toFixed(2))
  const perMemberRemainder = numMembers > 0 ? parseFloat((remainingAmount / numMembers).toFixed(2)) : 0

  const tooMany = assignedQty > totalQty

  // Final distribution preview per member
  const preview = members.map(m => {
    const manualAmt = parseFloat((manual[m.id] * unitPrice).toFixed(2))
    const totalAmt = parseFloat((manualAmt + perMemberRemainder).toFixed(2))
    const totalQtyMember = parseFloat(((manual[m.id]) + remainingQty / numMembers).toFixed(3))
    return { ...m, manualQty: manual[m.id], manualAmt, restAmt: perMemberRemainder, totalAmt, totalQty: totalQtyMember }
  })

  const handleConfirm = async () => {
    if (tooMany) return
    setLoading(true)
    setError('')
    try {
      const distributions = preview.map(p => ({
        member_id: p.id,
        quantity: p.totalQty,
        amount: p.totalAmt,
      }))
      await api.post(`/bookings/${booking.id}/distribute`, { distributions })
      onDone()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Fehler beim Verteilen')
    } finally {
      setLoading(false)
    }
  }

  const adjust = (memberId: number, delta: number) => {
    setManual(prev => ({
      ...prev,
      [memberId]: Math.max(0, Math.min(totalQty, (prev[memberId] || 0) + delta))
    }))
  }

  return (
    <div className="mt-3 bg-gray-50 rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-bold">{booking.drink_name}</h4>
        <span className="text-sm text-gray-500">{totalQty} Stk · {unitPrice.toFixed(2)} €/Stk</span>
      </div>

      {/* Schritt 1: Manuelle Zuordnung */}
      <div>
        <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Schritt 1 – Manuell zuordnen</p>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-medium">{m.first_name} {m.last_name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => adjust(m.id, -1)}
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 font-bold text-sm active:scale-90 transition-transform">−</button>
                <span className="w-8 text-center font-bold text-sm">{manual[m.id] || 0}</span>
                <button onClick={() => adjust(m.id, 1)}
                  className={`w-8 h-8 rounded-full font-bold text-sm active:scale-90 transition-transform ${tooMany ? 'bg-gray-200 text-gray-400' : 'bg-tennis-green text-white'}`}>+</button>
              </div>
              <span className="w-14 text-right text-sm text-gray-500">{(manual[m.id] * unitPrice).toFixed(2)} €</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fortschritt-Anzeige */}
      <div className={`rounded-xl p-3 text-sm font-medium ${tooMany ? 'bg-red-50 text-red-700' : remainingQty === 0 ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
        {tooMany ? (
          <span>⚠ Zu viele zugeordnet! Manuell: {assignedQty} · Gesamt: {totalQty}</span>
        ) : remainingQty === 0 ? (
          <span>✓ Alle {totalQty} Stk manuell zugeordnet – kein Rest</span>
        ) : (
          <span>Manuell zugeordnet: <strong>{assignedQty}</strong> von <strong>{totalQty}</strong> · Noch zu verteilen: <strong>{remainingQty} Stk ({remainingAmount.toFixed(2)} €)</strong></span>
        )}
      </div>

      {/* Schritt 2: Automatische Restverteilung */}
      {remainingQty > 0 && !tooMany && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Schritt 2 – Rest anteilig auf alle</p>
          <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{m.first_name} {m.last_name}</span>
                <span className="text-gray-400">+ {perMemberRemainder.toFixed(2)} €</span>
              </div>
            ))}
            <div className="text-xs text-gray-400 pt-1 border-t mt-1">
              {remainingAmount.toFixed(2)} € ÷ {numMembers} Mitglieder = je {perMemberRemainder.toFixed(2)} €
            </div>
          </div>
        </div>
      )}

      {/* Endabrechnung Vorschau */}
      <div>
        <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Gesamtabrechnung</p>
        <div className="bg-tennis-dark rounded-xl p-3 space-y-1">
          {preview.map(p => (
            <div key={p.id} className="flex justify-between text-sm">
              <span className="text-white">{p.first_name} {p.last_name}</span>
              <div className="text-right">
                {remainingQty > 0
                  ? <span className="text-tennis-light text-xs">{p.manualQty > 0 && `${p.manualAmt.toFixed(2)} + ${p.restAmt.toFixed(2)} = `}<span className="text-white font-bold">{p.totalAmt.toFixed(2)} €</span></span>
                  : <span className="text-white font-bold">{p.totalAmt.toFixed(2)} €</span>
                }
              </div>
            </div>
          ))}
          <div className="text-xs text-gray-400 pt-1 border-t border-gray-700 mt-1 flex justify-between">
            <span>Gesamt</span>
            <span>{preview.reduce((s, p) => s + p.totalAmt, 0).toFixed(2)} €</span>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      <div className="flex gap-2">
        <button onClick={handleConfirm} disabled={loading || tooMany}
          className="btn-primary text-sm py-2.5">
          {loading ? 'Verteile...' : '✓ Verteilung bestätigen'}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm py-2.5">Abbrechen</button>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isThekenwart, isAdmin } = useAuth()

  const [group, setGroup] = useState<any>(null)
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [showDistribute, setShowDistribute] = useState<number | null>(null)

  // Member editing
  const [editingMembers, setEditingMembers] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [savingMembers, setSavingMembers] = useState(false)

  // Group meta editing
  const [editingMeta, setEditingMeta] = useState(false)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editTemplate, setEditTemplate] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)

  const load = async () => {
    const r = await api.get(`/groups/${id}`)
    setGroup(r.data)
    setSelectedMemberIds(r.data.members.map((m: any) => m.id))
    setEditName(r.data.name)
    setEditType(r.data.group_type)
    setEditTemplate(!!r.data.is_template)
  }

  useEffect(() => {
    load()
    api.get('/members').then(r => setAllMembers(r.data.filter((m: Member) => m.active)))
  }, [])

  const handleSaveMembers = async () => {
    setSavingMembers(true)
    try {
      await api.put(`/groups/${id}/members`, { member_ids: selectedMemberIds })
      setEditingMembers(false)
      load()
    } finally { setSavingMembers(false) }
  }

  const handleSaveMeta = async () => {
    setSavingMeta(true)
    try {
      await api.put(`/groups/${id}`, { name: editName, group_type: editType, is_template: editTemplate })
      setEditingMeta(false)
      load()
    } finally { setSavingMeta(false) }
  }

  const handleClose = async () => {
    await api.put(`/groups/${id}/close`)
    navigate('/groups')
  }

  const handleDelete = async () => {
    const bookingCount = group.bookings.length
    const msg = bookingCount > 0
      ? `Gruppe "${group.name}" unwiderruflich löschen?\n\n${bookingCount} Buchung${bookingCount !== 1 ? 'en' : ''} wird storniert und der Bestand wiederhergestellt.`
      : `Gruppe "${group.name}" unwiderruflich löschen?`
    if (!window.confirm(msg)) return
    await api.delete(`/groups/${id}`)
    navigate('/groups')
  }

  const handleReopen = async () => {
    if (!window.confirm(`Neue Gruppe auf Basis von "${group.name}" erstellen?\n\nDie aktuelle Gruppe bleibt bestehen. Es wird eine neue Gruppe mit gleichen Mitgliedern und dem aktuellen Datum im Namen angelegt.`)) return
    const r = await api.put(`/groups/${id}/reopen`)
    navigate(`/groups/${r.data.new_group_id}`)
  }

  const statusColor = (s: string) => ({
    offen: 'bg-green-100 text-green-800',
    in_verteilung: 'bg-yellow-100 text-yellow-800',
    abgeschlossen: 'bg-gray-100 text-gray-800',
    storniert: 'bg-red-100 text-red-800',
  }[s] || 'bg-gray-100 text-gray-800')

  if (!group) return <div className="p-4 text-center text-gray-400">Lade...</div>

  const isOwner = group.created_by === user?.id
  const openBookings = group.bookings.filter((b: any) => b.status === 'offen_gruppe')
  const totalOpen = openBookings.reduce((s: number, b: any) => s + b.total_price, 0)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={() => navigate('/groups')} className="text-tennis-green mb-4 flex items-center gap-1">← Zurück</button>

      {/* Header */}
      {editingMeta ? (
        <div className="card mb-4 space-y-3">
          <h3 className="font-bold">Gruppe bearbeiten</h3>
          <input value={editName} onChange={e => setEditName(e.target.value)} className="input-field" placeholder="Gruppenname" />
          <select value={editType} onChange={e => setEditType(e.target.value)} className="input-field">
            <option value="spontan">Spontan</option>
            <option value="mannschaft">Mannschaft</option>
            <option value="event">Event</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editTemplate} onChange={e => setEditTemplate(e.target.checked)} className="w-4 h-4 accent-tennis-green" />
            <span className="font-medium">Als Vorlage (wiederverwendbar)</span>
          </label>
          <div className="flex gap-2">
            <button onClick={handleSaveMeta} disabled={savingMeta} className="btn-primary">Speichern</button>
            <button onClick={() => setEditingMeta(false)} className="btn-secondary">Abbrechen</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-tennis-dark">{group.name}</h1>
              {group.is_template === 1 && <span className="bg-tennis-green/10 text-tennis-green text-xs font-bold px-2 py-1 rounded-full">📌 Vorlage</span>}
            </div>
            <p className="text-gray-500 text-sm">{group.group_type} · {new Date(group.created_at).toLocaleDateString('de-DE')}</p>
            <span className={`badge mt-1 inline-block ${statusColor(group.status)}`}>{group.status}</span>
          </div>
          {isThekenwart && <button onClick={() => setEditingMeta(true)} className="text-xs text-tennis-green border border-tennis-green rounded-lg px-3 py-1.5">✏️ Bearbeiten</button>}
        </div>
      )}

      {/* Members */}
      <div className="card mb-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">👤 Mitglieder ({group.members.length})</h3>
          {isThekenwart && !editingMembers && (
            <button onClick={() => setEditingMembers(true)} className="text-xs text-tennis-green border border-tennis-green rounded-lg px-3 py-1">Bearbeiten</button>
          )}
        </div>
        {editingMembers ? (
          <div>
            <div className="max-h-56 overflow-y-auto space-y-1 mb-3">
              {allMembers.map(m => (
                <label key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedMemberIds.includes(m.id)} onChange={() => setSelectedMemberIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} className="w-4 h-4 accent-tennis-green" />
                  <span className="text-sm">{m.first_name} {m.last_name}</span>
                  {m.team && <span className="text-xs text-gray-400">({m.team})</span>}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveMembers} disabled={savingMembers} className="btn-primary text-sm py-2">
                {savingMembers ? 'Speichern...' : `Speichern (${selectedMemberIds.length} Mitglieder)`}
              </button>
              <button onClick={() => { setEditingMembers(false); setSelectedMemberIds(group.members.map((m: any) => m.id)) }} className="btn-secondary text-sm py-2">Abbrechen</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {group.members.map((m: any) => (
              <span key={m.id} className="bg-tennis-green/10 text-tennis-dark px-3 py-1 rounded-full text-sm">{m.first_name} {m.last_name}</span>
            ))}
            {group.members.length === 0 && <p className="text-gray-400 text-sm">Keine Mitglieder</p>}
          </div>
        )}
      </div>

      {/* Open bookings summary */}
      {openBookings.length > 0 && (
        <div className="card bg-yellow-50 border border-yellow-200 mb-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-yellow-900">⏳ Noch zu verteilen</p>
              <p className="text-sm text-yellow-700">{openBookings.length} Buchung{openBookings.length !== 1 ? 'en' : ''} · {totalOpen.toFixed(2)} € gesamt</p>
            </div>
            <span className="text-2xl">🍺</span>
          </div>
        </div>
      )}

      {/* Bookings */}
      <div className="card mb-3">
        <h3 className="font-bold mb-2">🍺 Buchungen ({group.bookings.length})</h3>
        <div className="space-y-3">
          {group.bookings.map((b: any) => (
            <div key={b.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{b.drink_name}</div>
                  <div className="text-sm text-gray-500">{b.quantity} Stk à {b.unit_price?.toFixed(2)} € = <strong>{b.total_price.toFixed(2)} €</strong></div>
                </div>
                <div className="text-right">
                  <span className={`badge ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-800'}`}>{b.status.replace('_', ' ')}</span>
                  {isThekenwart && b.status === 'offen_gruppe' && group.members.length > 0 && (
                    <button
                      onClick={() => setShowDistribute(showDistribute === b.id ? null : b.id)}
                      className="block mt-1 text-xs text-tennis-green underline">
                      {showDistribute === b.id ? '▲ Schließen' : '▼ Verteilen'}
                    </button>
                  )}
                </div>
              </div>

              {showDistribute === b.id && (
                <DistributionPanel
                  booking={b}
                  members={group.members}
                  onDone={() => { setShowDistribute(null); load() }}
                  onCancel={() => setShowDistribute(null)}
                />
              )}
            </div>
          ))}
          {group.bookings.length === 0 && <p className="text-gray-400 text-sm">Keine Buchungen</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {isThekenwart && group.status === 'offen' && openBookings.length === 0 && (
          <button onClick={handleClose} className="btn-primary bg-gray-700">✓ Gruppe abschließen</button>
        )}
        {(isThekenwart || isOwner) && group.status === 'abgeschlossen' && (
          <button onClick={handleReopen} className="btn-primary">🔄 Gruppe erneut verwenden</button>
        )}
        {isAdmin && (
          <button onClick={handleDelete}
            className="w-full py-2.5 rounded-xl font-semibold text-sm border-2 border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
            🗑 Gruppe löschen
          </button>
        )}
      </div>
    </div>
  )
}
