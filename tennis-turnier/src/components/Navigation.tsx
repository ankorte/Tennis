'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { useTheme, THEMES } from './ThemeProvider'

export default function Navigation() {
  const { user, logout, isAdmin, isLoading } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/')
    setMobileOpen(false)
  }

  const currentTheme = THEMES.find((t) => t.value === theme) ?? THEMES[0]

  return (
    <nav className="th-nav text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">🎾</span>
            <span>Tennis Turnier</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="th-text-nav hover:text-white transition-colors font-medium">
              Home
            </Link>
            <Link href="/turniere" className="th-text-nav hover:text-white transition-colors font-medium">
              Turniere
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="bg-yellow-500 text-black px-3 py-1 rounded-md font-medium hover:bg-yellow-400 transition-colors"
              >
                Admin
              </Link>
            )}

            <Link href="/einstellungen" className="th-text-nav hover:text-white transition-colors" title="Design Einstellungen">
              🎨
            </Link>

            {/* Theme picker */}
            <div className="relative">
              <button
                onClick={() => setThemeOpen(!themeOpen)}
                className="flex items-center gap-1.5 th-text-nav hover:text-white transition-colors text-sm px-2 py-1 rounded-md hover:bg-white/10"
                title="Design ändern"
              >
                <span>{currentTheme.emoji}</span>
                <span className="hidden lg:inline">{currentTheme.label}</span>
                <span className="text-xs opacity-70">▾</span>
              </button>

              {themeOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setThemeOpen(false)}
                  />
                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl z-50 border overflow-hidden">
                    <div className="px-3 py-2 border-b bg-gray-50">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Design</p>
                    </div>
                    {THEMES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => { setTheme(t.value); setThemeOpen(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                          theme === t.value ? 'bg-gray-100 font-semibold' : ''
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                          style={{ backgroundColor: t.preview }}
                        />
                        <span className="text-gray-700">{t.emoji} {t.label}</span>
                        {theme === t.value && <span className="ml-auto text-gray-400">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {!isLoading && (
              <>
                {user ? (
                  <div className="flex items-center gap-3">
                    <span className="th-text-nav text-sm">👤 {user.name}</span>
                    <button
                      onClick={handleLogout}
                      className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                    >
                      Abmelden
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link href="/login" className="th-text-nav hover:text-white transition-colors font-medium">
                      Anmelden
                    </Link>
                    <Link
                      href="/registrieren"
                      className="bg-white px-3 py-1 rounded-md font-medium hover:bg-gray-100 transition-colors th-text-on"
                    >
                      Registrieren
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile: theme + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => { setThemeOpen(!themeOpen); setMobileOpen(false) }}
              className="p-2 rounded-md hover:bg-white/10 transition-colors text-lg"
              title="Design"
            >
              {currentTheme.emoji}
            </button>
            <button
              onClick={() => { setMobileOpen(!mobileOpen); setThemeOpen(false) }}
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Menü öffnen"
            >
              <div className={`w-6 h-0.5 bg-white mb-1.5 transition-transform ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <div className={`w-6 h-0.5 bg-white mb-1.5 transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
              <div className={`w-6 h-0.5 bg-white transition-transform ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile: theme picker */}
        {themeOpen && (
          <div className="md:hidden pb-3 border-t border-white/20 mt-2 pt-3">
            <p className="text-xs font-semibold th-text-nav uppercase tracking-wider mb-2">Design wählen</p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setTheme(t.value); setThemeOpen(false) }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${
                    theme === t.value ? 'bg-white/20 font-bold' : 'hover:bg-white/10'
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded-full border-2 border-white/50"
                    style={{ backgroundColor: t.preview }}
                  />
                  <span className="th-text-nav">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-white/20 mt-2 pt-3 flex flex-col gap-3">
            <Link href="/" onClick={() => setMobileOpen(false)} className="block th-text-nav hover:text-white transition-colors font-medium">
              Home
            </Link>
            <Link href="/turniere" onClick={() => setMobileOpen(false)} className="block th-text-nav hover:text-white transition-colors font-medium">
              Turniere
            </Link>
            <Link href="/einstellungen" onClick={() => setMobileOpen(false)} className="block th-text-nav hover:text-white transition-colors font-medium">
              🎨 Design
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="inline-block bg-yellow-500 text-black px-3 py-1 rounded-md font-medium hover:bg-yellow-400 transition-colors w-fit"
              >
                Admin
              </Link>
            )}
            {!isLoading && (
              <>
                {user ? (
                  <div className="flex flex-col gap-2">
                    <span className="th-text-nav text-sm">👤 {user.name}</span>
                    <button
                      onClick={handleLogout}
                      className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded-md text-sm font-medium transition-colors w-fit"
                    >
                      Abmelden
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="th-text-nav hover:text-white transition-colors font-medium">
                      Anmelden
                    </Link>
                    <Link
                      href="/registrieren"
                      onClick={() => setMobileOpen(false)}
                      className="inline-block bg-white px-3 py-1 rounded-md font-medium hover:bg-gray-100 transition-colors w-fit th-text-on"
                    >
                      Registrieren
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
