import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Chip, Spinner, EmptyState, IS } from './shared'

const STATUSES = ['New Lead', 'Contacted', 'Quoted', 'Sold', 'Lost']

export default function Referrals() {
  const [refs, setRefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ referred_by: '', prospect: '', phone: '', status: 'New Lead' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchRefs() }, [])

  async function fetchRefs() {
    const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false })
    setRefs(data || [])
    setLoading(false)
  }

  async function addRef() {
    if (!form.referred_by.trim() || !form.prospect.trim()) return
    setSaving(true)
    const { data } = await supabase.from('referrals')
      .insert({ referred_by: form.referred_by, prospect: form.prospect, phone: form.phone, status: form.status })
      .select().single()
    if (data) setRefs(rs => [data, ...rs])
    setForm({ referred_by: '', prospect: '', phone: '', status: 'New Lead' })
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('referrals').update({ status }).eq('id', id)
    setRefs(rs => rs.map(r => r.id === id ? { ...r, status } : r))
  }

  if (loading) return <Spinner />

  const rc = {}
  refs.forEach(r => { rc[r.referred_by] = (rc[r.referred_by] || 0) + 1 })
  const top = Object.entries(rc).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const filtered = filter === 'All' ? refs : refs.filter(r => r.status === filter)

  const statCounts = {
    total: refs.length,
    sold: refs.filter(r => r.status === 'Sold').length,
    pipeline: refs.filter(r => ['New Lead', 'Contacted', 'Quoted'].includes(r.status)).length,
    lost: refs.filter(r => r.status === 'Lost').length,
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Referral tracker</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Log referrals quickly — even mid-call</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 175px', gap: 12 }}>
        <div>
          {/* Quick add */}
          <Card mb={12}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 11 }}>Quick add</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <Field label="Referred by *">
                <input style={IS} value={form.referred_by} onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))} placeholder="Client name" />
              </Field>
              <Field label="Prospect *">
                <input style={IS} value={form.prospect} onChange={e => setForm(f => ({ ...f, prospect: e.target.value }))} placeholder="Prospect name" />
              </Field>
              <Field label="Phone / email">
                <input style={IS} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
              </Field>
              <Field label="Status">
                <select style={IS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={addRef} disabled={saving}>{saving ? 'Saving…' : '+ Log referral'}</Btn>
            </div>
          </Card>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
            {['All', ...STATUSES].map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: '3px 11px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                background: filter === s ? N : '#f3f4f6',
                color: filter === s ? '#fff' : '#6b7280',
              }}>{s}</button>
            ))}
          </div>

          {/* Table */}
          <Card p={0}>
            {filtered.length === 0
              ? <EmptyState text="No referrals found." />
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Prospect', 'Referred by', 'Date', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.flatMap(r => {
                      const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      return [
                        <tr key={r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{r.prospect}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.referred_by}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{date}</td>
                          <td style={{ padding: '9px 12px' }}><Chip label={r.status} /></td>
                          <td style={{ padding: '9px 12px', fontSize: 10, color: '#9ca3af' }}>{expanded === r.id ? '▲' : '▼'}</td>
                        </tr>,
                        expanded === r.id && (
                          <tr key={r.id + 'x'} style={{ background: '#f9fafb' }}>
                            <td colSpan={5} style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Update status:</span>
                                {STATUSES.map(s => (
                                  <button key={s} onClick={() => updateStatus(r.id, s)} style={{
                                    padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11,
                                    border: `1px solid ${r.status === s ? N : '#d1d5db'}`,
                                    background: r.status === s ? N : 'transparent',
                                    color: r.status === s ? '#fff' : '#6b7280',
                                  }}>{s}</button>
                                ))}
                                {r.phone && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>📞 {r.phone}</span>}
                              </div>
                            </td>
                          </tr>
                        ),
                      ].filter(Boolean)
                    })}
                  </tbody>
                </table>
              )
            }
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card mb={10}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 10 }}>Top referrers</div>
            {top.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 8 }}>None yet.</div>}
            {top.map(([name, count], i) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < top.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 11 }}>{['🥇','🥈','🥉','4.','5.'][i]}</span>
                  <span style={{ fontSize: 11, color: '#111' }}>{name.split(',')[0]}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: N }}>{count}</span>
              </div>
            ))}
          </Card>
          <Card>
            {[
              { label: 'Total', val: statCounts.total },
              { label: 'Sold', val: statCounts.sold, c: '#166534' },
              { label: 'Pipeline', val: statCounts.pipeline, c: '#92400e' },
              { label: 'Lost', val: statCounts.lost, c: '#991b1b' },
            ].map((s, i, a) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < a.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: s.c || '#111' }}>{s.val}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
