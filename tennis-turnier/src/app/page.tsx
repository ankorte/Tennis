'use client'

import { useEffect, useState } from 'react'
import TournamentCard from '@/components/TournamentCard'
import { useAuth } from '@/components/AuthProvider'
import { Turnier } from '@/types'

type Filter = 'alle' | 'anmeldung' | 'aktiv' | 'abgeschlossen'

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [turniere, setTurniere] = useState<Turnier[]>([])
  const [loading, setLoading] = useState(true)
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set())
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [filter, setFilter] = useState<Filter>('alle')

  useEffect(() => {
    fetchTurniere()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user && turniere.length > 0) fetchRegistrations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, turniere.length])

  async function fetchTurniere() {
    try {
      const res = await fetch('/api/turniere')
      const data = await res.json()
      setTurniere(data.turniere ?? [])
    } catch {
      console.error('Failed to fetch tournaments')
    } finally {
      setLoading(false)
    }
  }

  async function fetchRegistrations() {
    if (!user) return
    try {
      const token = localStorage.getItem('auth-token')
      const registered = new Set<number>()
      await Promise.all(
        turniere.map(async (t) => {
          const res = await fetch(`/api/turniere/${t.id}`, { headers: { Authorization: `Bearer ${token}` } })
          const data = await res.json()
          if (data.turnier?.anmeldungen?.some((a: { spielerId: number }) => a.spielerId === user.userId)) {
            registered.add(t.id)
          }
        })
      )
      setRegisteredIds(registered)
    } catch {
      console.error('Failed to fetch registrations')
    }
  }

  async function handleRegister(turnierId: number) {
    if (!user) return
    setActionLoading(turnierId)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${turnierId}/anmelden`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setRegisteredIds((prev) => new Set([...prev, turnierId]))
        setTurniere((prev) =>
          prev.map((t) => t.id === turnierId ? { ...t, _count: { anmeldungen: (t._count?.anmeldungen ?? 0) + 1 } } : t)
        )
        showMessage('success', 'Erfolgreich angemeldet!')
      } else {
        showMessage('error', data.error ?? 'Anmeldung fehlgeschlagen')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleUnregister(turnierId: number) {
    if (!user) return
    setActionLoading(turnierId)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${turnierId}/anmelden`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setRegisteredIds((prev) => { const next = new Set(prev); next.delete(turnierId); return next })
        setTurniere((prev) =>
          prev.map((t) => t.id === turnierId ? { ...t, _count: { anmeldungen: Math.max(0, (t._count?.anmeldungen ?? 1) - 1) } } : t)
        )
        showMessage('success', 'Erfolgreich abgemeldet!')
      } else {
        showMessage('error', data.error ?? 'Abmeldung fehlgeschlagen')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    } finally {
      setActionLoading(null)
    }
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  // Real dynamic stats
  const totalSpieler = turniere.reduce((sum, t) => sum + (t._count?.anmeldungen ?? 0), 0)
  const activeTurniere = turniere.filter((t) => t.status === 'aktiv').length
  const offeneTurniere = turniere.filter((t) => t.status === 'anmeldung').length

  // Filter
  const filteredTurniere = filter === 'alle' ? turniere : turniere.filter((t) => t.status === filter)

  const filterConfig: { value: Filter; label: string; count: number }[] = [
    { value: 'alle',           label: 'Alle',            count: turniere.length },
    { value: 'anmeldung',      label: 'Anmeldung offen', count: offeneTurniere },
    { value: 'aktiv',          label: 'Aktiv',           count: activeTurniere },
    { value: 'abgeschlossen',  label: 'Abgeschlossen',   count: turniere.filter((t) => t.status === 'abgeschlossen').length },
  ]

  return (
    <div className="space-y-10">

      {/* Hero */}
      <div className="th-gradient text-white rounded-2xl p-8 md:p-12 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_bottom_right,_white,_transparent)]" />
        <div className="relative max-w-2xl">
          <div className="text-5xl mb-4">🎾</div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Tennis Turnier Manager</h1>
          <p className="text-white/80 text-lg mb-8">
            Double Elimination System — jeder Verlierer bekommt eine zweite Chance!
          </p>

          {/* Dynamic stats */}
          {!loading && (
            <div className="flex flex-wrap gap-3">
              <div className="bg-white/15 backdrop-blur rounded-xl px-5 py-3 text-center min-w-[90px]">
                <div className="text-2xl font-bold">{turniere.length}</div>
                <div className="text-xs text-white/70 mt-0.5">Turniere</div>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-xl px-5 py-3 text-center min-w-[90px]">
                <div className="text-2xl font-bold">{totalSpieler}</div>
                <div className="text-xs text-white/70 mt-0.5">Angemeldete Spieler</div>
              </div>
              {activeTurniere > 0 && (
                <div className="bg-white/15 backdrop-blur rounded-xl px-5 py-3 text-center min-w-[90px]">
                  <div className="text-2xl font-bold flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
                    {activeTurniere}
                  </div>
                  <div className="text-xs text-white/70 mt-0.5">Laufend</div>
                </div>
              )}
              {offeneTurniere > 0 && (
                <div className="bg-white/15 backdrop-blur rounded-xl px-5 py-3 text-center min-w-[90px]">
                  <div className="text-2xl font-bold">{offeneTurniere}</div>
                  <div className="text-xs text-white/70 mt-0.5">Anmeldung offen</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tournaments section */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h2 className="text-2xl font-bold text-gray-800">Turniere</h2>

          {/* Filter tabs */}
          {!loading && turniere.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filterConfig.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  disabled={f.count === 0 && f.value !== 'alle'}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5
                    ${filter === f.value
                      ? 'th-btn shadow-sm'
                      : f.count === 0
                      ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {f.label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold
                    ${filter === f.value ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-md h-56 animate-pulse">
                <div className="bg-gray-200 h-20 rounded-t-xl" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-full" />
                  <div className="h-8 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTurniere.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🎾</div>
            <p className="text-lg font-medium text-gray-500">
              {filter === 'alle' ? 'Noch keine Turniere vorhanden' : `Keine ${filterConfig.find(f => f.value === filter)?.label}-Turniere`}
            </p>
            {filter !== 'alle' && (
              <button onClick={() => setFilter('alle')} className="mt-2 text-sm text-blue-500 hover:underline">
                Alle anzeigen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTurniere.map((turnier) => (
              <TournamentCard
                key={turnier.id}
                turnier={turnier}
                isRegistered={registeredIds.has(turnier.id)}
                onRegister={() => handleRegister(turnier.id)}
                onUnregister={() => handleUnregister(turnier.id)}
                isLoggedIn={!authLoading && !!user}
                isLoading={actionLoading === turnier.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-5">So funktioniert Double Elimination</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '🏆', title: 'Siegerseite (WB)', text: 'Alle Spieler starten in der Siegerseite. Wer verliert, wechselt zur Verliererseite — noch ist nichts verloren.' },
            { icon: '🔄', title: 'Verliererseite (LB)', text: 'Spieler auf der Verliererseite haben eine zweite Chance. Erst die zweite Niederlage beendet das Turnier.' },
            { icon: '⭐', title: 'Grand Final', text: 'Die Sieger beider Brackets treffen im Grand Final aufeinander. Der WB-Sieger hat dabei einen Vorteil.' },
          ].map((item) => (
            <div key={item.title} className="text-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h4 className="font-semibold mb-2 text-gray-800">{item.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
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
