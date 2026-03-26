import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    member_number: '', first_name: '', last_name: '',
    email: '', phone: '', pin: '', pin2: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.pin.length < 4) { setError('PIN muss mindestens 4 Stellen haben'); return }
    if (form.pin !== form.pin2) { setError('PINs stimmen nicht überein'); return }
    setLoading(true)
    try {
      await api.post('/auth/register', {
        member_number: form.member_number,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        pin: form.pin,
      })
      setSuccess(true)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Fehler bei der Registrierung')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #1A3B8F 0%, #0F2566 60%, #E8002D 100%)' }}>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Logo Header */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6"
          style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
          <img src="/logo.svg" alt="TV Bruvi" className="w-16 h-16 mb-3 drop-shadow-xl" />
          <h1 className="text-lg font-black text-white tracking-wide">TV Bruvi</h1>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#FF9DB5' }}>
            TV Bruchhausen-Vilsen v. 1863 e.V.
          </p>
          <div className="mt-2 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: '#E8002D' }}>
            🎾 Getränke · Sparte Tennis
          </div>
        </div>

        <div className="h-1" style={{ background: '#E8002D' }} />

        <div className="p-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="font-black text-xl text-tennis-dark">Registrierung eingereicht!</h2>
              <p className="text-sm text-gray-600">
                Dein Account wurde angelegt und wartet auf Freischaltung durch einen Administrator.
                Du erhältst Bescheid sobald du dich einloggen kannst.
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary mt-2">
                Zurück zum Login
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-black text-lg text-tennis-dark mb-1">Registrierung</h2>
              <p className="text-xs text-gray-500 mb-5">
                Bitte alle Felder ausfüllen. Dein Account wird nach Prüfung durch einen Admin freigeschaltet.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mitgliedsnummer *</label>
                  <input value={form.member_number} onChange={set('member_number')}
                    className="input-field" placeholder="z. B. M042" required />
                  <p className="text-xs text-gray-400 mt-1">Steht auf deinem Mitgliedsausweis / Beitrittsdokument</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Vorname *</label>
                    <input value={form.first_name} onChange={set('first_name')}
                      className="input-field" placeholder="Max" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nachname *</label>
                    <input value={form.last_name} onChange={set('last_name')}
                      className="input-field" placeholder="Mustermann" required />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">E-Mail (optional)</label>
                  <input value={form.email} onChange={set('email')}
                    className="input-field" type="email" placeholder="name@example.de" />
                  <p className="text-xs text-gray-400 mt-1">Für Benachrichtigungen und Monatsberichte</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Telefon (optional)</label>
                  <input value={form.phone} onChange={set('phone')}
                    className="input-field" type="tel" placeholder="0171 12345678" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">PIN wählen * (mind. 4 Stellen)</label>
                  <input value={form.pin} onChange={set('pin')}
                    className="input-field text-xl tracking-widest text-center"
                    type="password" placeholder="••••" maxLength={6} required />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">PIN wiederholen *</label>
                  <input value={form.pin2} onChange={set('pin2')}
                    className={`input-field text-xl tracking-widest text-center ${form.pin2 && form.pin !== form.pin2 ? 'border-red-400 bg-red-50' : ''}`}
                    type="password" placeholder="••••" maxLength={6} required />
                  {form.pin2 && form.pin !== form.pin2 && (
                    <p className="text-xs text-red-500 mt-1">PINs stimmen nicht überein</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm text-center">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary mt-2" disabled={loading}>
                  {loading ? 'Registrierung...' : 'Registrieren'}
                </button>
              </form>

              <button onClick={() => navigate('/login')}
                className="w-full text-center text-sm text-gray-400 mt-4 hover:text-gray-600">
                ← Zurück zum Login
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-white/40 text-xs mt-6">© TV Bruchhausen-Vilsen v. 1863 e.V.</p>
    </div>
  )
}
