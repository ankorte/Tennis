import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getAllQueued, removeQueued, getQueuedCount } from '../lib/offlineQueue'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import api from '../api'

interface SyncContextValue {
  isOnline: boolean
  pendingCount: number
  syncing: boolean
  lastSyncResult: { synced: number; failed: number } | null
  syncNow: () => Promise<void>
  refreshPendingCount: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue>({
  isOnline: true,
  pendingCount: 0,
  syncing: false,
  lastSyncResult: null,
  syncNow: async () => {},
  refreshPendingCount: async () => {},
})

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null)

  // Refs statt State in Callbacks – vermeidet unnötige Neuerstallungen
  const syncingRef = useRef(false)
  const isOnlineRef = useRef(isOnline)
  const wasOfflineRef = useRef(false)

  // isOnlineRef immer aktuell halten
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getQueuedCount()
      setPendingCount(count)
    } catch {}
  }, [])

  // syncNow ist stabil (keine sich ändernden Dependencies)
  const syncNow = useCallback(async () => {
    if (!isOnlineRef.current || syncingRef.current) return

    const queued = await getAllQueued()
    if (queued.length === 0) return

    syncingRef.current = true
    setSyncing(true)

    let synced = 0
    let failed = 0

    for (const booking of queued) {
      try {
        for (const item of booking.items) {
          await api.post('/bookings', {
            drink_id: item.drink_id,
            member_id: booking.member_id,
            group_id: booking.group_id,
            quantity: item.quantity,
            booking_type: booking.booking_type,
          })
        }
        await removeQueued(booking.id!)
        synced++
      } catch {
        failed++
      }
    }

    syncingRef.current = false
    setSyncing(false)
    setLastSyncResult({ synced, failed })

    try {
      const count = await getQueuedCount()
      setPendingCount(count)
    } catch {}

    // Result-Banner nach 5s ausblenden
    setTimeout(() => setLastSyncResult(null), 5000)
  }, []) // Keine Dependencies – nutzt Refs für isOnline und syncing

  // Beim Start: ausstehende Buchungen laden
  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  // Wenn wieder online: automatisch synchronisieren
  // Nur isOnline als Dependency – syncNow ist stabil
  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      syncNow()
    }
    wasOfflineRef.current = !isOnline
  }, [isOnline, syncNow])

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, syncing, lastSyncResult, syncNow, refreshPendingCount }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  return useContext(SyncContext)
}
