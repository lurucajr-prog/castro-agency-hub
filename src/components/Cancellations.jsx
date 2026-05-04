import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Spinner, EmptyState, IS } from './shared'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

const STATUSES = ['Not Started', 'Called', 'Left VM', 'Reached', 'Saved', 'Lost']
const STATUS_COLORS = {
  'Not Started': { bg: '#f3f4f6', tx: '#6b7280' },
  'Called':      { bg: '#dbeafe', tx: '#1e40af' },
  'Left VM':     { bg: '#fef9c3', tx: '#854d0e' },
  'Reached':     { bg: '#e0f2fe', tx: '#075985' },
  'Saved':       { bg: '#dcfce7', tx: '#166534' },
  'Lost':        { bg: '#fee2e2', tx: '#991b1b' },
}

export default function Cancellations({ user }) {
  const [records, setRecords] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const fileRef = useRef(null)
  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [r, p] = await Promise.all([
      supabase.from('cancellations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    setRecords(r.data || [])
    setProfiles(p.data || [])
    setLoading(false)
  }

  async function clearList() {
    if (!window.confirm('Are you sure you want to clear the entire cancellation list? This cannot be undone.')) return
    setClearing(true)
    await supabase.from('cancellations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setRecords([])
    setClearing(false)
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 })

      let headerRowIdx = -1
      for (let i = 0; i < raw.length; i++) {
        if (raw[i].some(cell => typeof cell === 'string' && cell.includes('Insured First Name'))) {
          headerRowIdx = i; break
        }
      }

      if (headerRowIdx === -1) {
        alert('Could not find the data in this file. Make sure it\'s the Cancellation Audit report from Allstate.')
        setImporting(false); return
      }

      const headers = raw[headerRowIdx]
      const dataRows = raw.slice(headerRowIdx + 1).filter(row => row.some(v => v))
      const col = (name) => headers.findIndex(h => typeof h === 'string' && h.includes(name))

      const toInsert = dataRows.map(row => ({
        first_name: row[col('Insured First Name')] || '',
        last_name: row[col('Insured Last Name')] || '',
        address: row[col('Street Address')] || '',
        city: row[col('City')] || '',
        state: row[col('State')] || '',
        zip: String(row[col('Zip Code')] || '').split('-')[0],
        email: '',
        last_contact: row[col('Last Contact')] ? String(row[col('Last Contact')]).split(' ')[0] : 'Not Contacted',
        times_contacted: row[col('Number Of Times')] || '',
        has_consent: row[col('Customer Consent')] || '',
        status: 'Not Started',
      })).filter(r => r.first_name || r.last_name)

      if (toInsert.length === 0) { alert('No client records found.'); setImporting(false); return }

      await supabase.from('cancellations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const { error } = await supabase.from('cancellations').insert(toInsert)
      if (error) throw error

      await fetchData()
      alert(`✅ Imported ${toInsert.length} records successfully!`)
    } catch (err) {
      console.error(err)
      alert('Something went wrong during import. Please try again.')
    }
    setImporting(false)
    e.target.value = ''
  }

  async function updateStatus(id, status) {
    await supabase.from('cancellations').update({ status }).eq('id', id)
    setRecords(rs => rs.map(r => r.id === id ? { ...r, status } : r))
  }

  async function updateNotes(id, notes) {
    await supabase.from('cancellations').update({ notes }).eq('id', id)
    setRecords(rs => rs.map(r => r.id === id ? { ...r, notes } : r))
  }

  async function assignTo(id, uid) {
    await supabase.from('cancellations').update({ assigned_to: uid || null }).eq('id', id)
    setRecords(rs => rs.map(r => r.id === id ? { ...r, assigned_to: uid || null } : r))
  }

  if (loading) return <Spinner />

  const agents = profiles.filter(p => p.role === 'member')
  const filtered = records
    .filter(r => filter === 'All' || r.status === filter)
    .filter(r => {
      if (!search) return true
      const s = search.toLowerCase()
      return `${r.first_name} ${r.last_name}`.toLowerCase().includes(s) ||
        (r.city || '').toLowerCase().includes(s) ||
        (r.email || '').toLowerCase().includes(s)
    })

  const counts = {}
  STATUSES.forEach(s => { counts[s] = records.filter(r => r.status === s).length })
  const saved = counts['Saved'] || 0

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Cancellation list</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{records.length} clients · {saved} saved this cycle</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, city…" style={{ ...IS, width: 190 }} />
          {isAdmin && (
            <>
              <Btn onClick={() => fileRef.current?.click()} disabled={importing} variant="outline">
                {importing ? '⏳ Importing…' : '📥 Import Excel'}
              </Btn>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
              {records.length > 0 && (
                <Btn onClick={clearList} disabled={clearing} variant="danger" style={{ background: '#dc2626' }}>
                  {clearing ? 'Clearing…' : '🗑 Clear list'}
                </Btn>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[{ label: 'All', val: records.length }, ...STATUSES.map(s => ({ label: s, val: counts[s] }))].map(({ label, val }) => {
          const active = filter === label
          const sc = STATUS_COLORS[label]
          return (
            <button key={label} onClick={() => setFilter(label)} style={{
              padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
              background: active ? (sc?.bg || '#f3f4f6') : '#f3f4f6',
              color: active ? (sc?.tx || '#374151') : '#6b7280',
              outline: active && !sc ? `2px solid ${N}` : 'none',
            }}>{label} ({val ?? records.length})</button>
          )
        })}
      </div>

      <Card p={0}>
        {filtered.length === 0
          ? <EmptyState text={records.length === 0 ? 'No records yet. Import your cancellation list above.' : 'No records match this filter.'} />
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Client', 'Location', 'Last Contact', 'Consent', 'Status', 'Assigned', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.flatMap(r => {
                  const sc = STATUS_COLORS[r.status] || STATUS_COLORS['Not Started']
                  const assignedAgent = profiles.find(p => p.id === r.assigned_to)
                  const isExp = expanded === r.id
                  return [
                    <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : r.id)}>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{r.first_name} {r.last_name}</div>
                        {r.email && <div style={{ fontSize: 10, color: '#9ca3af' }}>{r.email}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.city}{r.state ? `, ${r.state}` : ''}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: r.last_contact === 'Not Contacted' ? '#ef4444' : '#6b7280' }}>
                        {r.last_contact === 'Not Contacted' ? '⚠ Not contacted' : r.last_contact}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 11, color: r.has_consent === 'Yes' ? '#166534' : '#991b1b', fontWeight: 500 }}>
                          {r.has_consent === 'Yes' ? '✓ Yes' : '✗ No'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: sc.bg, color: sc.tx, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{assignedAgent?.name || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 10, color: '#9ca3af' }}>{isExp ? '▲' : '▼'}</td>
                    </tr>,
                    isExp && (
                      <tr key={r.id + 'x'} style={{ background: '#fafafa', borderTop: '1px solid #f3f4f6' }}>
                        <td colSpan={7} style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' }}>Update status</div>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {STATUSES.map(s => {
                                  const c = STATUS_COLORS[s]
                                  return (
                                    <button key={s} onClick={() => updateStatus(r.id, s)} style={{ padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11, fontWeight: 500, border: `1px solid ${r.status === s ? c.tx : '#e5e7eb'}`, background: r.status === s ? c.bg : '#fff', color: r.status === s ? c.tx : '#6b7280' }}>{s}</button>
                                  )
                                })}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' }}>Assign to</div>
                              <select value={r.assigned_to || ''} onChange={e => assignTo(r.id, e.target.value)} style={{ ...IS, fontSize: 12 }}>
                                <option value="">Unassigned</option>
                                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' }}>Notes</div>
                              <input defaultValue={r.notes || ''} onBlur={e => updateNotes(r.id, e.target.value)} placeholder="Add notes…" style={{ ...IS, fontSize: 12 }} />
                            </div>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                            📍 {r.address}, {r.city}, {r.state} {r.zip}
                            {r.times_contacted && <span style={{ marginLeft: 12 }}>📞 {r.times_contacted}</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  ].filter(Boolean)
                })}
              </tbody>
            </table>
          )
        }
      </Card>
    </div>
  )
}
