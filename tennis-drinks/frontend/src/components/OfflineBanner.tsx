import { useSync } from '../context/SyncContext'

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing, lastSyncResult, syncNow } = useSync()

  if (isOnline && pendingCount === 0 && !lastSyncResult) return null

  // Sync-Ergebnis anzeigen
  if (isOnline && lastSyncResult) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] px-4 py-2 text-center text-sm font-bold text-white"
        style={{ background: lastSyncResult.failed > 0 ? '#b45309' : '#16a34a', marginTop: '57px' }}>
        {lastSyncResult.failed > 0
          ? `⚠️ ${lastSyncResult.synced} synchronisiert, ${lastSyncResult.failed} fehlgeschlagen`
          : `✅ ${lastSyncResult.synced} Buchung${lastSyncResult.synced !== 1 ? 'en' : ''} synchronisiert`}
      </div>
    )
  }

  // Synchronisierung läuft
  if (isOnline && syncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] px-4 py-2 text-center text-sm font-bold text-white"
        style={{ background: '#1A3B8F', marginTop: '57px' }}>
        🔄 Synchronisiere {pendingCount} Buchung{pendingCount !== 1 ? 'en' : ''}…
      </div>
    )
  }

  // Online mit ausstehenden Buchungen
  if (isOnline && pendingCount > 0) {
    return (
      <button onClick={syncNow}
        className="fixed top-0 left-0 right-0 z-[60] px-4 py-2 text-center text-sm font-bold text-white"
        style={{ background: '#1A3B8F', marginTop: '57px' }}>
        📶 {pendingCount} Buchung{pendingCount !== 1 ? 'en' : ''} ausstehend – Tippen zum Synchronisieren
      </button>
    )
  }

  // Offline
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] px-4 py-2 text-center text-sm font-bold text-white"
      style={{ background: '#6b7280', marginTop: '57px' }}>
      📵 Offline
      {pendingCount > 0 && ` · ${pendingCount} Buchung${pendingCount !== 1 ? 'en' : ''} ausstehend`}
    </div>
  )
}
