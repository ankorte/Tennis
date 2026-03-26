'use client'

import { useEffect, useState } from 'react'
import TournamentCard from '@/components/TournamentCard'
import { useAuth } from '@/components/AuthProvider'
import { Turnier } from '@/types'

export default function TurnierePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [turniere, setTurniere] = useState<Turnier[]>([])
  const [loading, setLoading] = useState(true)
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set())
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchTurniere()
  }, [])

  useEffect(() => {
    if (user && turniere.length > 0) {
      fetchRegistrations()
    }
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
          const res = await fetch(`/api/turniere/${t.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
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
          prev.map((t) =>
            t.id === turnierId
              ? { ...t, _count: { anmeldungen: (t._count?.anmeldungen ?? 0) + 1 } }
              : t
          )
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
        setRegisteredIds((prev) => {
          const next = new Set(prev)
          next.delete(turnierId)
          return next
        })
        setTurniere((prev) =>
          prev.map((t) =>
            t.id === turnierId
              ? { ...t, _count: { anmeldungen: Math.max(0, (t._count?.anmeldungen ?? 1) - 1) } }
              : t
          )
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Alle Turniere</h1>
      <p className="text-gray-500 mb-6">Melden Sie sich für Ihre Wunschturniere an</p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-md h-48 animate-pulse">
              <div className="bg-gray-200 h-16 rounded-t-xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {turniere.map((turnier) => (
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

      {message && (
        <div className={`toast ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
