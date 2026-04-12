import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function ProfilePage() {
  const { user, login, logout, clearMustChangePin, mustChangePin } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState(user?.email || '')
  const [team, setTeam] = useState(user?.team || '')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // PIN ändern
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinChanging, setPinChanging] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)

  useEffect(() => {
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
    if (!currentPin) { setPinError('Bitte aktuellen PIN eingeben'); return }
    if (newPin.length < 4) { setPinError('Neuer PIN muss mind. 4 Stellen haben'); return }
    if (newPin !== confirmPin) { setPinError('PINs stimmen nicht überein'); return }
    setPinChanging(true)
    try {
      await api.post('/auth/change-pin', { current_pin: currentPin, new_pin: newPin })
      setPinSuccess(true)
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
      clearMustChangePin()
      setTimeout(() => setPinSuccess(false), 4000)
    } catch (e: any) {
      setPinError(e.response?.data?.error || 'Fehler beim Ändern')
    } finally { setPinChanging(false) }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  // Erzwungener PIN-Wechsel – gesamte Seite
  if (mustChangePin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg, #1A3B8F 0%, #0F2566 60%, #E8002D 100%)' }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="flex flex-col items-center pt-6 pb-4 px-6"
            style={{ background: 'linear-gradient(135deg, #E8002D 0%, #b5001f 100%)' }}>
            <div className="text-4xl mb-2">🔑</div>
            <h1 className="text-lg font-black text-white">PIN-Änderung erforderlich</h1>
            <p className="text-xs text-white/80 mt-1 text-center">Du musst deinen PIN ändern bevor du fortfahren kannst.</p>
          </div>
          <div className="h-1" style={{ background: '#1A3B8F' }} />
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Aktueller PIN</label>
              <input type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)}
                className="input-field text-center text-xl tracking-widest" placeholder="••••" maxLength={6} autoFocus />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Neuer PIN</label>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
                className="input-field text-center text-xl tracking-widest" placeholder="••••" maxLength={6} />
              {newPin.length > 0 && (
                <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                  <div className={`h-full rounded-full transition-all ${newPin.length >= 4 ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, (newPin.length / 4) * 100)}%` }} />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Neuen PIN bestätigen</label>
              <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
                className="input-field text-center text-xl tracking-widest" placeholder="••••" maxLength={6} />
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
              disabled={pinChanging || !currentPin || newPin.length < 4 || newPin !== confirmPin}
              className="btn-primary text-sm disabled:opacity-50">
              {pinChanging ? '⏳ Ändern...' : '🔑 PIN jetzt ändern'}
            </button>
            <button onClick={handleLogout} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">
              Abmelden
            </button>
          </div>
        </div>
      </div>
    )
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
          <label className="text-xs text-gray-500 mb-1 block">Aktueller PIN</label>
          <input type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)}
            className="input-field text-sm text-center text-xl tracking-widest" placeholder="••••" maxLength={6} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Neuer PIN</label>
          <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
            className="input-field text-sm text-center text-xl tracking-widest" placeholder="••••" maxLength={6} />
          {newPin.length > 0 && (
            <div className="mt-1 h-1.5 rounded-full bg-gray-100">
              <div className={`h-full rounded-full transition-all ${newPin.length >= 4 ? 'bg-green-500' : 'bg-red-400'}`}
                style={{ width: `${Math.min(100, (newPin.length / 4) * 100)}%` }} />
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
          disabled={pinChanging || !currentPin || newPin.length < 4 || newPin !== confirmPin}
          className="btn-primary text-sm disabled:opacity-50">
          {pinChanging ? '⏳ Ändern...' : '🔑 PIN ändern'}
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
