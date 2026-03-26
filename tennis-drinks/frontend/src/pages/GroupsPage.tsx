import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import type { Group, Member } from '../types'

type Filter = 'alle' | 'offen' | 'vorlagen' | 'abgeschlossen'

export default function GroupsPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [filter, setFilter] = useState<Filter>('alle')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [groupType, setGroupType] = useState('spontan')
  const [isTemplate, setIsTemplate] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<number[]>([user!.id])

  const load = () => {
    api.get('/groups').then(r => setGroups(r.data))
    api.get('/members').then(r => setMembers(r.data.filter((m: Member) => m.active)))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!name) return
    await api.post('/groups', { name, group_type: groupType, member_ids: selectedMembers, is_template: isTemplate })
    load()
    setShowForm(false)
    setName('')
    setIsTemplate(false)
    setSelectedMembers([user!.id])
  }

  const toggleMember = (id: number) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const statusColor = (s: string) => ({
    offen: 'bg-green-100 text-green-800',
    in_verteilung: 'bg-yellow-100 text-yellow-800',
    abgeschlossen: 'bg-gray-100 text-gray-800',
    storniert: 'bg-red-100 text-red-800',
  }[s] || 'bg-gray-100 text-gray-800')

  const filtered = groups.filter(g => {
    if (filter === 'offen') return g.status === 'offen'
    if (filter === 'abgeschlossen') return g.status === 'abgeschlossen'
    if (filter === 'vorlagen') return (g as any).is_template === 1
    return true
  })

  const counts = {
    alle: groups.length,
    offen: groups.filter(g => g.status === 'offen').length,
    vorlagen: groups.filter(g => (g as any).is_template === 1).length,
    abgeschlossen: groups.filter(g => g.status === 'abgeschlossen').length,
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-tennis-dark">👥 Gruppen</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-tennis-green text-white rounded-xl px-4 py-2 font-medium">
          {showForm ? '✕' : '+ Neu'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 space-y-3">
          <h3 className="font-bold">Neue Gruppe</h3>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Gruppenname z.B. Herren 40" />
          <select value={groupType} onChange={e => setGroupType(e.target.value)} className="input-field">
            <option value="spontan">Spontan</option>
            <option value="mannschaft">Mannschaft</option>
            <option value="event">Event</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isTemplate} onChange={e => setIsTemplate(e.target.checked)} className="w-4 h-4 accent-tennis-green" />
            <span className="text-sm font-medium">Als Vorlage speichern (wiederverwendbar)</span>
          </label>
          <div>
            <div className="font-medium mb-2 text-sm">Mitglieder</div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {members.map(m => (
                <label key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={() => toggleMember(m.id)} className="w-4 h-4 accent-tennis-green" />
                  <span>{m.first_name} {m.last_name}</span>
                  {m.team && <span className="text-xs text-gray-400">({m.team})</span>}
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary">Gruppe anlegen</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['alle', 'offen', 'vorlagen', 'abgeschlossen'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-tennis-green text-white' : 'bg-gray-100 text-gray-600'}`}>
            {f === 'alle' ? '📋' : f === 'offen' ? '✅' : f === 'vorlagen' ? '📌' : '✓'} {f.charAt(0).toUpperCase() + f.slice(1)}
            {counts[f] > 0 && <span className="ml-1 opacity-70">({counts[f]})</span>}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(g => (
          <Link key={g.id} to={`/groups/${g.id}`} className="card flex justify-between items-center hover:shadow-lg transition-shadow block">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-bold">{g.name}</div>
                {(g as any).is_template === 1 && <span className="text-xs bg-tennis-green/10 text-tennis-green font-bold px-2 py-0.5 rounded-full">📌 Vorlage</span>}
              </div>
              <div className="text-sm text-gray-500">
                👤 {g.member_count} · 🍺 {g.booking_count} Buchungen · {new Date(g.created_at).toLocaleDateString('de-DE')}
              </div>
              <div className="text-xs text-gray-400 mt-1">{g.group_type} · von {g.created_by_name}</div>
            </div>
            <span className={`badge ${statusColor(g.status)}`}>{g.status}</span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            {filter === 'vorlagen' ? '📌 Keine Vorlagen vorhanden.\nErstelle eine Gruppe und markiere sie als Vorlage.' : 'Keine Gruppen vorhanden'}
          </p>
        )}
      </div>
    </div>
  )
}
