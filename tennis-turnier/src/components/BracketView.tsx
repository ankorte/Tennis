'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Spiel } from '@/types'
import MatchCard from './MatchCard'

interface BracketViewProps {
  spiele: Spiel[]
  isAdmin?: boolean
  onSelectWinner?: (spielId: number, siegerId: number, ergebnis: string) => void
  onMarkLaufend?: (spielId: number) => void
}

const ROUND_ORDER = ['WB-R1', 'WB-R2', 'WB-SF', 'WB-F']
const LB_ROUND_ORDER = ['LB-R1', 'LB-R2', 'LB-R3', 'LB-R4', 'LB-SF', 'LB-F']

const ROUND_LABELS: Record<string, string> = {
  'WB-R1': 'Runde 1',
  'WB-R2': 'Runde 2',
  'WB-SF': 'Halbfinale',
  'WB-F': 'Finale',
  'LB-R1': 'LB Runde 1',
  'LB-R2': 'LB Runde 2',
  'LB-R3': 'LB Runde 3',
  'LB-R4': 'LB Runde 4',
  'LB-SF': 'LB Halbfinale',
  'LB-F': 'LB Finale',
  'GF': 'Grand Final',
}

// ── Layout constants for LB tree ─────────────────────────────────────────────
const CARD_H = 92     // fixed height per match card (px)
const SLOT   = CARD_H + 16  // vertical slot per card = card + gap
const CARD_W = 200    // card width (px)
const COL_GAP = 60    // horizontal gap between columns (room for connector lines)
const LABEL_H = 28    // height reserved for the round label above each column

/**
 * Compute the vertical centre position (in px, relative to top of content area)
 * of every match card for each LB round.
 *
 * Rules:
 *  - First round  → cards are stacked linearly.
 *  - 1 : 1 round  → same y-positions as the previous round (one feeder each).
 *  - 2 : 1 round  → y-position = average of the two feeder positions.
 */
function computeLBPositions(
  lbRounds: string[],
  byRunde: Record<string, Spiel[]>,
): Record<string, number[]> {
  const result: Record<string, number[]> = {}

  for (let i = 0; i < lbRounds.length; i++) {
    const runde = lbRounds[i]
    const count = (byRunde[runde] ?? []).length
    if (count === 0) { result[runde] = []; continue }

    if (i === 0) {
      // First round: linear stack
      result[runde] = Array.from({ length: count }, (_, j) => j * SLOT + CARD_H / 2)
    } else {
      const prev     = lbRounds[i - 1]
      const prevPos  = result[prev] ?? []
      const prevCount = prevPos.length

      if (count === prevCount) {
        // 1 : 1  – same positions
        result[runde] = [...prevPos]
      } else {
        // 2 : 1  – average adjacent pairs
        const newPos: number[] = []
        for (let j = 0; j < count; j++) {
          const p1 = prevPos[j * 2]       ?? prevPos[prevPos.length - 1]
          const p2 = prevPos[j * 2 + 1]   ?? prevPos[prevPos.length - 1]
          newPos.push((p1 + p2) / 2)
        }
        result[runde] = newPos
      }
    }
  }

  return result
}

// ── WB: simple column layout (unchanged) ────────────────────────────────────
function RoundColumn({
  runde, spiele, isAdmin, onSelectWinner, onMarkLaufend, spacing,
}: {
  runde: string
  spiele: Spiel[]
  isAdmin?: boolean
  onSelectWinner?: (spielId: number, siegerId: number, ergebnis: string) => void
  onMarkLaufend?: (spielId: number) => void
  spacing?: string
}) {
  return (
    <div className="flex flex-col" style={{ gap: spacing ?? '16px' }}>
      <div className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 min-w-[190px]">
        {ROUND_LABELS[runde] ?? runde}
      </div>
      {spiele.map((spiel) => (
        <MatchCard
          key={spiel.id}
          spiel={spiel}
          isAdmin={isAdmin}
          onSelectWinner={onSelectWinner}
          onMarkLaufend={onMarkLaufend}
          compact
        />
      ))}
    </div>
  )
}

