import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import type { Member } from '../types'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  kassenwart: 'bg-purple-100 text-purple-800',
  thekenwart: 'bg-blue-100 text-blue-800',
  mitglied: 'bg-gray-100 text-gray-800',
}
const ROLE_LABELS: Record<string, string> = {
  admin: '🔑 Admin',
  kassenwart: '💰 Kassenwart',
  thekenwart: '🍺 Thekenwart',
  mitglied: '👤 Mitglied',
}

const emptyForm = {
  member_number: '', first_name: '', last_name: '', email: '',
  phone: '', status: 'aktiv', role: 'mitglied', team: '', pin: '',
  iban: '', bic: '', mandate_ref: '', mandate_date: '',
}

export default function MembersPage() {
  const { isAdmin, isKassenwart } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'active' | 'pending'>('active')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)

  // Edit state
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // PIN reset state
  const [pinResetResult, setPinResetResult] = useState<{ id: number; pin: string } | null>(null)
  const [resettingPin, setResettingPin] = useState<number | null>(null)

  const load = () => api.get('/members').then(r => setMembers(r.data))
  useEffect(() => { load() }, [])

  const filtered = members.filter(m => {
    const matchTab =
      tab === 'all' ? true :
      tab === 'active' ? m.active === 1 :
      tab === 'pending' ? m.active === 0 : true
    const q = search.toLowerCase()
    const matchSearch = !q || [m.first_name, m.last_name, m.email || '', m.member_number, m.team || ''].some(v => v.toLowerCase().includes(q))
    return matchTab && matchSearch
  }).sort((a, b) => {
    const nameA = `${a.last_name} ${a.first_name}`.toLowerCase()
    const nameB = `${b.last_name} ${b.first_name}`.toLowerCase()
    return nameA.localeCompare(nameB, 'de')
  })

  const pendingCount = members.filter(m => m.active === 0).length

  // ── Create ──────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.post('/members', form)
      load()
      setShowCreate(false)
      setForm(emptyForm)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Fehler beim Anlegen')
    } finally { setCreating(false) }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  const openEdit = (m: any) => {
    setEditId(m.id)
    setEditForm({
      member_number: m.member_number,
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email,
      phone: m.phone || '',
      status: m.status,
      role: m.role,
      team: m.team || '',
      pin: '',
      iban: m.iban || '',
      bic: m.bic || '',
      mandate_ref: m.mandate_ref || '',
      mandate_date: m.mandate_date || '',
    })
    setSaveError('')
    setPinResetResult(null)
  }

  const handleSave = async () => {
    if (!editId) return
    setSaving(true)
    setSaveError('')
    try {
      const payload: any = { ...editForm }
      if (!payload.pin) delete payload.pin          // only send pin if filled
      await api.put(`/members/${editId}`, payload)
      setEditId(null)
      load()
    } catch (e: any) {
      setSaveError(e.response?.data?.error || 'Fehler beim Speichern')
    } finally { setSaving(false) }
  }

  // ── PIN Reset ────────────────────────────────────────────────────────────────

  const handleResetPin = async (id: number) => {
    if (!window.confirm('PIN dieses Mitglieds zurücksetzen?')) return
    setResettingPin(id)
    setPinResetResult(null)
    try {
      const r = await api.post(`/members/${id}/reset-pin`)
      setPinResetResult({ id, pin: r.data.temp_pin })
    } catch (e: any) {
      alert(e.response?.data?.error || 'Fehler beim PIN-Reset')
    } finally { setResettingPin(null) }
  }

  // ── Activate / Deactivate ────────────────────────────────────────────────────

  const handleToggleActive = async (m: Member) => {
    const action = m.active ? 'deaktivieren' : 'aktivieren'
    if (!window.confirm(`${m.first_name} ${m.last_name} ${action}?`)) return
    try {
      await api.post(`/members/${m.id}/toggle-active`)
      load()
      if (editId === m.id) setEditId(null)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Fehler')
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-tennis-dark">👤 Mitglieder</h1>
        {isKassenwart && (
          <button onClick={() => { setShowCreate(!showCreate); setEditId(null) }}
            className="btn-primary text-sm py-2 px-4">{showCreate ? '✕ Abbrechen' : '+ Neu'}</button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-4 space-y-3">
          <h3 className="font-bold">Neues Mitglied anlegen</h3>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.member_number} onChange={e => setForm(f => ({ ...f, member_number: e.target.value }))}
              className="input-field" placeholder="Mitgl.-Nr. *" />
            <input value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
              className="input-field" placeholder="PIN *" type="password" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              className="input-field" placeholder="Vorname *" />
            <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              className="input-field" placeholder="Nachname *" />
          </div>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="input-field" placeholder="E-Mail (optional)" type="email" />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="input-field" placeholder="Telefon (optional)" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input-field">
              {['aktiv', 'inaktiv', 'gast', 'jugend', 'trainer'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input-field">
              {['mitglied', 'thekenwart', 'kassenwart', ...(isAdmin ? ['admin'] : [])].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <input value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
            className="input-field" placeholder="Mannschaft (optional)" />
          <button onClick={handleCreate} disabled={creating} className="btn-primary">
            {creating ? 'Anlegen...' : 'Mitglied anlegen'}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1">
        {([['active', 'Aktiv'], ['pending', `Ausstehend${pendingCount > 0 ? ` (${pendingCount})` : ''}`], ['all', 'Alle']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${tab === key ? 'bg-white shadow text-tennis-dark' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        className="input-field mb-3" placeholder="🔍 Name, E-Mail, Mitgl.-Nr. suchen..." />

      {/* Member list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            {tab === 'pending' ? 'Keine ausstehenden Registrierungen' : 'Keine Mitglieder gefunden'}
          </div>
        )}

        {filtered.map(m => (
          <div key={m.id} className={`card transition-all ${!m.active ? 'border border-orange-200 bg-orange-50' : ''}`}>

            {/* Member row */}
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">
                  {m.first_name} {m.last_name}
                  {!m.active && <span className="ml-2 text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">⏳ Ausstehend</span>}
                </div>
                {m.email && <div className="text-sm text-gray-500 truncate">{m.email}</div>}
                <div className="text-xs text-gray-400 flex gap-2 flex-wrap mt-0.5">
                  <span>#{m.member_number}</span>
                  {m.team && <span>· {m.team}</span>}
                  {m.iban && <span className="text-green-500" title={`IBAN: ...${m.iban.slice(-4)}`}>🏦</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                <span className={`badge ${ROLE_COLORS[m.role]}`}>{ROLE_LABELS[m.role] || m.role}</span>
                {isKassenwart && (
                  <button onClick={() => editId === m.id ? setEditId(null) : openEdit(m)}
                    className="text-xs text-tennis-green border border-tennis-green rounded-lg px-2 py-1">
                    {editId === m.id ? '▲ Schließen' : '✏️ Bearbeiten'}
                  </button>
                )}
              </div>
            </div>

            {/* PIN reset result banner */}
            {pinResetResult?.id === m.id && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-green-700 font-semibold">PIN zurückgesetzt</p>
                  <p className="text-lg font-black text-green-800 tracking-widest">{pinResetResult.pin}</p>
                  <p className="text-xs text-green-600">Bitte dem Mitglied mitteilen</p>
                </div>
                <button onClick={() => setPinResetResult(null)} className="text-green-600 text-lg">✓</button>
              </div>
            )}

            {/* Edit panel */}
            {editId === m.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Mitgl.-Nr.</label>
                    <input value={editForm.member_number}
                      onChange={e => setEditForm(f => ({ ...f, member_number: e.target.value }))}
                      className="input-field" disabled={!isAdmin} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Telefon</label>
                    <input value={editForm.phone}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="input-field" placeholder="optional" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Vorname</label>
                    <input value={editForm.first_name}
                      onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Nachname</label>
                    <input value={editForm.last_name}
                      onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                      className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">E-Mail</label>
                  <input value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="input-field" type="email" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Status</label>
                    <select value={editForm.status}
                      onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="input-field">
                      {['aktiv', 'inaktiv', 'gast', 'jugend', 'trainer'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Rolle</label>
                    <select value={editForm.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                      className="input-field" disabled={!isAdmin}>
                      {['mitglied', 'thekenwart', 'kassenwart', ...(isAdmin ? ['admin'] : [])].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Mannschaft</label>
                  <input value={editForm.team}
                    onChange={e => setEditForm(f => ({ ...f, team: e.target.value }))}
                    className="input-field" placeholder="optional" />
                </div>
                {/* SEPA / Bankdaten */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">🏦 Bankdaten (SEPA)</label>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">IBAN</label>
                      <input value={editForm.iban}
                        onChange={e => setEditForm(f => ({ ...f, iban: e.target.value.toUpperCase() }))}
                        className="input-field font-mono text-sm" placeholder="DE89 3704 0044 0532 0130 00" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">BIC (optional)</label>
                        <input value={editForm.bic}
                          onChange={e => setEditForm(f => ({ ...f, bic: e.target.value.toUpperCase() }))}
                          className="input-field font-mono text-sm" placeholder="COBADEFFXXX" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Mandatsreferenz</label>
                        <input value={editForm.mandate_ref}
                          onChange={e => setEditForm(f => ({ ...f, mandate_ref: e.target.value }))}
                          className="input-field font-mono text-sm" placeholder="auto" />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Neuer PIN (leer lassen = unverändert)</label>
                  <input value={editForm.pin}
                    onChange={e => setEditForm(f => ({ ...f, pin: e.target.value }))}
                    className="input-field" type="password" placeholder="Neuen PIN eingeben..." maxLength={6} />
                </div>

                {saveError && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{saveError}</div>}

                <div className="flex flex-wrap gap-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2">
                    {saving ? 'Speichern...' : '✓ Speichern'}
                  </button>
                  <button onClick={() => handleToggleActive(m)}
                    className={`text-sm py-2 px-4 rounded-xl font-semibold border transition-colors ${m.active ? 'border-red-300 text-red-600 bg-red-50' : 'border-green-300 text-green-700 bg-green-50'}`}>
                    {m.active ? '🚫 Deaktivieren' : '✓ Aktivieren'}
                  </button>
                  <button onClick={() => handleResetPin(m.id)} disabled={resettingPin === m.id}
                    className="text-sm py-2 px-4 rounded-xl font-semibold border border-yellow-300 text-yellow-700 bg-yellow-50">
                    {resettingPin === m.id ? '...' : '🔑 PIN reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
