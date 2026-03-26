'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Spiel } from '@/types'

interface MatchCardProps {
  spiel: Spiel
  onSelectWinner?: (spielId: number, siegerId: number, ergebnis: string) => void
  onMarkLaufend?: (spielId: number) => void
  isAdmin?: boolean
  compact?: boolean
}

export default function MatchCard({ spiel, onSelectWinner, onMarkLaufend, isAdmin, compact }: MatchCardProps) {
  const [ergebnis, setErgebnis] = useState('')
  const [showForm, setShowForm] = useState(false)

  const statusLabel = {
    ausstehend: 'Ausstehend',
    laufend: 'Laufend',
    abgeschlossen: 'Abgeschlossen',
    walkover: 'Walkover',
  }[spiel.status]

  const statusColor = {
    ausstehend: 'text-gray-400',
    laufend: 'text-yellow-600',
    abgeschlossen: 'text-green-600',
    walkover: 'text-blue-500',
  }[spiel.status]

  const player1Name = spiel.spieler1?.name ?? (spiel.spieler1Id ? '...' : 'BYE')
  const player2Name = spiel.spieler2?.name ?? (spiel.spieler2Id ? '...' : 'BYE')

  const isPlayer1Winner = spiel.siegerId !== null && spiel.siegerId === spiel.spieler1Id
  const isPlayer2Winner = spiel.siegerId !== null && spiel.siegerId === spiel.spieler2Id
  const isCompleted = spiel.status === 'abgeschlossen' || spiel.status === 'walkover'
  const canEnterResult = isAdmin && !isCompleted && spiel.spieler1Id && spiel.spieler2Id && onSelectWinner

  function handleWinner(siegerId: number) {
    if (!onSelectWinner) return
    onSelectWinner(spiel.id, siegerId, ergebnis)
    setErgebnis('')
    setShowForm(false)
  }

  return (
    <div
      className={clsx(
        'border-2 rounded-lg overflow-hidden bg-white transition-colors',
        spiel.status === 'laufend' && 'border-yellow-400 shadow-yellow-100 shadow-md',
        spiel.status === 'abgeschlossen' && 'border-green-300',
        spiel.status === 'walkover' && 'border-blue-200',
        spiel.status === 'ausstehend' && 'border-gray-200',
        compact ? 'min-w-[170px]' : 'min-w-[220px]'
      )}
    >
      {/* Laufend indicator */}
      {spiel.status === 'laufend' && (
        <div className="bg-yellow-400 px-2 py-0.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-bold text-yellow-900">LIVE</span>
        </div>
      )}
      {/* Header */}
      {!compact && (
        <div className="bg-gray-50 px-2 py-1 flex justify-between items-center border-b">
          <span className="text-xs font-medium text-gray-500">{spiel.runde} #{spiel.spielNummer}</span>
          <span className={clsx('text-xs font-medium', statusColor)}>{statusLabel}</span>
        </div>
      )}

      {/* Spieler 1 */}
      <div className={clsx(
        'flex items-center justify-between px-2 py-1.5 border-b gap-1',
        isCompleted && isPlayer1Winner && 'bg-green-50',
        isCompleted && !isPlayer1Winner && spiel.spieler1Id && 'bg-gray-50 text-gray-400',
        !spiel.spieler1Id && 'text-gray-400 italic'
      )}>
        <span className={clsx('truncate font-medium', compact ? 'text-xs' : 'text-sm', isPlayer1Winner && 'text-green-700')}>{player1Name}</span>
        {isPlayer1Winner && <span className="text-green-500 flex-shrink-0 text-sm">✓</span>}
      </div>

      {/* Spieler 2 */}
      <div className={clsx(
        'flex items-center justify-between px-2 py-1.5 gap-1',
        isCompleted && isPlayer2Winner && 'bg-green-50',
        isCompleted && !isPlayer2Winner && spiel.spieler2Id && 'bg-gray-50 text-gray-400',
        !spiel.spieler2Id && 'text-gray-400 italic'
      )}>
        <span className={clsx('truncate font-medium', compact ? 'text-xs' : 'text-sm', isPlayer2Winner && 'text-green-700')}>{player2Name}</span>
        {isPlayer2Winner && <span className="text-green-500 flex-shrink-0 text-sm">✓</span>}
      </div>

      {/* Ergebnis anzeigen */}
      {spiel.ergebnis && (
        <div className="px-2 py-1 bg-gray-50 text-xs text-gray-600 text-center border-t font-mono">
          {spiel.ergebnis}
        </div>
      )}

      {/* Platz / Zeit */}
      {(spiel.platz || spiel.geplanteZeit) && (
        <div className="px-2 py-1 bg-blue-50 text-xs text-blue-600 border-t">
          {spiel.platz && <span>Platz {spiel.platz}</span>}
          {spiel.platz && spiel.geplanteZeit && <span> · </span>}
          {spiel.geplanteZeit && (
            <span>
              {new Date(spiel.geplanteZeit).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
        </div>
      )}

      {/* Admin: Ergebnis eintragen */}
      {canEnterResult && (
        <div className="border-t bg-gray-50">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
            >
              Ergebnis eintragen ✏️
            </button>
          ) : (
            <div className="p-2 space-y-1.5">
              <input
                type="text"
                placeholder="Ergebnis z.B. 6:3, 7:5"
                value={ergebnis}
                onChange={(e) => setErgebnis(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 font-medium">Sieger wählen:</p>
              <div className="flex gap-1">
                <button
                  onClick={() => handleWinner(spiel.spieler1Id!)}
                  className="flex-1 text-xs bg-green-600 text-white rounded px-1 py-1.5 hover:bg-green-700 truncate font-medium"
                  title={spiel.spieler1?.name}
                >
                  {spiel.spieler1?.name ?? 'Spieler 1'}
                </button>
                <button
                  onClick={() => handleWinner(spiel.spieler2Id!)}
                  className="flex-1 text-xs bg-green-600 text-white rounded px-1 py-1.5 hover:bg-green-700 truncate font-medium"
                  title={spiel.spieler2?.name}
                >
                  {spiel.spieler2?.name ?? 'Spieler 2'}
                </button>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-full text-xs text-gray-400 hover:text-gray-600"
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
