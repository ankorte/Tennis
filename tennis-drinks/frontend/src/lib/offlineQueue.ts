const DB_NAME = 'bruvi-offline-v1'
const DB_VERSION = 1
const QUEUE_STORE = 'booking-queue'

export interface QueuedBooking {
  id?: number
  timestamp: number
  items: Array<{ drink_id: number; quantity: number; price: number; name: string }>
  booking_type: 'einzeln' | 'gruppe'
  member_id: number | null
  group_id: number | null
  total_price: number
  group_name?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueueBooking(booking: QueuedBooking): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    tx.objectStore(QUEUE_STORE).add({ ...booking, timestamp: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllQueued(): Promise<QueuedBooking[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const req = tx.objectStore(QUEUE_STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function removeQueued(id: number): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    tx.objectStore(QUEUE_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueuedCount(): Promise<number> {
  const items = await getAllQueued()
  return items.length
}
