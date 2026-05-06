import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Spinner, EmptyState, IS } from './shared'

const SOURCES = ['BP', 'Allstate Lead Marketplace', 'Other']
const STATUSES = ['New', 'Contacted', 'Quoted', 'Sold', 'Lost']
const STATUS_COLORS = {
  'New':       { bg: '#f3f4f6', tx: '#374151' },
  'Contacted': { bg: '#dbeafe', tx: '#1e40af' },
  'Quoted':    { bg: '#fef9c3', tx: '#854d0e' },
  'Sold':      { bg: '#dcfce7', tx: '#166534' },
  'Lost':      { bg: '#fee2e2', tx: '#991b1b' },
}

export default function LeadReturns({ user }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', source: 'BP', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    const { data } = await supabase
      .from('lead_returns')
      .select('*')
      .order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  async function addLead() {
    if (!form.name.trim() || !form.phone.trim()) return
    setSaving(true)
    const { data } = await supabase.from('lead_returns')
      .insert({ ...form, logged_by: user.id, status: 'New' })
      .select().single()
    if (data) setLeads(ls => [data, ...ls])
    setForm({ name: '', phone: '', source: 'BP', notes: '' })
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('lead_returns').update({ status }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l))
  }

  async function updateNotes(id, notes) {
    await supabase.from('lead_returns').update({ notes }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, notes } : l))
  }

  async function deleteLead(id) {
    if (!window.confirm('Delete this lead return?')) return
    await supabase.from('lead_returns').delete().eq('id', id)
    setLeads(ls => ls.filter(l => l.id !== id))
  }

  if (loading) return <Spinner />

  const filtered = leads
    .filter(l => filter === 'All' || l.status === filter)
    .filter(l => sourceFilter === 'All' || l.source === sourceFilter)

  const counts = {}
  STATUSES.forEach(s => { counts[s] = leads.filter(l => l.status === s).length })
  const srcCounts = {}
  SOURCES.forEach(s => { srcCounts[s] = leads.filter(l => l.source === s).length })

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Lead returns</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{leads.length} total · {counts['Sold'] || 0} sold</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 190px', gap: 12 }}>
        <div>
          {/* Log form */}
          <Card mb={14}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log a lead return</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Name *">
                <input style={IS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Smith" />
              </Field>
              <Field label="Phone *">
                <input style={IS} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 708-555-0123" />
              </Field>
              <Field label="Source">
                <select style={IS} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <input style={IS} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional context…" />
              </Field>
            </div>
            <Btn onClick={addLead} disabled={saving}>{saving ? 'Saving…' : '+ Log lead return'}</Btn>
          </Card>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>Status:</span>
              {['All', ...STATUSES].map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{
                  padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  background: filter === s ? N : '#f3f4f6',
                  color: filter === s ? '#fff' : '#6b7280',
                }}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>Source:</span>
            {['All', ...SOURCES].map(s => (
              <button key={s} onClick={() => setSourceFilter(s)} style={{
                padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                background: sourceFilter === s ? '#374151' : '#f3f4f6',
                color: sourceFilter === s ? '#fff' : '#6b7280',
              }}>{s}</button>
            ))}
          </div>

          {/* Table */}
          <Card p={0}>
            {filtered.length === 0
              ? <EmptyState text={leads.length === 0 ? 'No lead returns logged yet.' : 'No records match this filter.'} />
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Name', 'Phone', 'Source', 'Date', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.flatMap(l => {
                      const sc = STATUS_COLORS[l.status] || STATUS_COLORS['New']
                      const isExp = expanded === l.id
                      return [
                        <tr key={l.id} onClick={() => setExpanded(isExp ? null : l.id)} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{l.name}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280' }}>{l.phone}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
                              background: l.source === 'BP' ? '#ede9fe' : l.source === 'Allstate Lead Marketplace' ? '#dbeafe' : '#f3f4f6',
                              color: l.source === 'BP' ? '#5b21b6' : l.source === 'Allstate Lead Marketplace' ? '#1e40af' : '#374151',
                            }}>{l.source}</span>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#9ca3af' }}>{new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ background: sc.bg, color: sc.tx, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{l.status}</span>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 10, color: '#9ca3af' }}>{isExp ? '▲' : '▼'}</td>
                        </tr>,
                        isExp && (
                          <tr key={l.id + 'x'} style={{ background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                            <td colSpan={6} style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' }}>Update status</div>
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {STATUSES.map(s => {
                                      const c = STATUS_COLORS[s]
                                      return (
                                        <button key={s} onClick={() => updateStatus(l.id, s)} style={{
                                          padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                                          border: `1px solid ${l.status === s ? c.tx : '#e5e7eb'}`,
                                          background: l.status === s ? c.bg : '#fff',
                                          color: l.status === s ? c.tx : '#6b7280',
                                        }}>{s}</button>
                                      )
                                    })}
                                  </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 180 }}>
                                  <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' }}>Notes</div>
                                  <input
                                    defaultValue={l.notes || ''}
                                    onBlur={e => updateNotes(l.id, e.target.value)}
                                    placeholder="Add notes…"
                                    style={{ ...IS, fontSize: 12 }}
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                  <button onClick={() => deleteLead(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: '4px 0' }}>🗑 Delete</button>
                                </div>
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

        {/* Stats sidebar */}
        <div>
          <Card mb={10}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 10 }}>By status</div>
            {[
              { label: 'Total', val: leads.length },
              { label: 'New', val: counts['New'] || 0, c: '#374151' },
              { label: 'Contacted', val: counts['Contacted'] || 0, c: '#1e40af' },
              { label: 'Quoted', val: counts['Quoted'] || 0, c: '#92400e' },
              { label: 'Sold', val: counts['Sold'] || 0, c: '#166534' },
              { label: 'Lost', val: counts['Lost'] || 0, c: '#991b1b' },
            ].map((s, i, a) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < a.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: s.c || '#111' }}>{s.val}</span>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 10 }}>By source</div>
            {SOURCES.map((s, i) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < SOURCES.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{s}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: N }}>{srcCounts[s] || 0}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
