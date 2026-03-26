import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

interface TableInfo {
  name: string
  rowCount: number
}

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

interface TableData {
  rows: Record<string, unknown>[]
  total: number
  page: number
  totalPages: number
  limit: number
}

const CRITICAL_TABLES = ['members', 'bookings', 'drinks', 'billings', 'groups']

export default function DatabasePage() {
  const navigate = useNavigate()

  // State: Tabellenliste
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loadingTables, setLoadingTables] = useState(true)
  const [error, setError] = useState('')

  // State: ausgewaehlte Tabelle
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [data, setData] = useState<TableData | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // State: Pagination, Suche, Sortierung
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // State: Inline-Edit
  const [editCell, setEditCell] = useState<{ rowId: unknown; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // State: Neue Zeile
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRow, setNewRow] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Tabellen laden
  const loadTables = useCallback(async () => {
    setLoadingTables(true)
    setError('')
    try {
      const res = await api.get('/database/tables')
      setTables(res.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Laden der Tabellen'
      setError(msg)
    } finally {
      setLoadingTables(false)
    }
  }, [])

  useEffect(() => { loadTables() }, [loadTables])

  // Tabellendaten laden
  const loadData = useCallback(async (tableName: string, p: number, s: string, sc: string, so: string) => {
    setLoadingData(true)
    setError('')
    try {
      const [schemaRes, dataRes] = await Promise.all([
        api.get(`/database/tables/${tableName}`),
        api.get(`/database/tables/${tableName}/data`, {
          params: { page: p, limit: 50, search: s, sort: sc, order: so }
        })
      ])
      setColumns(schemaRes.data.columns)
      setData(dataRes.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Laden der Daten'
      setError(msg)
    } finally {
      setLoadingData(false)
    }
  }, [])

  // Tabelle oeffnen
  const openTable = (name: string) => {
    setSelectedTable(name)
    setPage(1)
    setSearch('')
    setSearchInput('')
    setSortCol('')
    setSortOrder('asc')
    setEditCell(null)
    setShowAddForm(false)
    loadData(name, 1, '', '', 'asc')
  }

  // Zurueck zur Tabellenliste
  const goBack = () => {
    setSelectedTable(null)
    setColumns([])
    setData(null)
    setError('')
    loadTables()
  }

  // Daten neu laden (aktuelle Tabelle)
  const reload = useCallback(() => {
    if (selectedTable) loadData(selectedTable, page, search, sortCol, sortOrder)
  }, [selectedTable, page, search, sortCol, sortOrder, loadData])

  // Sortierung aendern
  const handleSort = (col: string) => {
    let newOrder: 'asc' | 'desc' = 'asc'
    if (sortCol === col && sortOrder === 'asc') newOrder = 'desc'
    setSortCol(col)
    setSortOrder(newOrder)
    setPage(1)
    if (selectedTable) loadData(selectedTable, 1, search, col, newOrder)
  }

  // Suche
  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
    if (selectedTable) loadData(selectedTable, 1, searchInput, sortCol, sortOrder)
  }

  // Seitenwechsel
  const goToPage = (p: number) => {
    setPage(p)
    if (selectedTable) loadData(selectedTable, p, search, sortCol, sortOrder)
  }

  // PK-Spalte finden
  const getPkCol = () => columns.find(c => c.pk === 1)

  // Inline-Edit starten
  const startEdit = (rowId: unknown, col: string, currentValue: unknown) => {
    setEditCell({ rowId, col })
    setEditValue(currentValue === null || currentValue === undefined ? '' : String(currentValue))
  }

  // Inline-Edit speichern
  const saveEdit = async () => {
    if (!editCell || !selectedTable) return
    const pk = getPkCol()
    if (!pk) return
    setSaving(true)
    try {
      await api.put(`/database/tables/${selectedTable}/data/${editCell.rowId}`, {
        [editCell.col]: editValue === '' ? null : editValue
      })
      setEditCell(null)
      reload()
    } catch (err: unknown) {
      const respErr = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(respErr || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  // Zeile loeschen
  const handleDelete = async (rowId: unknown) => {
    if (!selectedTable) return
    const pk = getPkCol()
    if (!pk) return

    const isCritical = CRITICAL_TABLES.includes(selectedTable)
    const msg = isCritical
      ? `ACHTUNG: "${selectedTable}" ist eine kritische Tabelle!\n\nDatensatz mit ${pk.name}=${rowId} wirklich loeschen?`
      : `Datensatz mit ${pk.name}=${rowId} wirklich loeschen?`

    if (!window.confirm(msg)) return

    try {
      await api.delete(`/database/tables/${selectedTable}/data/${rowId}`, {
        data: isCritical ? { confirm: true } : undefined
      })
      reload()
    } catch (err: unknown) {
      const respErr = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(respErr || 'Loeschen fehlgeschlagen')
    }
  }

  // Neue Zeile einfuegen
  const handleInsert = async () => {
    if (!selectedTable) return
    // Leere Felder filtern
    const body: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(newRow)) {
      if (v !== '') body[k] = v
    }
    if (Object.keys(body).length === 0) {
      alert('Bitte mindestens ein Feld ausfuellen.')
      return
    }
    setSaving(true)
    try {
      await api.post(`/database/tables/${selectedTable}/data`, body)
      setShowAddForm(false)
      setNewRow({})
      reload()
    } catch (err: unknown) {
      const respErr = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(respErr || 'Einfuegen fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  // Zellwert formatieren
  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'string' && val.length > 80) return val.slice(0, 80) + '...'
    return String(val)
  }

  // =========================================================
  // RENDER: Tabellenliste
  // =========================================================
  if (!selectedTable) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-tennis-dark">Datenbank-Explorer</h2>
            <p className="text-sm text-gray-500">Tabellen direkt anzeigen und bearbeiten</p>
          </div>
          <button onClick={() => navigate('/')} className="btn-secondary text-sm py-2 px-4">
            Zurueck
          </button>
        </div>

        {error && (
          <div className="card border-l-4 border-red-500 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {loadingTables ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin mb-3"
                style={{ borderColor: '#1A3B8F', borderTopColor: 'transparent' }} />
              <p className="text-sm text-gray-400">Tabellen laden...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map(t => (
              <button
                key={t.name}
                onClick={() => openTable(t.name)}
                className="card text-left hover:shadow-lg transition-shadow active:scale-[0.98]"
              >
                <div className="font-bold text-tennis-dark text-sm truncate">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1">{t.rowCount} Zeilen</div>
                {CRITICAL_TABLES.includes(t.name) && (
                  <span className="inline-block mt-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                    kritisch
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // =========================================================
  // RENDER: Tabellendaten
  // =========================================================
  const pk = getPkCol()

  return (
    <div className="p-4 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={goBack} className="btn-secondary text-sm py-2 px-4">
          Zurueck
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-tennis-dark truncate">{selectedTable}</h2>
          <p className="text-xs text-gray-500">
            {data ? `${data.total} Zeilen | Seite ${data.page}/${data.totalPages}` : 'Laden...'}
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setNewRow({}) }}
          className="btn-primary text-sm py-2 px-4"
        >
          + Neue Zeile
        </button>
      </div>

      {error && (
        <div className="card border-l-4 border-red-500 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Suche */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Suchen..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          className="input-field flex-1"
        />
        <button onClick={handleSearch} className="btn-primary text-sm py-2 px-4">
          Suchen
        </button>
        {search && (
          <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); if (selectedTable) loadData(selectedTable, 1, '', sortCol, sortOrder) }}
            className="btn-secondary text-sm py-2 px-3">
            Zuruecksetzen
          </button>
        )}
      </div>

      {/* Neue Zeile Form */}
      {showAddForm && (
        <div className="card mb-4 border-l-4 border-tennis-dark">
          <h3 className="font-bold text-tennis-dark mb-3">Neue Zeile einfuegen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {columns.filter(c => c.pk !== 1).map(col => (
              <div key={col.name}>
                <label className="text-xs text-gray-500 block mb-0.5">
                  {col.name}
                  <span className="ml-1 text-gray-300">({col.type || 'TEXT'})</span>
                </label>
                <input
                  type="text"
                  value={newRow[col.name] || ''}
                  onChange={e => setNewRow(prev => ({ ...prev, [col.name]: e.target.value }))}
                  placeholder={col.dflt_value ? `Standard: ${col.dflt_value}` : ''}
                  className="input-field text-sm w-full"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleInsert} disabled={saving} className="btn-primary text-sm py-2 px-4">
              {saving ? 'Speichern...' : 'Einfuegen'}
            </button>
            <button onClick={() => { setShowAddForm(false); setNewRow({}) }} className="btn-secondary text-sm py-2 px-4">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Tabelle */}
      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin mb-3"
              style={{ borderColor: '#1A3B8F', borderTopColor: 'transparent' }} />
            <p className="text-sm text-gray-400">Daten laden...</p>
          </div>
        </div>
      ) : data && data.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {columns.map(col => (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none"
                  >
                    <div className="font-bold text-tennis-dark text-xs">
                      {col.name}
                      {sortCol === col.name && (
                        <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-normal">{col.type || 'TEXT'}{col.pk ? ' PK' : ''}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-400 whitespace-nowrap">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => {
                const rowId = pk ? row[pk.name] : idx
                return (
                  <tr key={String(rowId)} className="border-t border-gray-100 hover:bg-blue-50/30">
                    {columns.map(col => {
                      const isEditing = editCell?.rowId === rowId && editCell?.col === col.name
                      const cellValue = row[col.name]
                      return (
                        <td key={col.name} className="px-3 py-1.5 whitespace-nowrap max-w-[200px]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit()
                                if (e.key === 'Escape') setEditCell(null)
                              }}
                              onBlur={() => setEditCell(null)}
                              autoFocus
                              disabled={saving}
                              className="input-field text-xs py-1 px-2 w-full min-w-[80px]"
                            />
                          ) : (
                            <span
                              onClick={() => {
                                if (col.pk === 1) return // PK nicht editierbar
                                if (pk) startEdit(rowId, col.name, cellValue)
                              }}
                              className={`text-xs truncate block ${
                                col.pk === 1 ? 'text-gray-400 font-mono' : 'cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1'
                              } ${cellValue === null ? 'text-gray-300 italic' : 'text-gray-700'}`}
                              title={cellValue === null ? 'NULL' : String(cellValue)}
                            >
                              {formatCell(cellValue)}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(rowId)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                        title="Loeschen"
                      >
                        Loeschen
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : data && data.rows.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400 text-sm">
            {search ? 'Keine Ergebnisse fuer die Suche.' : 'Tabelle ist leer.'}
          </p>
        </div>
      ) : null}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="btn-secondary text-sm py-2 px-4 disabled:opacity-40"
          >
            Zurueck
          </button>
          <span className="text-sm text-gray-500">
            Seite {data.page} von {data.totalPages} ({data.total} Zeilen)
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= data.totalPages}
            className="btn-secondary text-sm py-2 px-4 disabled:opacity-40"
          >
            Weiter
          </button>
        </div>
      )}
    </div>
  )
}
