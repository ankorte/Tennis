import { useEffect } from 'react'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title, message,
  confirmLabel = 'OK', cancelLabel = 'Abbrechen',
  danger = false,
  onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onConfirm, onCancel])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-slide-in"
        onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-tennis-dark mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl font-bold text-white transition-colors"
            style={{ background: danger ? '#dc2626' : '#1A3B8F' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
