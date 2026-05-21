// ============================================================
// Castro Agency Hub — Lead Returns (standalone page)
// Place this file at: src/components/LeadReturns.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner, ConfirmModal } from './shared'

const SOURCES = ['BP', 'Allstate Lead Marketplace', 'EverQuote', 'Other']
const REASONS = ['Disconnected', 'Wrong Number', 'Out of State', 'Current Customer']
const REASON_STYLE = {
  'Disconnected': { bg: '#fee2e2', color: '#991b1b' },
  'Wrong Number': { bg: '#fef9c3', color: '#854d0e' },
  'Out of State': { bg: '#dbeafe', color: '#1e40af' },
}

const SOURCE_STYLE = {
  'BP':                        { bg: '#1B3A6B', color: '#fff' },
  'Allstate Lead Marketplace': { bg: '#0f766e', color: '#fff' },
  'EverQuote':                 { bg: '#15803d', color: '#fff' },
  'Other':                     { bg: '#6b7280', color: '#fff' },
}

const INPUT = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--surface)',
  color: 'var(--text-1)',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export default function LeadReturns({ user }) {
  const isAdmin = user.role === 'admin'

  const [returns,       setReturns]      = useState([])
  const [profiles,      setProfiles]     = useState([])
  const [loading,       setLoading]      = useState(true)
  const [saving,        setSaving]       = useState(false)
  const [form,          setForm]         = useState({ name: '', phone: '', source: 'BP', reason: 'Disconnected' })
  const [editItem,      setEditItem]     = useState(null)
  const [editForm,      setEditForm]     = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterSource,  setFilterSource] = useState('All')
  const [filterReason,  setFilterReason] = useState('All')
  const [filterAgent,   setFilterAgent]  = useState('All')
  const [nameError,     setNameError]    = useState(false)
  const [phoneError,    setPhoneError]   = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [retRes, profRes] = await Promise.all([
      supabase.from('lead_returns').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name, ini, role'),
    ])
    const all = retRes.data || []
    setReturns(isAdmin ? all : all.filter(r => r.logged_by === user.id))
    setProfiles(profRes.data || [])
    setLoading(false)
  }

  function getProfile(uid) {
    return profiles.find(p => p.id === uid) || { name: 'Unknown', ini: '??' }
  }

  async function submitReturn() {
    const nameOk  = form.name.trim().length > 0
    const phoneOk = form.phone.trim().length > 0
    setNameError(!nameOk)
    setPhoneError(!phoneOk)
    if (!nameOk || !phoneOk) return

    setSaving(true)
    const { data } = await supabase.from('lead_returns')
      .insert({ name: form.name.trim(), phone: form.phone.trim(), source: form.source, reason: form.reason, logged_by: user.id, status: 'New' })
      .select().single()
    if (data) setReturns(r => [data, ...r])
    setForm({ name: '', phone: '', source: 'BP', reason: 'Disconnected' })
    setNameError(false)
    setPhoneError(false)
    setSaving(false)
  }

  async function saveEdit() {
    if (!editForm.name?.trim() || !editForm.phone?.trim()) return
    const { data } = await supabase.from('lead_returns')
      .update({ name: editForm.name.trim(), phone: editForm.phone.trim(), source: editForm.source, reason: editForm.reason })
      .eq('id', editItem.id).select().single()
    if (data) setReturns(r => r.map(x => x.id === data.id ? data : x))
    setEditItem(null)
  }

  async function deleteReturn() {
    await supabase.from('lead_returns').delete().eq('id', confirmDelete.id)
    setReturns(r => r.filter(x => x.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  const filtered = returns.filter(r => {
    if (filterSource !== 'All' && r.source !== filterSource) return false
    if (filterReason !== 'All' && r.reason !== filterReason) return false
    if (isAdmin && filterAgent !== 'All' && r.logged_by !== filterAgent) return false
    return true
  })

  const byReason = {
    'Disconnected': returns.filter(r => r.reason === 'Disconnected').length,
    'Wrong Number':  returns.filter(r => r.reason === 'Wrong Number').length,
    'Out of State':  returns.filter(r => r.reason === 'Out of State').length,
  }

  // Agents who have submitted at least one return (for admin filter)
  const activeAgents = profiles.filter(p => returns.some(r => r.logged_by === p.id))

  if (loading) return <Spinner />

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
          Lead Returns
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {isAdmin
            ? `Viewing all agents · ${returns.length} total return${returns.length !== 1 ? 's' : ''}`
            : `Your returns only · ${returns.length} logged`}
        </div>
      </div>

      {/* ── Quick log form ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: 'var(--shadow-sm)', borderTop: `3px solid ${N}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>
          Log a return
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>

          {/* Name */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: nameError ? 'var(--danger)' : 'var(--text-3)', marginBottom: 6 }}>
              Name {nameError && <span style={{ fontWeight: 400 }}>— required</span>}
            </div>
            <input
              style={{ ...INPUT, borderColor: nameError ? 'var(--danger)' : 'var(--border)' }}
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') submitReturn() }}
              placeholder="Client name"
            />
          </div>

          {/* Phone */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: phoneError ? 'var(--danger)' : 'var(--text-3)', marginBottom: 6 }}>
              Phone {phoneError && <span style={{ fontWeight: 400 }}>— required</span>}
            </div>
            <input
              style={{ ...INPUT, borderColor: phoneError ? 'var(--danger)' : 'var(--border)' }}
              value={form.phone}
              onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setPhoneError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') submitReturn() }}
              placeholder="Phone number"
            />
          </div>

          {/* Source */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Source</div>
            <select style={INPUT} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Reason */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Reason</div>
            <select style={INPUT} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Submit */}
          <button
            onClick={submitReturn}
            disabled={saving}
            style={{ height: 42, padding: '0 28px', background: saving ? 'var(--surface-3)' : N, color: saving ? 'var(--text-4)' : '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
          >
            {saving ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Returns',  value: returns.length,           bg: 'var(--surface)',  color: 'var(--text-1)',  border: 'var(--border)', accent: 'var(--border-2)' },
          { label: 'Disconnected',   value: byReason['Disconnected'], bg: '#fee2e2',         color: '#991b1b',        border: '#fca5a5',       accent: '#ef4444' },
          { label: 'Wrong Number',   value: byReason['Wrong Number'], bg: '#fef9c3',         color: '#854d0e',        border: '#fde047',       accent: '#f59e0b' },
          { label: 'Out of State',   value: byReason['Out of State'], bg: '#dbeafe',         color: '#1e40af',        border: '#93c5fd',       accent: '#3b82f6' },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', borderBottom: `3px solid ${stat.accent}` }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: 8 }}>{stat.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: stat.color, opacity: 0.75 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Source pills */}
        {['All', ...SOURCES].map(s => (
          <button key={s} onClick={() => setFilterSource(s)}
            style={{ padding: '5px 13px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: filterSource === s ? N : 'var(--surface-3)', color: filterSource === s ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }}>
            {s}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        {/* Reason pills */}
        {['All', ...REASONS].map(r => {
          const active = filterReason === r
          const style  = REASON_STYLE[r]
          return (
            <button key={r} onClick={() => setFilterReason(r)}
              style={{ padding: '5px 13px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: active ? (style?.color || N) : 'var(--surface-3)', color: active ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }}>
              {r}
            </button>
          )
        })}

        {/* Admin agent filter */}
        {isAdmin && activeAgents.length > 1 && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            <select
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
              style={{ padding: '5px 12px', borderRadius: 99, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--text-2)', outline: 'none', fontFamily: 'inherit' }}
            >
              <option value="All">All agents</option>
              {activeAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </>
        )}

        {/* Active filter count */}
        {filtered.length !== returns.length && (
          <span style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 4 }}>
            {filtered.length} of {returns.length} shown
          </span>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              {returns.length === 0 ? 'No returns logged yet' : 'No results match your filters'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
              {returns.length === 0 ? 'Use the form above to log your first return.' : 'Try clearing some filters.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                {['Name', 'Phone', 'Source', 'Reason', ...(isAdmin ? ['Agent'] : []), 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const reasonStyle = REASON_STYLE[r.reason] || { bg: '#f3f4f6', color: '#374151' }
                const sourceStyle = SOURCE_STYLE[r.source] || SOURCE_STYLE['Other']
                const agent       = getProfile(r.logged_by)
                const canAct      = r.logged_by === user.id || isAdmin

                return (
                  <tr key={r.id}
                    style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                      {r.name}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text-2)', fontFamily: 'monospace', letterSpacing: 0.3 }}>
                      {r.phone}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ background: sourceStyle.bg, color: sourceStyle.color, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {r.source}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ background: reasonStyle.bg, color: reasonStyle.color, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {r.reason}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#1e40af', flexShrink: 0 }}>
                            {agent.ini}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{agent.name}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {canAct && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => { setEditItem(r); setEditForm({ name: r.name, phone: r.phone, source: r.source, reason: r.reason }) }}
                            style={{ padding: '5px 12px', background: 'var(--surface-3)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--border-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-3)'}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDelete(r)}
                            style={{ padding: '5px 12px', background: 'var(--danger-light)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer', transition: 'all 0.15s' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit modal ── */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', marginBottom: 20 }}>Edit Return</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Name</div>
                <input style={INPUT} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Phone</div>
                <input style={INPUT} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Source</div>
                <select style={INPUT} value={editForm.source} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Reason</div>
                <select style={INPUT} value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditItem(null)} style={{ padding: '10px 20px', background: 'var(--surface-3)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEdit} disabled={!editForm.name?.trim() || !editForm.phone?.trim()} style={{ padding: '10px 20px', background: N, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this return?"
          message={`This will permanently remove ${confirmDelete.name} from lead returns.`}
          confirmLabel="Delete"
          danger
          onConfirm={deleteReturn}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
