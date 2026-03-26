'use client'

import { useState } from 'react'
import { useTheme, THEMES, type Theme } from '@/components/ThemeProvider'
import clsx from 'clsx'

// ── Per-theme colour definitions for the preview cards ───────────────────────
const THEME_COLORS: Record<Theme, {
  nav: string
  navDark: string
  btn: string
  btnDark: string
  light: string
  light2: string
  text: string
  textNav: string
  accent: string
}> = {
  gruen: {
    nav: '#166534', navDark: '#14532d',
    btn: '#15803d', btnDark: '#166534',
    light: '#f0fdf4', light2: '#dcfce7',
    text: '#166534', textNav: '#bbf7d0', accent: '#86efac',
  },
  blau: {
    nav: '#1e3a8a', navDark: '#1e3170',
    btn: '#1d4ed8', btnDark: '#1e40af',
    light: '#eff6ff', light2: '#dbeafe',
    text: '#1e40af', textNav: '#bfdbfe', accent: '#93c5fd',
  },
  lila: {
    nav: '#5b21b6', navDark: '#4c1d95',
    btn: '#7c3aed', btnDark: '#6d28d9',
    light: '#faf5ff', light2: '#ede9fe',
    text: '#6d28d9', textNav: '#ddd6fe', accent: '#c4b5fd',
  },
  orange: {
    nav: '#c2410c', navDark: '#9a3412',
    btn: '#ea580c', btnDark: '#c2410c',
    light: '#fff7ed', light2: '#ffedd5',
    text: '#c2410c', textNav: '#fed7aa', accent: '#fdba74',
  },
  dunkel: {
    nav: '#1e293b', navDark: '#0f172a',
    btn: '#475569', btnDark: '#334155',
    light: '#f1f5f9', light2: '#e2e8f0',
    text: '#334155', textNav: '#cbd5e1', accent: '#94a3b8',
  },
}

