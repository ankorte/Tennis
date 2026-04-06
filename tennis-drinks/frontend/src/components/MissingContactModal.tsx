import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function MissingContactModal() {
  const { user, updateUser } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Nur anzeigen wenn eingeloggt und weder E-Mail noch Telefon hinterlegt
  const needsContact = user && !user.email && !user.phone
  if (!needsContact || dismissed) return null

  const canSave = email.trim() || phone.trim()

  const handleSave = async () => {
    if (!canSave) { setError('Bitte E-Mail oder Telefonnummer eingeben'); return }
    setSaving(true)
    setError('')
    try {
      await api.put(`/members/${user!.id}`, {
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      updateUser({
        email: email.trim() || user!.email,
        phone: phone.trim() || user!.phone,
      })
      setDismissed(true)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg,#1A3B8F,#0F2566)' }}>
          <div className="text-3xl text-center mb-2">📬</div>
          <h2 className="text-white font-black text-center text-lg">Kontaktdaten hinterlegen</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Hinweis */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
            <p className="text-xs text-amber-800">
              Ohne E-Mail-Adresse oder Telefonnummer kannst du deinen PIN <strong>nicht selbst zurücksetzen</strong> –
              du wärst dann auf den Administrator angewiesen.
            </p>
          </div>

          <p className="text-sm text-gray-600">
            Bitte hinterlege mindestens eine Kontaktmöglichkeit, damit du bei einem vergessenen PIN
            wieder selbst Zugang erhältst.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">E-Mail-Adresse</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              className="input-field"
              placeholder="deine@email.de"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">oder</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Telefonnummer</label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              className="input-field"
              placeholder="0171 12345678"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 text-center">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="btn-primary w-full"
          >
            {saving ? 'Speichern...' : '💾 Kontaktdaten speichern'}
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 pt-1"
          >
            Später – ich verstehe das Risiko
          </button>
        </div>
      </div>
    </div>
  )
}
