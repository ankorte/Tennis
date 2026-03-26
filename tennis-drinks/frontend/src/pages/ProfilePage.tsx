import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function ProfilePage() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState(user?.email || '')
  const [team, setTeam] = useState(user?.team || '')
  const [phone, setPhone] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)

  useEffect(() => {
    // Profil-Daten nachladen (z.B. Telefon)
    api.get('/auth/me').then(r => {
      if (r.data) {
        setEmail(r.data.email || '')
        setTeam(r.data.team || '')
        setPhone(r.data.phone || '')
      }
    }).catch(() => {})
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true); setSaved(false)
    try {
      await api.put(`/members/${user!.id}`, { email, team, phone })
      // User-Objekt im Context aktualisieren
      const updatedUser = { ...user!, email, team }
      login(localStorage.getItem('token')!, updatedUser)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Fehler beim Speichern')
    } finally { setSaving(false) }
  }

  const handleChangePin = async () => {
    setPinError(''); setPinSuccess(false)
    if (newPin.length < 4) { setPinError('PIN muss mind. 4 Stellen haben'); return }
    if (newPin !== confirmPin) { setPinError('PINs stimmen nicht überein'); return }
    try {
      await api.put(`/members/${user!.id}`, { pin: newPin })
      setPinSuccess(true)
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
      setTimeout(() => setPinSuccess(false), 3000)
    } catch (e: any) {
      setPinError(e.response?.data?.error || 'Fehler beim Ändern')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
        <h1 className="text-2xl font-bold text-tennis-dark">⚙️ Mein Profil</h1>
      </div>

      {/* Profilinfo */}
      <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #1A3B8F 0%, #0F2566 100%)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl text-white font-bold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="text-white">
            <div className="text-lg font-bold">{user?.first_name} {user?.last_name}</div>
            <div className="text-sm text-white/70">#{user?.member_number} · {user?.role}</div>
          </div>
        </div>
      </div>

      {/* Profildaten bearbeiten */}
      <div className="card mb-4 space-y-3">
        <h3 className="font-bold text-tennis-dark">Kontaktdaten</h3>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">E-Mail</label>
          <input value={email} onChange={e => setEmail(e.target.value)}
            className="input-field text-sm" type="email" placeholder="deine@email.de" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Telefon</label>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className="input-field text-sm" placeholder="optional" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Mannschaft</label>
          <input value={team} onChange={e => setTeam(e.target.value)}
            className="input-field text-sm" placeholder="z.B. Herren 40" />
        </div>
        <button onClick={handleSaveProfile} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Speichern...' : saved ? '✅ Gespeichert!' : '💾 Profil speichern'}
        </button>
      </div>

      {/* PIN ändern */}
      <div className="card mb-4 space-y-3">
        <h3 className="font-bold text-tennis-dark">🔑 PIN ändern</h3>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Neuer PIN</label>
          <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
            className="input-field text-sm text-center text-xl tracking-widest" placeholder="••••" maxLength={6} />
          {newPin.length > 0 && newPin.length < 4 && (
            <div className="mt-1 h-1.5 rounded-full bg-red-200">
              <div className="h-full rounded-full bg-red-500" style={{ width: `${(newPin.length / 4) * 100}%` }} />
            </div>
          )}
          {newPin.length >= 4 && (
            <div className="mt-1 h-1.5 rounded-full bg-green-200">
              <div className="h-full rounded-full bg-green-500 w-full" />
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">PIN bestätigen</label>
          <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
            className="input-field text-sm text-center text-xl tracking-widest" placeholder="••••" maxLength={6} />
          {confirmPin.length > 0 && newPin !== confirmPin && (
            <p className="text-xs text-red-500 mt-1">PINs stimmen nicht überein</p>
          )}
          {confirmPin.length > 0 && newPin === confirmPin && newPin.length >= 4 && (
            <p className="text-xs text-green-600 mt-1">✓ PINs stimmen überein</p>
          )}
        </div>
        {pinError && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{pinError}</div>}
        {pinSuccess && <div className="bg-green-50 text-green-700 rounded-xl p-3 text-sm">✅ PIN erfolgreich geändert!</div>}
        <button onClick={handleChangePin}
          disabled={newPin.length < 4 || newPin !== confirmPin}
          className="btn-primary text-sm disabled:opacity-50">
          🔑 PIN ändern
        </button>
      </div>

      {/* Abmelden */}
      <button onClick={handleLogout}
        className="w-full py-3 rounded-xl text-red-600 font-bold border-2 border-red-200 hover:bg-red-50 transition-colors">
        Abmelden
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        App-Version: v{__APP_VERSION__}
      </p>
    </div>
  )
}