// ── LB: tree layout with SVG connector lines ─────────────────────────────────
function LBBracket({
  lbRounds, byRunde, isAdmin, onSelectWinner, onMarkLaufend,
}: {
  lbRounds: string[]
  byRunde: Record<string, Spiel[]>
  isAdmin?: boolean
  onSelectWinner?: (spielId: number, siegerId: number, ergebnis: string) => void
  onMarkLaufend?: (spielId: number) => void
}) {
  const positions = computeLBPositions(lbRounds, byRunde)

  const allYs   = Object.values(positions).flat()
  const maxY    = allYs.length > 0 ? Math.max(...allYs) : CARD_H / 2
  const totalH  = maxY + CARD_H / 2 + LABEL_H + 8
  const totalW  = lbRounds.length * (CARD_W + COL_GAP) - COL_GAP

  return (
    <div style={{ position: 'relative', height: totalH, width: totalW, minWidth: totalW }}>

      {/* ── SVG connector lines ──────────────────────────────────────────── */}
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          width: totalW, height: totalH,
          overflow: 'visible', pointerEvents: 'none',
        }}
      >
        {lbRounds.map((runde, i) => {
          if (i === 0) return null
          const prev      = lbRounds[i - 1]
          const curPos    = positions[runde]  ?? []
          const prevPos   = positions[prev]   ?? []
          const curCount  = curPos.length
          const prevCount = prevPos.length

          const x0    = (i - 1) * (CARD_W + COL_GAP) + CARD_W   // right edge of previous col
          const x1    = i       * (CARD_W + COL_GAP)              // left  edge of current  col
          const xMid  = x0 + COL_GAP / 2                          // mid-point for elbows

          const segs: ReactNode[] = []

          if (curCount === prevCount) {
            // ── 1 : 1  → simple horizontal (or gentle elbow) ────────────
            prevPos.forEach((py, j) => {
              const cy  = curPos[j] ?? py
              const sy  = py + LABEL_H
              const scy = cy + LABEL_H
              segs.push(
                <path
                  key={j}
                  d={
                    Math.abs(sy - scy) < 1
                      ? `M ${x0} ${sy} H ${x1}`
                      : `M ${x0} ${sy} H ${xMid} V ${scy} H ${x1}`
                  }
                  stroke="#D1D5DB" strokeWidth="1.5" fill="none"
                />
              )
            })
          } else {
            // ── 2 : 1  → elbow lines that meet at the output card ────────
            curPos.forEach((midY, j) => {
              const y1  = prevPos[j * 2]
              const y2  = prevPos[j * 2 + 1]
              if (y1 === undefined || y2 === undefined) return
              const sy1  = y1  + LABEL_H
              const sy2  = y2  + LABEL_H
              const smid = midY + LABEL_H

              segs.push(
                // top feeder → junction
                <path key={`${j}a`}
                  d={`M ${x0} ${sy1} H ${xMid} V ${smid}`}
                  stroke="#D1D5DB" strokeWidth="1.5" fill="none"
                />,
                // bottom feeder → junction
                <path key={`${j}b`}
                  d={`M ${x0} ${sy2} H ${xMid} V ${smid}`}
                  stroke="#D1D5DB" strokeWidth="1.5" fill="none"
                />,
                // junction → output
                <line key={`${j}c`}
                  x1={xMid} y1={smid} x2={x1} y2={smid}
                  stroke="#D1D5DB" strokeWidth="1.5"
                />,
              )
            })
          }

          return <g key={runde}>{segs}</g>
        })}
      </svg>

      {/* ── Columns with absolutely-positioned match cards ───────────────── */}
      {lbRounds.map((runde, i) => {
        const matches = byRunde[runde] ?? []
        const pos     = positions[runde] ?? []
        const colLeft = i * (CARD_W + COL_GAP)

        return (
          <div key={runde} style={{ position: 'absolute', left: colLeft, top: 0, width: CARD_W }}>

            {/* Round label */}
            <div style={{
              height: LABEL_H,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#6B7280',
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {ROUND_LABELS[runde] ?? runde}
            </div>

            {/* Match cards */}
            {matches.map((spiel, j) => (
              <div
                key={spiel.id}
                style={{
                  position: 'absolute',
                  top: (pos[j] ?? 0) - CARD_H / 2 + LABEL_H,
                  width: CARD_W,
                }}
              >
                <MatchCard
                  spiel={spiel}
                  isAdmin={isAdmin}
                  onSelectWinner={onSelectWinner}
                  onMarkLaufend={onMarkLaufend}
                  compact
                />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BracketView({ spiele, isAdmin, onSelectWinner, onMarkLaufend }: BracketViewProps) {
  const [activeTab, setActiveTab] = useState<'wb' | 'lb' | 'gf'>('wb')

  const byRunde = spiele.reduce((acc, spiel) => {
    if (!acc[spiel.runde]) acc[spiel.runde] = []
    acc[spiel.runde].push(spiel)
    return acc
  }, {} as Record<string, Spiel[]>)

  // Sort each round's matches by spielNummer
  Object.keys(byRunde).forEach((k) => {
    byRunde[k].sort((a, b) => a.spielNummer - b.spielNummer)
  })

  const wbRounds  = ROUND_ORDER.filter((r) => byRunde[r]?.length > 0)
  const lbRounds  = LB_ROUND_ORDER.filter((r) => byRunde[r]?.length > 0)
  const gfMatches = byRunde['GF'] ?? []

  const tabs = [
    { key: 'wb' as const, label: 'Siegerseite (WB)', available: wbRounds.length > 0 },
    { key: 'lb' as const, label: 'Verliererseite (LB)', available: lbRounds.length > 0 },
    { key: 'gf' as const, label: 'Grand Final', available: gfMatches.length > 0 },
  ]

  if (spiele.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-3">🎾</div>
        <p className="text-lg font-medium">Kein Bracket vorhanden</p>
        <p className="text-sm mt-1">Das Turnier wurde noch nicht gestartet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            disabled={!tab.available}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? 'bg-green-700 text-white'
                : tab.available
                ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* WB Tab – column layout with bracket spacing */}
      {activeTab === 'wb' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-8 min-w-max">
            {wbRounds.map((runde, idx) => {
              const spacings = ['16px', '80px', '208px', '464px']
              return (
                <RoundColumn
                  key={runde}
                  runde={runde}
                  spiele={byRunde[runde]}
                  isAdmin={isAdmin}
                  onSelectWinner={onSelectWinner}
                  onMarkLaufend={onMarkLaufend}
                  spacing={spacings[idx] ?? '16px'}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* LB Tab – tree layout with SVG connector lines */}
      {activeTab === 'lb' && (
        <div className="overflow-x-auto pb-6">
          <LBBracket
            lbRounds={lbRounds}
            byRunde={byRunde}
            isAdmin={isAdmin}
            onSelectWinner={onSelectWinner}
            onMarkLaufend={onMarkLaufend}
          />
        </div>
      )}

      {/* GF Tab */}
      {activeTab === 'gf' && (
        <div className="flex flex-col items-center gap-8">
          <h3 className="text-xl font-bold text-gray-700">Grand Final</h3>
          {gfMatches.map((spiel) => (
            <div key={spiel.id} className="w-full max-w-sm">
              <MatchCard
                spiel={spiel}
                isAdmin={isAdmin}
                onSelectWinner={onSelectWinner}
                onMarkLaufend={onMarkLaufend}
              />
              {spiel.status === 'abgeschlossen' && spiel.sieger && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <div className="text-3xl mb-1">🏆</div>
                  <p className="font-bold text-lg text-yellow-800">Turniersieger</p>
                  <p className="text-yellow-700 text-xl font-bold mt-1">{spiel.sieger.name}</p>
                </div>
              )}
            </div>
          ))}

          <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg max-w-md text-center">
            <p className="font-medium mb-1">Grand Final Erklärung</p>
            <p>Links: Sieger der Siegerseite (WB)</p>
            <p>Rechts: Sieger der Verliererseite (LB)</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-green-400 bg-green-50" />
          <span>Abgeschlossen</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-yellow-400 bg-yellow-50" />
          <span>Laufend</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-gray-200 bg-white" />
          <span>Ausstehend</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-blue-300 bg-blue-50" />
          <span>Walkover</span>
        </div>
      </div>
    </div>
  )
}
