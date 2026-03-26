'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import clsx from 'clsx'
import { useAuth } from '@/components/AuthProvider'
import BracketView from '@/components/BracketView'
import { Turnier, Spiel } from '@/types'

type Tab = 'bracket' | 'spieler' | 'spielplan' | 'rangliste'

export default function TurnierDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const router = useRouter()

  const [turnier, setTurnier] = useState<Turnier | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('bracket')
  const [isRegistered, setIsRegistered] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (id) fetchTurnier()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (turnier && user) {
      const registered = turnier.anmeldungen?.some((a) => a.spielerId === user.userId)
      setIsRegistered(!!registered)
    }
  }, [turnier, user])

  async function fetchTurnier() {
    try {
      const token = localStorage.getItem('auth-token')
      const headers: HeadersInit = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/turniere/${id}`, { headers })
      const data = await res.json()

      if (!res.ok) {
        router.push('/')
        return
      }

      setTurnier(data.turnier)
    } catch {
      console.error('Failed to fetch tournament')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!user) {
      router.push('/login')
      return
    }
    setActionLoading(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${id}/anmelden`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setIsRegistered(true)
        showMessage('success', 'Erfolgreich angemeldet!')
        fetchTurnier()
      } else {
        showMessage('error', data.error ?? 'Anmeldung fehlgeschlagen')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnregister() {
    setActionLoading(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(`/api/turniere/${id}/anmelden`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setIsRegistered(false)
        showMessage('success', 'Erfolgreich abgemeldet!')
        fetchTurnier()
      } else {
        showMessage('error', data.error ?? 'Abmeldung fehlgeschlagen')
      }
    } catch {
      showMessage('error', 'Verbindungsfehler')
    } finally {
      setActionLoading(false)
    }
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (!turnier) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Turnier nicht gefunden</p>
        <Link href="/" className="text-green-700 mt-2 inline-block">← Zurück zur Übersicht</Link>
      </div>
    )
  }

  const spielerAnzahl = turnier.anmeldungen?.length ?? 0
  const isFull = spielerAnzahl >= turnier.maxSpieler

  const statusLabel = {
    anmeldung: 'Anmeldung läuft',
    aktiv: 'Turnier aktiv',
    abgeschlossen: 'Abgeschlossen',
  }[turnier.status]

  const statusClass = {
    anmeldung: 'badge-anmeldung',
    aktiv: 'badge-aktiv',
    abgeschlossen: 'badge-abgeschlossen',
  }[turnier.status]

  const completedMatches = turnier.spiele?.filter((s) => s.status === 'abgeschlossen' || s.status === 'walkover').length ?? 0
  const totalMatches = turnier.spiele?.length ?? 0

  return (
    <div>
      {/* Header */}
      <div className="th-gradient text-white rounded-2xl p-6 md:p-8 mb-6 shadow-lg">
        <Link href="/" className="text-green-200 hover:text-white text-sm mb-3 inline-block">
          ← Zurück zur Übersicht
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{turnier.name}</h1>
            {turnier.beschreibung && (
              <p className="text-green-100 max-w-xl">{turnier.beschreibung}</p>
            )}
          </div>
          <span className={statusClass}>{statusLabel}</span>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-5">
          <div className="bg-white/10 rounded-lg px-4 py-2 text-sm">
            <span className="text-green-200">Spieler: </span>
            <span className="font-bold">{spielerAnzahl} / {turnier.maxSpieler}</span>
          </div>
          {totalMatches > 0 && (
            <div className="bg-white/10 rounded-lg px-4 py-2 text-sm">
              <span className="text-green-200">Spiele: </span>
              <span className="font-bold">{completedMatches} / {totalMatches}</span>
            </div>
          )}
        </div>

        {/* Share buttons – shown when tournament is active or finished */}
        {(turnier.status === 'aktiv' || turnier.status === 'abgeschlossen') && (
          <ShareButtons turnierId={turnier.id} turnierName={turnier.name} />
        )}

        {/* Registration button */}
        {turnier.status === 'anmeldung' && (
          <div className="mt-4">
            {!user ? (
              <Link
                href={`/login?redirect=/turniere/${id}`}
                className="inline-block bg-white text-green-800 font-medium px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
              >
                Zum Anmelden einloggen
              </Link>
            ) : isRegistered ? (
              <div className="flex items-center gap-3">
                <span className="text-green-200 text-sm">✓ Sie sind angemeldet</span>
                <button
                  onClick={handleUnregister}
                  disabled={actionLoading}
                  className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  Abmelden
                </button>
              </div>
            ) : isFull ? (
              <span className="text-red-300 text-sm">Turnier ist voll</span>
            ) : (
              <button
                onClick={handleRegister}
                disabled={actionLoading}
                className="bg-white text-green-800 font-medium px-4 py-2 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Wird verarbeitet...' : 'Jetzt anmelden'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {(['bracket', 'spieler', 'spielplan', 'rangliste'] as Tab[]).map((tab) => {
          const labels: Record<Tab, string> = { bracket: 'Bracket', spieler: 'Spieler', spielplan: 'Spielplan', rangliste: '🏅 Rangliste' }
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-5 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors',
                activeTab === tab
                  ? 'bg-green-700 text-white'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              )}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* Bracket Tab */}
      {activeTab === 'bracket' && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <BracketView spiele={turnier.spiele ?? []} />
        </div>
      )}

      {/* Spieler Tab */}
      {activeTab === 'spieler' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">
              Angemeldete Spieler ({spielerAnzahl} / {turnier.maxSpieler})
            </h3>
          </div>
          {spielerAnzahl === 0 ? (
            <div className="text-center py-8 text-gray-500">Noch keine Anmeldungen</div>
          ) : (
            <div className="divide-y">
              {turnier.anmeldungen?.map((anmeldung, idx) => (
                <div key={anmeldung.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-6">{idx + 1}.</span>
                  {anmeldung.setzung && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      S{anmeldung.setzung}
                    </span>
                  )}
                  <span className="font-medium text-gray-800">{anmeldung.spieler?.name}</span>
                  <span className="text-gray-400 text-sm ml-auto">{anmeldung.spieler?.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spielplan Tab */}
      {activeTab === 'spielplan' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">Spielplan</h3>
          </div>
          {!turnier.spiele || turnier.spiele.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Keine Spiele vorhanden (Turnier noch nicht gestartet)
            </div>
          ) : (
            <div className="divide-y">
              {turnier.spiele
                .filter((s) => s.spieler1Id || s.spieler2Id)
                .map((spiel) => (
                  <MatchRow key={spiel.id} spiel={spiel} />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Rangliste Tab */}
      {activeTab === 'rangliste' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">🏅 Rangliste</h3>
            <span className="text-xs text-gray-400">{turnier.status === 'abgeschlossen' ? 'Endstand' : 'Aktueller Stand'}</span>
          </div>
          <RanglisteTab turnier={turnier} />
        </div>
      )}

      {/* Toast */}
      {message && (
        <div className={`toast ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

// ── ShareButtons ──────────────────────────────────────────────────────────────
function ShareButtons({ turnierId, turnierName }: { turnierId: number | string; turnierName: string }) {
  const [copied, setCopied] = useState(false)

  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/turniere/${turnierId}`
      : ''

  const shareText = `🎾 ${turnierName} – Ergebnisse & Bracket jetzt ansehen!\n${url}`
  const waLink    = `https://wa.me/?text=${encodeURIComponent(shareText)}`
  const mailLink  = `mailto:?subject=${encodeURIComponent(`Tennis-Turnier: ${turnierName}`)}&body=${encodeURIComponent(shareText)}`

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/20">
      <span className="text-green-200 text-xs self-center mr-1">Teilen:</span>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
      >
        📱 WhatsApp
      </a>
      <a
        href={mailLink}
        className="flex items-center gap-1.5 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
      >
        ✉️ E-Mail
      </a>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
      >
        {copied ? '✅ Kopiert!' : '🔗 Link kopieren'}
      </button>
    </div>
  )
}

// ── RanglisteTab ──────────────────────────────────────────────────────────────
function RanglisteTab({ turnier }: { turnier: Turnier }) {
  const anmeldungen = turnier.anmeldungen ?? []
  const spiele = turnier.spiele ?? []

  if (turnier.status === 'anmeldung') {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-3xl mb-2">🎾</div>
        <p>Die Rangliste ist nach dem Turnierstart verfügbar.</p>
      </div>
    )
  }

  // Compute stats per player
  const stats = new Map<number, {
    name: string
    wins: number
    losses: number
    highestRound: string
    isEliminated: boolean
    isChampion: boolean
  }>()

  anmeldungen.forEach((a) => {
    if (a.spieler) {
      stats.set(a.spieler.id, {
        name: a.spieler.name,
        wins: 0, losses: 0,
        highestRound: '',
        isEliminated: false,
        isChampion: false,
      })
    }
  })

  // GF winner = champion
  const gfMatch = spiele.find((s) => s.runde === 'GF' && s.status === 'abgeschlossen')
  if (gfMatch?.siegerId) {
    const s = stats.get(gfMatch.siegerId)
    if (s) s.isChampion = true
  }

  const roundOrder = ['WB-R1','WB-R2','WB-SF','WB-F','LB-R1','LB-R2','LB-R3','LB-R4','LB-SF','LB-F','GF']

  spiele.forEach((spiel) => {
    if (spiel.status !== 'abgeschlossen' && spiel.status !== 'walkover') return
    if (!spiel.siegerId) return
    const loserId = spiel.spieler1Id === spiel.siegerId ? spiel.spieler2Id : spiel.spieler1Id

    const winner = stats.get(spiel.siegerId)
    if (winner) {
      winner.wins++
      const roundIdx = roundOrder.indexOf(spiel.runde)
      const curIdx = roundOrder.indexOf(winner.highestRound)
      if (roundIdx > curIdx) winner.highestRound = spiel.runde
    }

    if (loserId) {
      const loser = stats.get(loserId)
      if (loser) {
        loser.losses++
        const roundIdx = roundOrder.indexOf(spiel.runde)
        const curIdx = roundOrder.indexOf(loser.highestRound)
        if (roundIdx > curIdx) loser.highestRound = spiel.runde
        if (spiel.runde.startsWith('LB') || spiel.runde === 'GF') {
          loser.isEliminated = true
        }
      }
    }
  })

  const standings = Array.from(stats.entries())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => {
      if (a.isChampion) return -1
      if (b.isChampion) return 1
      if (a.losses !== b.losses) return a.losses - b.losses
      return b.wins - a.wins
    })

  const roundLabel: Record<string, string> = {
    'WB-R1':'WB Runde 1','WB-R2':'WB Runde 2','WB-SF':'WB Halbfinale','WB-F':'WB Finale',
    'LB-R1':'LB Runde 1','LB-R2':'LB Runde 2','LB-R3':'LB Runde 3','LB-R4':'LB Runde 4',
    'LB-SF':'LB Halbfinale','LB-F':'LB Finale','GF':'Grand Final',
  }

  if (standings.length === 0) {
    return <div className="text-center py-10 text-gray-400">Keine Spieler vorhanden</div>
  }

  return (
    <div className="divide-y">
      {standings.map((player, idx) => (
        <div key={player.id} className={clsx(
          'flex items-center gap-4 px-4 py-3',
          player.isChampion && 'bg-yellow-50',
          player.isEliminated && !player.isChampion && 'opacity-60'
        )}>
          {/* Rank */}
          <div className={clsx(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
            idx === 0 ? 'bg-yellow-400 text-white' :
            idx === 1 ? 'bg-gray-300 text-gray-700' :
            idx === 2 ? 'bg-amber-600 text-white' :
            'bg-gray-100 text-gray-500'
          )}>
            {idx === 0 && player.isChampion ? '🏆' : idx + 1}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 truncate">{player.name}</span>
              {player.isChampion && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">Turniersieger</span>}
              {!player.isEliminated && !player.isChampion && turnier.status === 'aktiv' && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Noch im Turnier</span>
              )}
            </div>
            {player.highestRound && (
              <p className="text-xs text-gray-400 mt-0.5">Zuletzt: {roundLabel[player.highestRound] ?? player.highestRound}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-3 text-sm flex-shrink-0">
            <div className="text-center">
              <div className="font-bold text-green-600">{player.wins}</div>
              <div className="text-xs text-gray-400">Siege</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-red-400">{player.losses}</div>
              <div className="text-xs text-gray-400">Niederl.</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-600">
                {player.wins + player.losses > 0
                  ? Math.round((player.wins / (player.wins + player.losses)) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-gray-400">Quote</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MatchRow ──────────────────────────────────────────────────────────────────
function MatchRow({ spiel }: { spiel: Spiel }) {
  const statusLabel = {
    ausstehend: 'Ausstehend',
    laufend: 'Laufend',
    abgeschlossen: 'Abgeschlossen',
    walkover: 'Walkover',
  }[spiel.status]

  const statusColor = {
    ausstehend: 'bg-gray-100 text-gray-600',
    laufend: 'bg-yellow-100 text-yellow-700',
    abgeschlossen: 'bg-green-100 text-green-700',
    walkover: 'bg-blue-100 text-blue-700',
  }[spiel.status]

  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-xs font-mono text-gray-400 w-16">{spiel.runde}#{spiel.spielNummer}</span>
      <div className="flex-1 flex flex-wrap items-center gap-2">
        <span className={clsx('font-medium', spiel.siegerId === spiel.spieler1Id && spiel.siegerId && 'text-green-700')}>
          {spiel.spieler1?.name ?? 'BYE'}
        </span>
        <span className="text-gray-400">vs</span>
        <span className={clsx('font-medium', spiel.siegerId === spiel.spieler2Id && spiel.siegerId && 'text-green-700')}>
          {spiel.spieler2?.name ?? 'BYE'}
        </span>
        {spiel.ergebnis && (
          <span className="text-sm text-gray-500 font-mono">({spiel.ergebnis})</span>
        )}
      </div>
      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', statusColor)}>
        {statusLabel}
      </span>
      {spiel.platz && <span className="text-xs text-gray-400">Platz {spiel.platz}</span>}
      {spiel.geplanteZeit && (
        <span className="text-xs text-gray-400">
          {new Date(spiel.geplanteZeit).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      )}
    </div>
  )
}
