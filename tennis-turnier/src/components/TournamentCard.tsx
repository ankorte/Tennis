'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { Turnier } from '@/types'

interface TournamentCardProps {
  turnier: Turnier
  isRegistered?: boolean
  onRegister?: () => void
  onUnregister?: () => void
  isLoggedIn?: boolean
  isLoading?: boolean
}

export default function TournamentCard({
  turnier, isRegistered, onRegister, onUnregister, isLoggedIn, isLoading,
}: TournamentCardProps) {
  const spielerAnzahl = turnier._count?.anmeldungen ?? turnier.anmeldungen?.length ?? 0
  const isFull = spielerAnzahl >= turnier.maxSpieler

  const completedSpiele = turnier.spiele?.filter(
    (s) => s.status === 'abgeschlossen' || s.status === 'walkover'
  ).length ?? 0
  const totalSpiele = turnier.spiele?.length ?? 0
  const matchProgress = totalSpiele > 0 ? Math.round((completedSpiele / totalSpiele) * 100) : 0

  const statusConfig = {
    anmeldung: { label: 'Anmeldung offen', dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-800' },
    aktiv:     { label: 'Läuft gerade',    dot: 'bg-green-400 animate-pulse', badge: 'bg-green-100 text-green-800' },
    abgeschlossen: { label: 'Abgeschlossen', dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-600' },
  }[turnier.status]

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-100 flex flex-col">
      {/* Header */}
      <div className="th-gradient p-4 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_white,_transparent)]" />
        <div className="relative flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-lg leading-tight">{turnier.name}</h3>
            {turnier.beschreibung && (
              <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{turnier.beschreibung}</p>
            )}
          </div>
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 flex items-center gap-1', statusConfig.badge)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Player progress */}
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1.5">
            <span className="font-medium">Spieler</span>
            <span className={clsx('font-bold', isFull ? 'text-red-500' : 'text-gray-700')}>
              {spielerAnzahl} / {turnier.maxSpieler}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={clsx('h-2 rounded-full transition-all duration-500', isFull ? 'bg-red-400' : 'th-btn')}
              style={{ width: `${Math.min(100, (spielerAnzahl / turnier.maxSpieler) * 100)}%` }}
            />
          </div>
        </div>

        {/* Match progress (only for active tournaments) */}
        {turnier.status === 'aktiv' && totalSpiele > 0 && (
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1.5">
              <span className="font-medium">Spielfortschritt</span>
              <span className="font-bold text-gray-700">{completedSpiele} / {totalSpiele} Spiele</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500 bg-yellow-400"
                style={{ width: `${matchProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{matchProgress}% abgeschlossen</p>
          </div>
        )}

        {/* Registered badge */}
        {isRegistered && (
          <div className="flex items-center gap-1.5 text-green-700 text-xs bg-green-50 rounded-lg px-2 py-1.5 border border-green-200">
            <span>✓</span>
            <span className="font-medium">Sie sind angemeldet</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1">
          <Link
            href={`/turniere/${turnier.id}`}
            className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {turnier.status === 'aktiv' ? '📊 Bracket ansehen' : '→ Details'}
          </Link>

          {turnier.status === 'anmeldung' && isLoggedIn && (
            isRegistered ? (
              <button
                onClick={onUnregister}
                disabled={isLoading}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : 'Abmelden'}
              </button>
            ) : (
              <button
                onClick={onRegister}
                disabled={isLoading || isFull}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isFull
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'th-btn disabled:opacity-50'
                )}
              >
                {isLoading ? '...' : isFull ? 'Ausgebucht' : 'Anmelden'}
              </button>
            )
          )}

          {turnier.status === 'anmeldung' && !isLoggedIn && (
            <Link
              href="/login"
              className="flex-1 text-center th-btn px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Zum Anmelden
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
