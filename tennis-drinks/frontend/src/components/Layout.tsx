import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useSync } from '../context/SyncContext'
import OfflineBanner from './OfflineBanner'
import UpdatePrompt from './UpdatePrompt'
import { setApiToast } from '../api'
import { useToast } from './Toast'
import api from '../api'

export default function Layout() {
  const { user, logout, isThekenwart, isKassenwart, isAdmin } = useAuth()
  const { totalItems, totalPrice } = useCart()
  const { isOnline, pendingCount } = useSync()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const [pendingRegistrations, setPendingRegistrations] = useState(0)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === '1')

  // PWA Install
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      setInstallPrompt(null)
    } else if (isIos) {
      setShowIosHint(h => !h)
    }
  }

  const showInstallBtn = !isStandalone && (installPrompt || isIos)

  const { showToast } = useToast()
  useEffect(() => { setApiToast(showToast) }, [showToast])

  // Dark Mode anwenden
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', darkMode ? '1' : '0')
  }, [darkMode])

  // Ausstehende Registrierungen laden (Admin/Kassenwart)
  useEffect(() => {
    if (isKassenwart) {
      api.get('/members/pending-count').then(r => setPendingRegistrations(r.data?.count ?? 0)).catch(() => {})
    }
  }, [isKassenwart])

  const handleLogout = () => { logout(); navigate('/login') }

  // Mehr-Menü bei Klick außerhalb schließen
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false)
    }
    if (showMore) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMore])

  // Session-Timeout-Warnung
  const [showExpiry, setShowExpiry] = useState(false)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expiresAt = payload.exp * 1000
      const warnAt = expiresAt - 10 * 60 * 1000
      const msUntilWarn = warnAt - Date.now()
      const msUntilExpiry = expiresAt - Date.now()
      if (msUntilWarn <= 0 && msUntilExpiry > 0) setShowExpiry(true)
      else if (msUntilWarn > 0) {
        const t = setTimeout(() => setShowExpiry(true), msUntilWarn)
        return () => clearTimeout(t)
      } else if (msUntilExpiry <= 0) handleLogout()
    } catch {}
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBanner />
      <UpdatePrompt />

      {/* Header */}
      <header className="sticky top-0 z-50 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
        <div className="h-1 w-full" style={{ background: '#E8002D' }} />
        <div className="px-3 py-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex-shrink-0">
            <img src="/logo.svg" alt="TV Bruvi Logo"
              className="w-11 h-11 rounded-full ring-2 ring-white/30" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-black text-white text-base leading-tight tracking-wide">TV Bruvi</div>
            <div className="text-xs leading-tight flex items-center gap-1" style={{ color: '#FF9DB5' }}>
              Getränke · Sparte Tennis
              <span className="opacity-50 text-[10px]">v{__APP_VERSION__}</span>
              {!isOnline && <span className="inline-block w-2 h-2 rounded-full bg-gray-400 ml-1" title="Offline" />}
              {isOnline && pendingCount > 0 && <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 ml-1" title="Ausstehende Buchungen" />}
            </div>
          </div>

          {/* PWA Install Button */}
          {showInstallBtn && (
            <button onClick={handleInstall}
              className="flex-shrink-0 text-white/70 hover:text-white transition-colors text-lg"
              title="App auf Homebildschirm speichern">
              📲
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(d => !d)}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors text-lg"
            title={darkMode ? 'Hell-Modus' : 'Dunkel-Modus'}>
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Cart Badge */}
          {totalItems > 0 && (
            <button onClick={() => navigate('/cart')}
              className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-colors flex-shrink-0"
              style={{ background: 'rgba(232,0,45,0.25)', border: '1px solid rgba(232,0,45,0.5)' }}>
              <span className="text-base">🛒</span>
              <span className="font-bold text-sm text-white">{totalPrice.toFixed(2)} €</span>
              <span className="absolute -top-1.5 -right-1.5 text-xs font-black rounded-full w-5 h-5 flex items-center justify-center"
                style={{ background: '#E8002D', color: 'white' }}>
                {totalItems}
              </span>
            </button>
          )}

          {/* User */}
          <div className="text-right flex-shrink-0">
            <button onClick={() => navigate('/profile')} className="font-semibold text-white text-xs leading-tight hover:underline">
              {user?.first_name} {user?.last_name}
            </button>
            <button onClick={handleLogout} className="text-xs underline block" style={{ color: '#FF9DB5' }}>
              Abmelden
            </button>
          </div>
        </div>
        <div className="h-0.5 w-full" style={{ background: 'rgba(232,0,45,0.4)' }} />
      </header>

      {/* Session-Timeout-Warnung */}
      {showExpiry && (
        <div className="sticky top-[60px] z-40 bg-yellow-500 text-white text-center text-sm py-2 px-4 font-medium">
          ⏳ Deine Sitzung läuft in Kürze ab.
          <button onClick={handleLogout} className="ml-2 underline font-bold">Neu anmelden</button>
          <button onClick={() => setShowExpiry(false)} className="ml-2 opacity-70">✕</button>
        </div>
      )}

      {/* iOS Install-Hinweis */}
      {showIosHint && (
        <div className="sticky top-[60px] z-40 bg-[#1A3B8F] text-white text-sm py-3 px-4 flex items-center justify-between gap-3">
          <span>Tippe auf <strong>⬆️ Teilen</strong> und dann <strong>„Zum Home-Bildschirm"</strong> um die App zu installieren.</span>
          <button onClick={() => setShowIosHint(false)} className="flex-shrink-0 text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
      )}

      {/* Content */}
      <main className={`flex-1 overflow-auto ${totalItems > 0 ? 'pb-40' : 'pb-24'}`}>
        <Outlet />
      </main>

      {/* Cart reminder banner */}
      {totalItems > 0 && (
        <button onClick={() => navigate('/cart')}
          className="fixed left-0 right-0 z-40 flex items-center justify-between px-4 py-3 shadow-lg no-print"
          style={{ bottom: '64px', background: 'linear-gradient(90deg, #E8002D 0%, #b5001f 100%)', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛒</span>
            <div className="text-left">
              <div className="text-white font-black text-sm leading-tight">{totalItems} ungebuchte{totalItems === 1 ? 's Getränk' : ' Getränke'}</div>
              <div className="text-white/80 text-xs">Tippen zum Abschließen</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white font-black text-lg">{totalPrice.toFixed(2)} €</div>
            <div className="text-white/80 text-xs">Jetzt eintragen →</div>
          </div>
        </button>
      )}

      {/* Mehr-Menü Overlay */}
      {showMore && (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowMore(false)}>
          <div ref={moreRef} onClick={e => e.stopPropagation()}
            className="absolute bottom-[68px] left-2 right-2 rounded-2xl shadow-2xl p-4 max-h-[60vh] overflow-y-auto"
            style={{ background: 'white', borderBottom: '3px solid #E8002D' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-tennis-dark">Mehr</h3>
              <button onClick={() => setShowMore(false)} className="text-gray-400 text-lg">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                isThekenwart && { icon: '📦', label: 'Lager', path: '/inventory' },
                isKassenwart && { icon: '💶', label: 'Abrechnung', path: '/billing' },
                isKassenwart && { icon: '👤', label: 'Mitglieder', path: '/members', badge: pendingRegistrations },
                isThekenwart && { icon: '🍺', label: 'Getränke', path: '/drinks' },
                isKassenwart && { icon: '📋', label: 'Buchungen', path: '/admin/bookings' },
                isThekenwart && { icon: '🛒', label: 'Warenkörbe', path: '/admin/carts' },
                isThekenwart && { icon: '📊', label: 'Statistiken', path: '/admin/stats' },
                isKassenwart && { icon: '📥', label: 'Import', path: '/import' },
                isKassenwart && { icon: '🏦', label: 'SEPA', path: '/sepa' },
                isKassenwart && { icon: '📧', label: 'E-Mail', path: '/email' },
                isAdmin && { icon: '🗄️', label: 'Datenbank', path: '/database' },
                { icon: '⚙️', label: 'Profil', path: '/profile' },
              ].filter(Boolean).map((item: any) => (
                <button key={item.path} onClick={() => { navigate(item.path); setShowMore(false) }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors relative">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="absolute top-1 right-1 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center"
                      style={{ background: '#E8002D', color: 'white' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-1 z-50 shadow-lg no-print"
        style={{ borderTopColor: '#E8002D', borderTopWidth: '2px' }}>
        <NavLink to="/" end className={({ isActive }) =>
          `flex flex-col items-center px-2 py-1.5 rounded-xl transition-colors ${isActive ? 'text-tennis-green' : 'text-gray-400'}`}>
          <span className="text-2xl">🏠</span>
          <span className="text-xs mt-0.5">Start</span>
        </NavLink>
        <NavLink to="/book" className={({ isActive }) =>
          `flex flex-col items-center px-2 py-1.5 rounded-xl transition-colors ${isActive ? 'text-tennis-green' : 'text-gray-400'}`}>
          <span className="text-2xl">🍺</span>
          <span className="text-xs mt-0.5">Eintragen</span>
        </NavLink>
        <NavLink to="/my-bookings" className={({ isActive }) =>
          `flex flex-col items-center px-2 py-1.5 rounded-xl transition-colors ${isActive ? 'text-tennis-green' : 'text-gray-400'}`}>
          <span className="text-2xl">💳</span>
          <span className="text-xs mt-0.5">Karte</span>
        </NavLink>
        {isThekenwart && (
          <button onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center px-2 py-1.5 rounded-xl transition-colors relative ${showMore ? 'text-tennis-green' : 'text-gray-400'}`}>
            <span className="text-2xl">☰</span>
            <span className="text-xs mt-0.5">Mehr</span>
            {pendingRegistrations > 0 && (
              <span className="absolute top-0.5 right-0.5 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center"
                style={{ background: '#E8002D', color: 'white' }}>
                {pendingRegistrations}
              </span>
            )}
          </button>
        )}
      </nav>
    </div>
  )
}
