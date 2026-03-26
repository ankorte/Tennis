'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { useAuth } from '@/components/AuthProvider'
import BracketView from '@/components/BracketView'
import LosAnimation from '@/components/LosAnimation'
import { Turnier, Anmeldung } from '@/types'

export default function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth()
  const router = useRouter()

  const [turniere, setTurniere] = useState<Turnier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTurnier, setSelectedTurnier] = useState<Turnier | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showNewTournament, setShowNewTournament] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push('/login?redirect=/admin')
    }
  }, [user, isAdmin, isLoading])

  useEffect(() => {
    if (isAdmin) fetchTurniere()
  }, [isAdmin])

  async function fetchTurniere() {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/turniere', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setTurniere(data.turniere ?? [])
    } catch {
      console.error('Failed to fetch tournaments')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTurnierDetail(id: number) {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSelectedTurnier(data.turnier)
    } catch {
      console.error('Failed to fetch tournament detail')
    }
  }

  async function handleStartTurnier(id: number) {
    if (!confirm('Turnier jetzt starten? Die Anmeldungsphase wird beendet und das Bracket generiert.')) return
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${id}/starten`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', `Turnier gestartet! ${data.spieleAnzahl} Spiele erstellt.`)
        fetchTurniere()
        fetchTurnierDetail(id)
      } else {
        showMessage('error', data.error ?? 'Fehler beim Starten')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleDeleteTurnier(id: number) {
    if (!confirm('Turnier wirklich löschen? Alle Spiele und Anmeldungen werden entfernt. Diese Aktion kann nicht rückgängig gemacht werden!')) return
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Turnier gelöscht')
        if (selectedTurnier?.id === id) setSelectedTurnier(null)
        fetchTurniere()
      } else {
        showMessage('error', data.error ?? 'Fehler beim Löschen')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleSelectWinner(spielId: number, siegerId: number, ergebnis: string) {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/spiele/${spielId}/ergebnis`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ergebnis, siegerId }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Ergebnis eingetragen!')
        if (selectedTurnier) fetchTurnierDetail(selectedTurnier.id)
        fetchTurniere()
      } else {
        showMessage('error', data.error ?? 'Fehler beim Eintragen')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleUpdateSetzung(anmeldungId: number, setzung: number | null, turnierId: number) {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/anmeldungen/${anmeldungId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setzung }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', `Setzung ${setzung ?? '-'} gespeichert`)
        fetchTurnierDetail(turnierId)
      } else {
        showMessage('error', data.error ?? 'Fehler beim Speichern')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleRemoveSpieler(anmeldungId: number, turnierId: number) {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/anmeldungen/${anmeldungId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', data.message ?? 'Spieler abgemeldet')
        fetchTurnierDetail(turnierId)
        fetchTurniere()
      } else {
        showMessage('error', data.error ?? 'Fehler beim Abmelden')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleAddSpieler(name: string, email: string, turnierId: number) {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${turnierId}/spieler-hinzufuegen`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', data.message ?? 'Spieler hinzugefügt')
        fetchTurnierDetail(turnierId)
        fetchTurniere()
      } else {
        showMessage('error', data.error ?? 'Fehler beim Hinzufügen')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleMarkLaufend(spielId: number, turnierId: number) {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/spiele/${spielId}/ergebnis`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Spiel läuft jetzt!')
        fetchTurnierDetail(turnierId)
      } else {
        showMessage('error', data.error ?? 'Fehler')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleUpdateSpielplan(spielId: number, platz: string, geplanteZeit: string, turnierId: number) {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${turnierId}/spiele`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spielId, platz, geplanteZeit }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Spielplan aktualisiert!')
        fetchTurnierDetail(turnierId)
      } else {
        showMessage('error', data.error ?? 'Fehler')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  async function handleCreateTurnier() {
    if (!newName.trim()) {
      showMessage('error', 'Bitte geben Sie einen Namen ein')
      return
    }
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/turniere', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName, beschreibung: newDesc }),
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Turnier erstellt!')
        setNewName('')
        setNewDesc('')
        setShowNewTournament(false)
        fetchTurniere()
      } else {
        showMessage('error', data.error ?? 'Fehler')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    }
  }

  function handleRefreshTurnier(id: number) {
    fetchTurnierDetail(id)
    fetchTurniere()
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  if (isLoading || loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin text-4xl">⚙️</div>
        <p className="text-gray-500 mt-3">Lade Admin-Panel...</p>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin-Panel</h1>
          <p className="text-gray-500 text-sm">Turnier-Verwaltung</p>
        </div>
        <button
          onClick={() => setShowNewTournament(!showNewTournament)}
          className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors text-sm font-medium"
        >
          + Neues Turnier
        </button>
      </div>

      {/* New tournament form */}
      {showNewTournament && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
          <h3 className="font-semibold mb-4 text-gray-700">Neues Turnier erstellen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Turniername"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Optionale Beschreibung"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreateTurnier}
              className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
            >
              Erstellen
            </button>
            <button
              onClick={() => setShowNewTournament(false)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Tournament list */}
      <div className="space-y-4">
        {turniere.map((turnier) => (
          <TurnierAdminCard
            key={turnier.id}
            turnier={turnier}
            isExpanded={selectedTurnier?.id === turnier.id}
            onExpand={() => {
              if (selectedTurnier?.id === turnier.id) {
                setSelectedTurnier(null)
              } else {
                fetchTurnierDetail(turnier.id)
              }
            }}
            selectedTurnier={selectedTurnier?.id === turnier.id ? selectedTurnier : null}
            onStartTurnier={handleStartTurnier}
            onDeleteTurnier={handleDeleteTurnier}
            onSelectWinner={handleSelectWinner}
            onUpdateSpielplan={handleUpdateSpielplan}
            onUpdateSetzung={handleUpdateSetzung}
            onMarkLaufend={handleMarkLaufend}
            onAddSpieler={handleAddSpieler}
            onRefresh={handleRefreshTurnier}
            onRemoveSpieler={handleRemoveSpieler}
          />
        ))}
      </div>

      {/* Toast */}
      {message && (
        <div className={`toast ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

// ── TurnierAdminCard ──────────────────────────────────────────────────────────
function TurnierAdminCard({
  turnier,
  isExpanded,
  onExpand,
  selectedTurnier,
  onStartTurnier,
  onDeleteTurnier,
  onSelectWinner,
  onUpdateSpielplan,
  onUpdateSetzung,
  onMarkLaufend,
  onAddSpieler,
  onRefresh,
  onRemoveSpieler,
}: {
  turnier: Turnier
  isExpanded: boolean
  onExpand: () => void
  selectedTurnier: Turnier | null
  onStartTurnier: (id: number) => void
  onDeleteTurnier: (id: number) => void
  onSelectWinner: (spielId: number, siegerId: number, ergebnis: string) => void
  onUpdateSpielplan: (spielId: number, platz: string, geplanteZeit: string, turnierId: number) => void
  onUpdateSetzung: (anmeldungId: number, setzung: number | null, turnierId: number) => void
  onMarkLaufend: (spielId: number, turnierId: number) => void
  onAddSpieler: (name: string, email: string, turnierId: number) => void
  onRefresh: (turnierId: number) => void
  onRemoveSpieler: (anmeldungId: number, turnierId: number) => void
}) {
  const [activeTab, setActiveTab] = useState<'bracket' | 'spieler' | 'spielplan'>('bracket')
  const [editingSpiel, setEditingSpiel] = useState<number | null>(null)
  const [spielPlatz, setSpielPlatz] = useState('')
  const [spielZeit, setSpielZeit] = useState('')
  const [showLosModal, setShowLosModal] = useState(false)

  const spielerAnzahl = turnier._count?.anmeldungen ?? 0

  const statusLabel = {
    anmeldung: 'Anmeldung',
    aktiv: 'Aktiv',
    abgeschlossen: 'Abgeschlossen',
  }[turnier.status]

  const statusColor = {
    anmeldung: 'bg-blue-100 text-blue-800',
    aktiv: 'bg-green-100 text-green-800',
    abgeschlossen: 'bg-gray-100 text-gray-600',
  }[turnier.status]

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') ?? '' : ''

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Card header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onExpand}
      >
        <div className="flex items-center gap-3">
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', statusColor)}>
            {statusLabel}
          </span>
          <h3 className="font-semibold text-gray-800">{turnier.name}</h3>
          <span className="text-gray-400 text-sm">({spielerAnzahl}/16 Spieler)</span>
        </div>
        <div className="flex items-center gap-2">
          {turnier.status === 'anmeldung' && spielerAnzahl >= 2 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStartTurnier(turnier.id)
              }}
              className="bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors font-medium"
            >
              Turnier starten
            </button>
          )}
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteTurnier(turnier.id)
            }}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 text-sm px-2 py-1.5 rounded-lg transition-colors"
            title="Turnier löschen"
          >
            🗑️
          </button>
          <span className="text-gray-400 text-lg">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && selectedTurnier && (
        <div className="border-t">
          {/* Sub-tabs */}
          <div className="flex border-b bg-gray-50 overflow-x-auto">
            {(['bracket', 'spieler', 'spielplan'] as const).map((tab) => {
              const labels = { bracket: 'Bracket', spieler: 'Spieler verwalten', spielplan: 'Spielplan' }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                    activeTab === tab
                      ? 'bg-white border-b-2 border-green-700 text-green-700'
                      : 'text-gray-600 hover:text-gray-800'
                  )}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>

          <div className="p-4">
            {/* Bracket */}
            {activeTab === 'bracket' && (
              <BracketView
                spiele={selectedTurnier.spiele ?? []}
                isAdmin={true}
                onSelectWinner={onSelectWinner}
                onMarkLaufend={(spielId) => onMarkLaufend(spielId, selectedTurnier.id)}
              />
            )}

            {/* Spieler verwalten */}
            {activeTab === 'spieler' && (
              <div className="space-y-4">
                {/* Spieler hinzufügen (nur wenn Anmeldungsphase) */}
                {selectedTurnier.status === 'anmeldung' && (
                  <>
                    <AddSpielerForm
                      turnierId={selectedTurnier.id}
                      onAdd={onAddSpieler}
                      currentCount={selectedTurnier.anmeldungen?.length ?? 0}
                      maxSpieler={selectedTurnier.maxSpieler ?? 16}
                    />

                    {/* Auslosung button (≥ 2 players) */}
                    {(selectedTurnier.anmeldungen?.length ?? 0) >= 2 && (
                      <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-purple-800">Auslosung</p>
                          <p className="text-xs text-purple-600">Spieler zufällig nummerieren (Setzungen vergeben)</p>
                        </div>
                        <button
                          onClick={() => setShowLosModal(true)}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-1.5"
                        >
                          🎲 Auslosung starten
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Spielerliste */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">
                    Angemeldete Spieler ({selectedTurnier.anmeldungen?.length ?? 0} / {selectedTurnier.maxSpieler ?? 16})
                  </h4>
                  {!selectedTurnier.anmeldungen?.length ? (
                    <p className="text-gray-400 text-sm italic">Noch keine Spieler angemeldet</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTurnier.anmeldungen.map((anmeldung, idx) => (
                        <SetzungRow
                          key={anmeldung.id}
                          anmeldung={anmeldung}
                          index={idx}
                          turnierId={selectedTurnier.id}
                          onSave={onUpdateSetzung}
                          canRemove={selectedTurnier.status === 'anmeldung'}
                          onRemove={() => onRemoveSpieler(anmeldung.id, selectedTurnier.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Spielplan */}
            {activeTab === 'spielplan' && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Spielplan verwalten</h4>
                {!selectedTurnier.spiele?.length ? (
                  <p className="text-gray-500 text-sm">Keine Spiele vorhanden</p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {selectedTurnier.spiele.map((spiel) => (
                      <div key={spiel.id} className="border rounded-lg p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{spiel.runde}</span>
                          <span className="font-medium">{spiel.spieler1?.name ?? (spiel.spieler1Id ? '?' : 'offen')}</span>
                          <span className="text-gray-400">vs</span>
                          <span className="font-medium">{spiel.spieler2?.name ?? (spiel.spieler2Id ? '?' : 'offen')}</span>
                          <span className={clsx('ml-auto text-xs px-1.5 py-0.5 rounded',
                            spiel.status === 'abgeschlossen' ? 'bg-green-100 text-green-700' :
                            spiel.status === 'laufend' ? 'bg-yellow-100 text-yellow-700' :
                            spiel.status === 'walkover' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          )}>{spiel.status}</span>
                        </div>
                        {editingSpiel === spiel.id ? (
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              placeholder="Platz (z.B. 1)"
                              value={spielPlatz}
                              onChange={(e) => setSpielPlatz(e.target.value)}
                              className="border rounded px-2 py-1 text-xs w-24"
                            />
                            <input
                              type="datetime-local"
                              value={spielZeit}
                              onChange={(e) => setSpielZeit(e.target.value)}
                              className="border rounded px-2 py-1 text-xs"
                            />
                            <button
                              onClick={() => {
                                onUpdateSpielplan(spiel.id, spielPlatz, spielZeit, selectedTurnier.id)
                                setEditingSpiel(null)
                              }}
                              className="bg-green-700 text-white px-2 py-1 rounded text-xs"
                            >
                              Speichern
                            </button>
                            <button
                              onClick={() => setEditingSpiel(null)}
                              className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs"
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {spiel.platz && <span className="text-gray-500">Platz {spiel.platz}</span>}
                            {spiel.geplanteZeit && (
                              <span className="text-gray-500">
                                {new Date(spiel.geplanteZeit).toLocaleString('de-DE', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setEditingSpiel(spiel.id)
                                setSpielPlatz(spiel.platz ?? '')
                                setSpielZeit(spiel.geplanteZeit
                                  ? new Date(spiel.geplanteZeit).toISOString().slice(0, 16)
                                  : '')
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs ml-auto"
                            >
                              Bearbeiten
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auslosung Modal */}
      {showLosModal && selectedTurnier && (
        <LosAnimation
          turnierId={selectedTurnier.id}
          spieler={
            selectedTurnier.anmeldungen?.map((a) => ({
              anmeldungId: a.id,
              name: a.spieler?.name ?? 'Unbekannt',
              setzung: a.setzung,
            })) ?? []
          }
          token={token}
          onDone={() => {
            setShowLosModal(false)
            onRefresh(selectedTurnier.id)
          }}
          onClose={() => setShowLosModal(false)}
        />
      )}
    </div>
  )
}

// ── SetzungRow ────────────────────────────────────────────────────────────────
function SetzungRow({
  anmeldung, index, turnierId, onSave, canRemove, onRemove,
}: {
  anmeldung: Anmeldung
  index: number
  turnierId: number
  onSave: (anmeldungId: number, setzung: number | null, turnierId: number) => void
  canRemove?: boolean
  onRemove?: () => void
}) {
  const [setzung, setSetzung] = useState(anmeldung.setzung?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const val = setzung.trim() === '' ? null : parseInt(setzung)
    await onSave(anmeldung.id, val, turnierId)
    setSaving(false)
  }

  async function handleRemove() {
    if (!confirm(`${anmeldung.spieler?.name} wirklich abmelden?`)) return
    setRemoving(true)
    await onRemove?.()
    setRemoving(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-2 border rounded-lg text-sm">
      <span className="text-gray-400 w-5">{index + 1}.</span>
      <span className="flex-1 font-medium">{anmeldung.spieler?.name}</span>
      <span className="text-gray-400 text-xs">{anmeldung.spieler?.email}</span>
      {anmeldung.setzung && (
        <span className="bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
          S{anmeldung.setzung}
        </span>
      )}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Setzung:</label>
        <input
          type="number"
          min={1}
          max={16}
          value={setzung}
          onChange={(e) => setSetzung(e.target.value)}
          className="border rounded w-14 px-2 py-0.5 text-xs text-center"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-700 text-white px-2 py-0.5 rounded text-xs hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? '...' : 'Speichern'}
        </button>
      </div>
      {canRemove && onRemove && (
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-0.5 rounded text-xs transition-colors disabled:opacity-50"
          title="Spieler abmelden"
        >
          {removing ? '...' : '✕ Abmelden'}
        </button>
      )}
    </div>
  )
}

// ── AddSpielerForm ────────────────────────────────────────────────────────────
function AddSpielerForm({
  turnierId, onAdd, currentCount, maxSpieler,
}: {
  turnierId: number
  onAdd: (name: string, email: string, turnierId: number) => void
  currentCount: number
  maxSpieler: number
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setLoading(true)
    await onAdd(name.trim(), email.trim(), turnierId)
    setName('')
    setEmail('')
    setLoading(false)
  }

  if (currentCount >= maxSpieler) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
        Turnier ist voll ({currentCount}/{maxSpieler} Spieler)
      </div>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <h4 className="font-semibold text-green-800 mb-3 text-sm">Spieler manuell hinzufügen</h4>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Max Mustermann"
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 w-44"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="max@example.com"
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 w-52"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !name.trim() || !email.trim()}
          className="bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Hinzufügen...' : '+ Hinzufügen'}
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-2">
        Falls die Email noch nicht existiert, wird automatisch ein Account erstellt.
        Aktuell: {currentCount}/{maxSpieler} Spieler
      </p>
    </div>
  )
}
