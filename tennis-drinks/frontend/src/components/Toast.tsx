import { useState, useEffect, createContext, useContext, useCallback } from 'react'

interface ToastItem {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

interface ToastContextValue {
  showToast: (message: string, type?: 'error' | 'success' | 'info') => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'error') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all animate-slide-in
              ${t.type === 'error' ? 'bg-red-600 text-white' :
                t.type === 'success' ? 'bg-green-600 text-white' :
                'bg-blue-600 text-white'}`}
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
            {t.type === 'error' ? '⚠️ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
