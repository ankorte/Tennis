import { useEffect, useState, useRef } from 'react'

// Intervall für den Versionscheck (5 Minuten)
const CHECK_INTERVAL_MS = 5 * 60 * 1000

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [serverVersion, setServerVersion] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkVersion = async () => {
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`)
      if (!res.ok) return
      const data = await res.json()
      // Sicherheitscheck: nur wenn die Antwort tatsächlich ein version-Feld hat
      if (data && typeof data.version === 'string' && data.version !== __APP_VERSION__) {
        setServerVersion(data.version)
        setUpdateAvailable(true)
      }
    } catch {
      // Kein Netz oder Endpoint fehlt → ignorieren
    }
  }

  useEffect(() => {
    // Erster Check nach 30 Sekunden (App muss erst fertig laden)
    const initialTimer = setTimeout(checkVersion, 30_000)
    // Danach periodisch prüfen
    intervalRef.current = setInterval(checkVersion, CHECK_INTERVAL_MS)
    return () => {
      clearTimeout(initialTimer)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleUpdate = () => {
    // Service Worker entfernen + Cache leeren + neu laden
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister())
      })
    }
    if ('caches' in window) {
      caches.keys().then(keys => {
        Promise.all(keys.map(key => caches.delete(key))).then(() => location.reload())
      })
    } else {
      location.reload()
    }
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
    // Nach 30 Min. nochmals fragen
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setTimeout(() => checkVersion(), 30 * 60 * 1000)
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="text-5xl mb-3">🔄</div>
        <h2 className="text-xl font-black text-tennis-dark mb-2">Neue Version verfügbar</h2>
        <p className="text-gray-500 text-sm mb-1">
          Aktuelle Version: v{__APP_VERSION__}
        </p>
        <p className="text-gray-500 text-sm mb-5">
          Neue Version: v{serverVersion}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-semibold text-sm hover:bg-gray-50 transition-colors">
            Später
          </button>
          <button
            onClick={handleUpdate}
            className="flex-1 py-3 rounded-xl font-black text-white text-sm transition-colors"
            style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
            Jetzt aktualisieren
          </button>
        </div>
      </div>
    </div>
  )
}