// ── Mini mock-up inside each theme card ──────────────────────────────────────
function ThemePreview({ t, colors }: { t: typeof THEMES[0]; colors: typeof THEME_COLORS['gruen'] }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm select-none pointer-events-none" style={{ fontSize: 0 }}>
      {/* Nav bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-2"
        style={{ backgroundColor: colors.nav }}
      >
        <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>🎾 Tennis</span>
        <div className="flex-1" />
        <div className="w-8 h-1.5 rounded-full opacity-60" style={{ backgroundColor: colors.textNav }} />
        <div className="w-6 h-1.5 rounded-full opacity-60" style={{ backgroundColor: colors.textNav }} />
      </div>

      {/* Hero banner */}
      <div
        className="px-3 py-3"
        style={{ background: `linear-gradient(135deg, ${colors.btn}, ${colors.navDark})` }}
      >
        <div className="w-24 h-2 rounded mb-1.5 opacity-90" style={{ backgroundColor: '#fff' }} />
        <div className="w-16 h-1.5 rounded opacity-60" style={{ backgroundColor: colors.textNav }} />
        <div
          className="mt-2.5 inline-block rounded px-2 py-1"
          style={{ backgroundColor: '#fff', fontSize: 8, color: colors.text, fontWeight: 600 }}
        >
          Anmelden
        </div>
      </div>

      {/* Card area */}
      <div className="p-2.5 space-y-1.5" style={{ backgroundColor: '#f9fafb' }}>
        {/* Match card mock */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.btn }} />
            <div className="flex-1 h-1.5 rounded bg-gray-200" />
          </div>
          <div className="border-t border-gray-100 flex items-center gap-1 px-2 py-1">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <div className="flex-1 h-1.5 rounded bg-gray-100" />
          </div>
        </div>

        {/* Button row */}
        <div className="flex gap-1.5 pt-0.5">
          <div
            className="rounded px-2 py-1 flex-1"
            style={{ backgroundColor: colors.btn, height: 14 }}
          />
          <div className="rounded px-2 py-1 bg-gray-200" style={{ width: 24, height: 14 }} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5" style={{ backgroundColor: colors.nav }}>
        <div className="w-20 h-1 rounded opacity-40" style={{ backgroundColor: colors.textNav }} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EinstellungenPage() {
  const { theme, setTheme } = useTheme()
  const [preview, setPreview] = useState<Theme | null>(null)
  const [saved, setSaved] = useState(false)

  const activeTheme = preview ?? theme
  const colors = THEME_COLORS[activeTheme]

  function handleApply(t: Theme) {
    setTheme(t)
    setPreview(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="text-3xl">🎨</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Design Einstellungen</h1>
          <p className="text-gray-500 text-sm">Passen Sie das Erscheinungsbild der Anwendung an</p>
        </div>
        {saved && (
          <span className="ml-auto text-green-600 text-sm font-medium flex items-center gap-1 animate-pulse">
            ✅ Gespeichert
          </span>
        )}
      </div>

      {/* Theme selector */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">Farbthema</h2>
        <p className="text-gray-400 text-sm mb-5">
          Fahren Sie mit der Maus über ein Theme um es in der Vorschau zu sehen. Klicken Sie um es zu aktivieren.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {THEMES.map((t) => {
            const c       = THEME_COLORS[t.value]
            const isActive = theme === t.value
            const isPrev   = preview === t.value

            return (
              <button
                key={t.value}
                onClick={() => handleApply(t.value)}
                onMouseEnter={() => setPreview(t.value)}
                onMouseLeave={() => setPreview(null)}
                className={clsx(
                  'group relative flex flex-col items-center rounded-xl border-2 p-3 transition-all duration-200 cursor-pointer text-left',
                  isActive
                    ? 'border-gray-800 shadow-md scale-105'
                    : isPrev
                    ? 'border-gray-400 shadow scale-102'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow'
                )}
              >
                {/* Active badge */}
                {isActive && (
                  <span className="absolute -top-2 -right-2 bg-gray-800 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow">
                    ✓
                  </span>
                )}

                {/* Mini preview */}
                <div className="w-full mb-3">
                  <ThemePreview t={t} colors={c} />
                </div>

                {/* Colour dot + label */}
                <div className="flex items-center gap-1.5 w-full">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                    style={{ backgroundColor: c.btn }}
                  />
                  <span className="text-xs font-medium text-gray-700 truncate">{t.label}</span>
                </div>
                <span className="text-lg mt-1">{t.emoji}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Live preview panel */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-700">Live-Vorschau</h2>
          <span className="text-sm text-gray-400">
            — {THEMES.find((t) => t.value === activeTheme)?.emoji}{' '}
            {THEMES.find((t) => t.value === activeTheme)?.label}
          </span>
          {preview && (
            <span className="ml-auto text-xs text-gray-400 italic">Vorschau (noch nicht gespeichert)</span>
          )}
        </div>

        {/* Mock navigation */}
        <div
          className="flex items-center gap-4 px-6 py-3 transition-colors duration-300"
          style={{ backgroundColor: colors.nav }}
        >
          <span className="text-white font-bold text-sm">🎾 Tennis Turnier</span>
          <span className="text-sm transition-colors" style={{ color: colors.textNav }}>Home</span>
          <span className="text-sm transition-colors" style={{ color: colors.textNav }}>Turniere</span>
          <span className="ml-auto bg-yellow-500 text-black text-xs px-2 py-0.5 rounded font-medium">Admin</span>
        </div>

        {/* Mock hero */}
        <div
          className="px-6 py-6 transition-all duration-300"
          style={{ background: `linear-gradient(135deg, ${colors.btn}, ${colors.navDark})` }}
        >
          <p className="text-white font-bold text-lg mb-1">Sommer-Turnier 2025</p>
          <p className="text-sm mb-3 transition-colors" style={{ color: colors.textNav }}>
            Double Elimination · 12 Spieler · Aktiv
          </p>
          <div className="flex gap-2 flex-wrap">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-lg">Spieler: 12 / 16</span>
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-lg">Spiele: 8 / 23</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              style={{ backgroundColor: '#25D366', color: '#fff' }}
            >
              📱 WhatsApp
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-white/20 text-white"
            >
              🔗 Link kopieren
            </button>
          </div>
        </div>

        {/* Mock content area */}
        <div className="p-6 space-y-4">
          {/* Bracket tab bar */}
          <div className="flex gap-1 border-b border-gray-200 pb-0">
            <button
              className="px-4 py-2 text-sm font-medium rounded-t-lg text-white"
              style={{ backgroundColor: colors.btn }}
            >
              Siegerseite (WB)
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-t-lg text-gray-500 hover:bg-gray-100">
              Verliererseite (LB)
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-t-lg text-gray-500 hover:bg-gray-100">
              Grand Final
            </button>
          </div>

          {/* Sample match cards */}
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { p1: 'Müller, T.', p2: 'Schmidt, K.', score: '6:3, 7:5', done: true },
              { p1: 'Wagner, P.', p2: 'Fischer, A.', score: '', done: false },
            ].map((m, i) => (
              <div key={i} className="border rounded-lg overflow-hidden shadow-sm">
                <div
                  className={clsx(
                    'flex items-center justify-between px-3 py-2 text-sm border-b',
                    m.done ? 'font-semibold' : ''
                  )}
                  style={m.done ? { backgroundColor: colors.light2, color: colors.text } : {}}
                >
                  <span>{m.p1}</span>
                  {m.done && <span className="text-xs font-bold">🏆</span>}
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-sm text-gray-500 bg-gray-50">
                  <span>{m.p2}</span>
                  {m.done && <span className="text-xs font-mono text-gray-400">{m.score}</span>}
                </div>
                {m.done && (
                  <div
                    className="px-3 py-1 text-xs font-medium"
                    style={{ backgroundColor: colors.light2, color: colors.text }}
                  >
                    ✓ Abgeschlossen
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sample buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: colors.btn }}
            >
              Turnier starten
            </button>
            <button
              className="text-white text-sm px-4 py-2 rounded-lg font-medium"
              style={{ backgroundColor: colors.btn, opacity: 0.7 }}
            >
              🎲 Auslosung
            </button>
            <button className="bg-gray-100 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium">
              Abbrechen
            </button>
          </div>
        </div>

        {/* Mock footer */}
        <div
          className="px-6 py-3 text-center transition-colors duration-300"
          style={{ backgroundColor: colors.nav }}
        >
          <p className="text-xs transition-colors" style={{ color: colors.textNav }}>
            🎾 Tennis Turnier Manager — Double Elimination Brackets
          </p>
        </div>
      </div>

      {/* Apply note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex gap-3">
        <span className="text-lg flex-shrink-0">💡</span>
        <div>
          <p className="font-medium mb-0.5">Automatisch gespeichert</p>
          <p className="text-blue-600">
            Das gewählte Theme wird in Ihrem Browser gespeichert und bleibt auch nach einem Neuladen aktiv.
            Jeder Nutzer kann sein eigenes Theme unabhängig wählen.
          </p>
        </div>
      </div>
    </div>
  )
}
