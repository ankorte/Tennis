import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function LoginPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  // PIN-Reset state
  const [showReset, setShowReset] = useState(false)
  const [resetFirstName, setResetFirstName] = useState('')
  const [resetLastName, setResetLastName] = useState('')
  const [resetMemberNr, setResetMemberNr] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetResult, setResetResult] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { first_name: firstName, last_name: lastName, pin })
      login(res.data.token, res.data.user)
      navigate('/')
    } catch {
      setError('Name oder PIN falsch')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    setResetResult(null)
    try {
      const res = await api.post('/auth/reset-pin', {
        first_name: resetFirstName,
        last_name: resetLastName,
        member_number: resetMemberNr,
      })
      setResetResult(res.data.temp_pin)
    } catch (e: any) {
      setResetError(e.response?.data?.error || 'Fehler beim Zurücksetzen')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #1A3B8F 0%, #0F2566 60%, #E8002D 100%)' }}>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Logo Header */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6"
          style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
          <img src="/logo.svg" alt="TV Bruvi"
            className="w-24 h-24 mb-4 drop-shadow-xl" />
          <h1 className="text-xl font-black text-white tracking-wide">TV Bruvi</h1>
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#FF9DB5' }}>
            TV Bruchhausen-Vilsen v. 1863 e.V.
          </p>
          <div className="mt-2 px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ background: '#E8002D' }}>
            🎾 Getränke · Sparte Tennis
          </div>
        </div>

        {/* Red divider */}
        <div className="h-1" style={{ background: '#E8002D' }} />

        <div className="p-6">

          {/* ── Login form ── */}
          {!showReset ? (
            <>
              <p className="text-center text-gray-500 text-sm mb-5">Bitte anmelden</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Vorname</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                      className="input-field" placeholder="Max" required autoComplete="given-name" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nachname</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                      className="input-field" placeholder="Mustermann" required autoComplete="family-name" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-gray-700">PIN</label>
                    <button type="button" onClick={() => {
                      setShowReset(true)
                      setResetFirstName(firstName)
                      setResetLastName(lastName)
                      setResetError('')
                      setResetResult(null)
                    }}
                      className="text-xs font-medium" style={{ color: '#1A3B8F' }}>
                      PIN vergessen?
                    </button>
                  </div>
                  <input type="password" value={pin} onChange={e => setPin(e.target.value)}
                    className="input-field text-2xl tracking-widest text-center"
                    placeholder="••••" maxLength={6} required />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-center text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary mt-2" disabled={loading}>
                  {loading ? 'Anmelden...' : 'Anmelden'}
                </button>
              </form>

              {/* Register link */}
              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 mb-2">Noch kein Account?</p>
                <button onClick={() => navigate('/register')}
                  className="text-sm font-semibold px-4 py-2 rounded-xl border-2 w-full transition-colors"
                  style={{ borderColor: '#1A3B8F', color: '#1A3B8F' }}>
                  Jetzt registrieren
                </button>
              </div>
            </>
          ) : (

          /* ── PIN-Reset form ── */
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setShowReset(false)} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
                <h2 className="font-black text-tennis-dark">PIN zurücksetzen</h2>
              </div>

              {resetResult ? (
                <div className="text-center space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                    <p className="text-sm text-green-700 font-semibold mb-1">Dein neuer temporärer PIN:</p>
                    <p className="text-4xl font-black text-green-800 tracking-widest my-2">{resetResult}</p>
                    <p className="text-xs text-green-600">Bitte nach dem Login sofort ändern</p>
                  </div>
                  <button onClick={() => {
                    setShowReset(false)
                    setFirstName(resetFirstName)
                    setLastName(resetLastName)
                    setPin(resetResult)
                  }} className="btn-primary">
                    Jetzt einloggen
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPin} className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Gib deinen Namen und deine Mitgliedsnummer ein. Wir setzen deinen PIN auf einen neuen temporären Wert zurück.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Vorname</label>
                      <input type="text" value={resetFirstName} onChange={e => setResetFirstName(e.target.value)}
                        className="input-field" placeholder="Max" required />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Nachname</label>
                      <input type="text" value={resetLastName} onChange={e => setResetLastName(e.target.value)}
                        className="input-field" placeholder="Mustermann" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mitgliedsnummer</label>
                    <input value={resetMemberNr} onChange={e => setResetMemberNr(e.target.value)}
                      className="input-field" placeholder="z. B. M042" required />
                  </div>

                  {resetError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm text-center">
                      {resetError}
                    </div>
                  )}

                  <button type="submit" className="btn-primary" disabled={resetLoading}>
                    {resetLoading ? 'Zurücksetzen...' : '🔑 PIN zurücksetzen'}
                  </button>
                  <button type="button" onClick={() => setShowReset(false)}
                    className="w-full text-center text-sm text-gray-400 mt-1 hover:text-gray-600">
                    Abbrechen
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-white/40 text-xs mt-6">© TV Bruchhausen-Vilsen v. 1863 e.V. · v{__APP_VERSION__}</p>
    </div>
  )
}
