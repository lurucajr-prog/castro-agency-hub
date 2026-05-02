import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Spinner, EmptyState, IS } from './shared'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

const STATUSES = ['Not Started', 'Called', 'Left VM', 'Reached', 'Renewed', 'Lost']
const STATUS_COLORS = {
  'Not Started': { bg: '#f3f4f6', tx: '#6b7280' },
  'Called':      { bg: '#dbeafe', tx: '#1e40af' },
  'Left VM':     { bg: '#fef9c3', tx: '#854d0e' },
  'Reached':     { bg: '#e0f2fe', tx: '#075985' },
  'Renewed':     { bg: '#dcfce7', tx: '#166534' },
  'Lost':        { bg: '#fee2e2', tx: '#991b1b' },
}

export default function Renewals({ user }) {
  const [records, setRecords] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const fileRef = useRef(null)
  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [r, p] = await Promise.all([
      supabase.from('renewals').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    setRecords(r.data || [])
    setProfiles(p.data || [])
    setLoading(false)
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

      // Find actual header row — look for common renewal columns
      let headerRowIdx = -1
      const keywords = ['First Name', 'Last Name', 'Insured', 'Renewal', 'Policy', 'Expir']
      for (let i = 0; i < raw.length; i++) {
        const rowStr = raw[i].join(' ')
        if (keywords.some(k => rowStr.includes(k))) {
          headerRowIdx = i
          break
        }
      }

      if (headerRowIdx === -1) {
        alert('Could not find the data headers in this file. Please check it\'s the renewal list from Allstate.')
        setImporting(false)
        return
      }

      const headers = raw[headerRowIdx]
      const dataRows = raw.slice(headerRowIdx + 1).filter(row => row.some(v => v))

      const col = (name) => headers.findIndex(h => typeof h === 'string' && h.toLowerCase().includes(name.toLowerCase()))

      // Try common column name variants
      const iFirst = col('First Name') !== -1 ? col('First Name') : col('Insured First')
      const iLast = col('Last Name') !== -1 ? col('Last Name') : col('Insured Last')
      const iAddr = col('Address') !== -1 ? col('Address') : col('Street')
      const iCity = col('City')
      const iState = col('State')
      const iZip = col('Zip')
      const iRenewal = col('Renewal') !== -1 ? col('Renewal') : col('Expir')
      const iPolicy = col('Policy Type') !== -1 ? col('Policy Type') : col('Policy')

      const toInsert = dataRows.map(row => ({
        first_name: row[iFirst] || '',
        last_name: row[iLast] || '',
        address: iAddr !== -1 ? (row[iAddr] || '') : '',
        city: iCity !== -1 ? (row[iCity] || '') : '',
        state: iState !== -1 ? (row[iState] || '') : '',
        zip: iZip !== -1 ? String(row[iZip] || '').split('-')[0] : '',
        renewal_date: iRenewal !== -1 ? String(row[iRenewal] || '') : '',
        policy_type: iPolicy !== -1 ? (row[iPolicy] || '') : '',
        status: 'Not Started',
      })).filter(r => r.first_name || r.last_name)

      if (toInsert.length === 0) {
        alert('No client records found in this file.')
        setImporting(false)
        return
      }

      await supabase.from('renewals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const { error } = await supabase.from('renewals').insert(toInsert)
      if (error) throw error

      await fetchData()
      alert(`✅ Imported ${toInsert.length} renewal records successfully!`)
    } catch (err) {
      console.error(err)
      alert('Something went wrong during import. Please try again.')
    }

    setImporting(false)
    e.target.value = ''
  }

  async function updateStatus(id, status) {
    await supabase.from('renewals').update({ status }).eq('id', id)
    setRecords(rs => rs.map(r => r.id === id ? { ...r, status } : r))
  }

  async function updateNotes(id, notes) {
    await supabase.from('renewals').update({ notes }).eq('id', id)
    setRecords(rs => rs.map(r => r.id === id ? { ...r, notes } : r))
  }

  async function assignTo(id, uid) {
    await supabase.from('renewals').update({ assigned_to: uid || null }).eq('id', id)
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
        (r.policy_type || '').toLowerCase().includes(s)
    })

  const counts = {}
  STATUSES.forEach(s => { counts[s] = records.filter(r => r.status === s).length })
  const renewed = counts['Renewed'] || 0

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Renewal list</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{records.length} clients · {renewed} renewed this cycle</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, city, policy…" style={{ ...IS, width: 210 }} />
          {isAdmin && (
            <>
              <Btn onClick={() => fileRef.current?.click()} disabled={importing} variant="outline">
                {importing ? '⏳ Importing…' : '📥 Import Excel'}
              </Btn>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
            </>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[{ label: 'All', val: records.length }, ...STATUSES.map(s => ({ label: s, val: counts[s] }))].map(({ label, val }) => {
          const active = filter === label
          const sc = STATUS_COLORS[label]
          return (
            <button key={label} onClick={() => setFilter(label)} style={{
              padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
              background: active ? (sc?.bg || N) : '#f3f4f6',
              color: active ? (sc?.tx || '#fff') : '#6b7280',
            }}>{label} ({val ?? records.length})</button>
          )
        })}
      </div>

      <Card p={0}>
        {filtered.length === 0
          ? <EmptyState text={records.length === 0 ? 'No records yet. Import your renewal list above.' : 'No records match this filter.'} />
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Client', 'Policy', 'Renewal Date', 'Location', 'Status', 'Assigned', ''].map(h => (
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
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{r.first_name} {r.last_name}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.policy_type || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: r.renewal_date ? '#111' : '#9ca3af', fontWeight: r.renewal_date ? 500 : 400 }}>{r.renewal_date || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.city}{r.state ? `, ${r.state}` : ''}</td>
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
                                    <button key={s} onClick={() => updateStatus(r.id, s)} style={{
                                      padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                                      border: `1px solid ${r.status === s ? c.tx : '#e5e7eb'}`,
                                      background: r.status === s ? c.bg : '#fff',
                                      color: r.status === s ? c.tx : '#6b7280',
                                    }}>{s}</button>
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
                          {r.address && (
                            <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                              📍 {r.address}, {r.city}, {r.state} {r.zip}
                            </div>
                          )}
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
