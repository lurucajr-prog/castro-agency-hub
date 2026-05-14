// ============================================================
// Castro Agency Hub — Audit Log
// Place this file at: src/components/AuditLog.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Spinner, EmptyState, IS } from './shared'
import { exportCSV } from '../utils/csv'

const PAGE_SIZE = 40

const ACTION_STYLE = {
  INSERT: { bg:'var(--success-light)', tx:'#166534' },
  UPDATE: { bg:'var(--primary-light)', tx:'var(--primary)' },
  DELETE: { bg:'var(--danger-light)',  tx:'#991b1b' },
}

const TABLE_LABELS = {
  sales:       '💰 Sales',
  referrals:   '↗ Referrals',
  reviews:     '⭐ Reviews',
  tasks:       '☑ Tasks',
  messages:    '💬 Chat',
  live_leads:  '⚡ Live Leads',
  lead_returns:'↩ Lead Returns',
  profiles:    '👤 Profiles',
  suggestions: '💡 Suggestions',
}

export default function AuditLog({ user }) {
  const [logs,     setLogs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState({ action:'All', table:'All', user:'All' })
  const [pg,       setPg]       = useState(0)

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) console.error('[AuditLog]', error)
    setLogs(data || [])
    setLoading(false)
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
  }

  function parseChanges(log) {
    if (log.action !== 'UPDATE' || !log.old_data || !log.new_data) return null
    try {
      const oldObj = JSON.parse(log.old_data)
      const newObj = JSON.parse(log.new_data)
      const changed = Object.entries(newObj)
        .filter(([k, v]) => oldObj[k] !== v && k !== 'updated_at')
        .map(([k]) => k)
      return changed.length ? changed.join(', ') : null
    } catch { return null }
  }

  if (loading) return <Spinner />

  // Build filter option lists
  const tables  = ['All', ...new Set(logs.map(l => l.table_name)).values()]
  const users   = ['All', ...new Set(logs.map(l => l.user_name).filter(Boolean)).values()]
  const actions = ['All', 'INSERT', 'UPDATE', 'DELETE']

  const filtered = logs.filter(l =>
    (filter.action === 'All' || l.action === filter.action) &&
    (filter.table  === 'All' || l.table_name === filter.table) &&
    (filter.user   === 'All' || l.user_name === filter.user)
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)

  function handleFilterChange(key, val) {
    setFilter(f => ({ ...f, [key]: val }))
    setPg(0)
  }

  function doExport() {
    const rows = filtered.map(l => [
      formatDate(l.created_at),
      l.user_name || '',
      l.action,
      l.table_name,
      l.record_id || '',
      parseChanges(l) || '',
    ])
    exportCSV('audit-log.csv', ['Time', 'User', 'Action', 'Table', 'Record ID', 'Changed fields'], rows)
  }

  return (
    <div style={{ padding:22 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:600, color:'var(--text-1)', marginBottom:2 }}>Audit log</div>
          <div style={{ fontSize:12, color:'var(--text-3)' }}>
            {filtered.length.toLocaleString()} records · Every change made in the app
          </div>
        </div>
        <Btn variant="outline" sm onClick={doExport}>⬇ Export CSV</Btn>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:14, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:10, color:'var(--text-4)', marginBottom:4, textTransform:'uppercase', letterSpacing:0.4 }}>Action</div>
          <div style={{ display:'flex', gap:4 }}>
            {actions.map(a => (
              <button key={a} onClick={() => handleFilterChange('action', a)} style={{ padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer', fontSize:11, fontWeight:500, background: filter.action===a ? N : 'var(--surface-3)', color: filter.action===a ? '#fff' : 'var(--text-3)' }}>{a}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text-4)', marginBottom:4, textTransform:'uppercase', letterSpacing:0.4 }}>Table</div>
          <select value={filter.table} onChange={e => handleFilterChange('table', e.target.value)} style={{ ...IS, width:'auto', fontSize:12, height:32 }}>
            {tables.map(t => <option key={t} value={t}>{t === 'All' ? 'All tables' : (TABLE_LABELS[t] || t)}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text-4)', marginBottom:4, textTransform:'uppercase', letterSpacing:0.4 }}>User</div>
          <select value={filter.user} onChange={e => handleFilterChange('user', e.target.value)} style={{ ...IS, width:'auto', fontSize:12, height:32 }}>
            {users.map(u => <option key={u} value={u}>{u === 'All' ? 'All users' : u}</option>)}
          </select>
        </div>
      </div>

      {/* Log table */}
      <Card p={0}>
        {paginated.length === 0 ? (
          <EmptyState text="No records match this filter." icon="📋" />
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--surface-2)' }}>
                {['Time','User','Action','Table','Record','Changed'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(l => {
                const ac      = ACTION_STYLE[l.action] || ACTION_STYLE.INSERT
                const changes = parseChanges(l)
                return (
                  <tr key={l.id} style={{ borderTop:'1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)', whiteSpace:'nowrap' }}>{formatDate(l.created_at)}</td>
                    <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{l.user_name || '—'}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ background:ac.bg, color:ac.tx, padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600 }}>{l.action}</span>
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-2)' }}>{TABLE_LABELS[l.table_name] || l.table_name}</td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-4)', fontFamily:'monospace' }}>
                      {l.record_id ? l.record_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {changes || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:14, alignItems:'center' }}>
          <Btn sm variant="outline" disabled={pg === 0} onClick={() => setPg(p => p - 1)}>← Prev</Btn>
          <span style={{ fontSize:12, color:'var(--text-3)' }}>Page {pg + 1} of {totalPages}</span>
          <Btn sm variant="outline" disabled={pg >= totalPages - 1} onClick={() => setPg(p => p + 1)}>Next →</Btn>
        </div>
      )}
    </div>
  )
}
