'use client'

import { useState } from 'react'
import clsx from 'clsx'

interface Player {
  anmeldungId: number
  name: string
  setzung?: number | null
}

interface LosResult {
  setzung: number
  name: string
  anmeldungId: number
}

interface LosAnimationProps {
  turnierId: number
  spieler: Player[]
  token: string
  onDone: (result: LosResult[]) => void
  onClose: () => void
}

const COLORS = [
  'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
  'bg-yellow-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-violet-500', 'bg-sky-500',
]

export default function LosAnimation({ turnierId, spieler, token, onDone, onClose }: LosAnimationProps) {
  const [phase, setPhase] = useState<'ready' | 'shuffling' | 'result'>('ready')
  const [result, setResult] = useState<LosResult[]>([])
  const [error, setError] = useState('')
  const [shuffleCards, setShuffleCards] = useState(spieler.map(s => s.name))

  async function startLos() {
    setPhase('shuffling')

    // Shuffle animation: mehrfach umordnen
    let iterations = 0
    const interval = setInterval(() => {
      setShuffleCards(prev => {
        const arr = [...prev]
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[arr[i], arr[j]] = [arr[j], arr[i]]
        }
        return arr
      })
      iterations++
      if (iterations >= 12) {
        clearInterval(interval)
        doApiCall()
      }
    }, 150)
  }

  async function doApiCall() {
    try {
      const res = await fetch(`/api/turniere/${turnierId}/auslosung`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data.auslosung)
        setPhase('result')
      } else {
        setError(data.error ?? 'Fehler')
        setPhase('ready')
      }
    } catch {
      setError('Verbindungsfehler')
      setPhase('ready')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-500 p-5 text-white">
          <h2 className="text-xl font-bold">🎾 Auslosung</h2>
          <p className="text-green-100 text-sm mt-0.5">{spieler.length} Spieler werden ausgelost</p>
        </div>

        <div className="p-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</div>
          )}

          {/* READY */}
          {phase === 'ready' && (
            <div>
              <p className="text-gray-600 text-sm mb-4">
                Alle Spieler werden zufällig nummeriert (Setzungen 1–{spieler.length}).
                Vorhandene Setzungen werden überschrieben.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {spieler.map((s, i) => (
                  <div key={s.anmeldungId} className={clsx('rounded-lg px-3 py-2 text-white text-sm font-medium text-center', COLORS[i % COLORS.length])}>
                    {s.name}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={startLos}
                  className="flex-1 bg-green-700 text-white py-2.5 rounded-lg font-semibold hover:bg-green-800 transition-colors"
                >
                  🎲 Los ausführen!
                </button>
                <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* SHUFFLING */}
          {phase === 'shuffling' && (
            <div>
              <p className="text-center text-gray-500 text-sm mb-4 animate-pulse font-medium">
                🎲 Wird ausgelost...
              </p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {shuffleCards.map((name, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'rounded-lg px-3 py-2 text-white text-sm font-medium text-center transition-all duration-150',
                      COLORS[i % COLORS.length],
                      'scale-95 opacity-90'
                    )}
                    style={{ transform: `rotate(${(Math.random() - 0.5) * 8}deg)` }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RESULT */}
          {phase === 'result' && (
            <div>
              <p className="text-center text-green-700 font-semibold mb-4">✅ Auslosung abgeschlossen!</p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto mb-4">
                {result.map((r, i) => (
                  <div
                    key={r.anmeldungId}
                    className={clsx(
                      'flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium',
                      i < 4 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100'
                    )}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                      COLORS[i % COLORS.length]
                    )}>
                      {r.setzung}
                    </span>
                    <span className="flex-1">{r.name}</span>
                    {i < 4 && <span className="text-yellow-600 text-xs">Gesetzt</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onDone(result)}
                  className="flex-1 bg-green-700 text-white py-2.5 rounded-lg font-semibold hover:bg-green-800"
                >
                  Übernehmen
                </button>
                <button
                  onClick={() => { setPhase('ready'); setResult([]) }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Neu auslosen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
