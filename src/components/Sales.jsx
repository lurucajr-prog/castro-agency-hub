import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Modal, Chip, Spinner, TabBar, EmptyState, IS, MiniBar, pct, pcol } from './shared'

const MEDALS = ['🥇','🥈','🥉','4','5','6','7']

const LEAD_SOURCES = ['BP', 'Allstate Lead Marketplace', 'Other']
const LEAD_STATUSES = ['New', 'Contacted', 'Quoted', 'Sold', 'Lost']
const LEAD_STATUS_COLORS = {
  'New':       { bg: '#f3f4f6', tx: '#374151' },
  'Contacted': { bg: '#dbeafe', tx: '#1e40af' },
  'Quoted':    { bg: '#fef9c3', tx: '#854d0e' },
  'Sold':      { bg: '#dcfce7', tx: '#166534' },
  'Lost':      { bg: '#fee2e2', tx: '#991b1b' },
}
const LEAD_SOURCE_COLORS = {
  'BP':                      { bg: '#ede9fe', tx: '#5b21b6' },
  'Allstate Lead Marketplace':{ bg: '#dbeafe', tx: '#1e40af' },
  'Other':                   { bg: '#f3f4f6', tx: '#374151' },
}

export default function Sales({ user }) {
  const [tab, setTab] = useState('Leaderboard')
  const [sales, setSales] = useState([])
  const [acts, setActs] = useState([])
  const [goals, setGoals] = useState({})
  const [leads, setLeads] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editGoal, setEditGoal] = useState(null)
  const [gForm, setGForm] = useState({ items: '', calls: '', quotes: '', premium: '' })
  const [sForm, setSForm] = useState({ uid: '', client: '', pt: 'Auto', premium: '' })
  const [aForm, setAForm] = useState({ uid: '', type: 'Call', count: '', notes: '' })
  const [lForm, setLForm] = useState({ name: '', phone: '', source: 'BP', notes: '' })
  const [saving, setSaving] = useState(false)
  const [leadFilter, setLeadFilter] = useState('All')
  const [leadSourceFilter, setLeadSourceFilter] = useState('All')
  const [leadExpanded, setLeadExpanded] = useState(null)

  const isAdmin = user.role === 'admin'
  const members = profiles.filter(p => p.role === 'member')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    if (members.length > 0) {
      const defaultUid = isAdmin ? members[0].id : user.id
      setSForm(f => ({ ...f, uid: defaultUid }))
      setAForm(f => ({ ...f, uid: defaultUid }))
    }
  }, [profiles])

  async function fetchAll() {
    const [s, a, g, p, l] = await Promise.all([
      supabase.from('sales').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('goals').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('lead_returns').select('*').order('created_at', { ascending: false }),
    ])
    setSales(s.data || [])
    setActs(a.data || [])
    const gMap = {}
    ;(g.data || []).forEach(x => { gMap[x.uid] = x })
    setGoals(gMap)
    setProfiles(p.data || [])
    setLeads(l.data || [])
    setLoading(false)
  }

  async function addSale() {
    if (!sForm.client.trim() || !sForm.premium) return
    setSaving(true)
    const { data } = await supabase.from('sales')
      .insert({ uid: sForm.uid, client: sForm.client, policy_type: sForm.pt, premium: Number(sForm.premium) })
      .select().single()
    if (data) setSales(ss => [data, ...ss])
    setSForm(f => ({ ...f, client: '', premium: '' }))
    setSaving(false)
  }

  async function addActivity() {
    if (!aForm.count) return
    setSaving(true)
    const { data } = await supabase.from('activities')
      .insert({ uid: aForm.uid, type: aForm.type, count: Number(aForm.count), notes: aForm.notes })
      .select().single()
    if (data) setActs(aa => [data, ...aa])
    setAForm(f => ({ ...f, count: '', notes: '' }))
    setSaving(false)
  }

  async function addLead() {
    if (!lForm.name.trim() || !lForm.phone.trim()) return
    setSaving(true)
    const { data } = await supabase.from('lead_returns')
      .insert({ ...lForm, logged_by: user.id, status: 'New' })
      .select().single()
    if (data) setLeads(ls => [data, ...ls])
    setLForm({ name: '', phone: '', source: 'BP', notes: '' })
    setSaving(false)
  }

  async function updateLeadStatus(id, status) {
    await supabase.from('lead_returns').update({ status }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l))
  }

  async function updateLeadNotes(id, notes) {
    await supabase.from('lead_returns').update({ notes }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, notes } : l))
  }

  async function deleteLead(id) {
    if (!window.confirm('Delete this lead return?')) return
    await supabase.from('lead_returns').delete().eq('id', id)
    setLeads(ls => ls.filter(l => l.id !== id))
  }

  async function saveGoal() {
    if (!editGoal) return
    const payload = { uid: editGoal, policies: Number(gForm.items), calls: Number(gForm.calls), quotes: Number(gForm.quotes), premium: Number(gForm.premium) }
    const existing = goals[editGoal]
    if (existing?.id) {
      await supabase.from('goals').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('goals').insert(payload)
    }
    setGoals(g => ({ ...g, [editGoal]: { ...payload, id: existing?.id } }))
    setEditGoal(null)
  }

  function startEditGoal(uid) {
    const g = goals[uid] || { policies: 8, calls: 100, quotes: 30, premium: 10000 }
    setGForm({ items: g.policies, calls: g.calls, quotes: g.quotes, premium: g.premium })
    setEditGoal(uid)
  }

  if (loading) return <Spinner />

  // ── Leaderboard — sorted by PREMIUM ──────────────────────────
  const lbData = members.map(m => {
    const ms = sales.filter(s => s.uid === m.id)
    const ma = acts.filter(a => a.uid === m.id)
    const items = ms.length
    const prem = ms.reduce((s, x) => s + (x.premium || 0), 0)
    const calls = ma.filter(a => a.type === 'Call').reduce((s, a) => s + a.count, 0)
    const quotes = ma.filter(a => a.type === 'Quote').reduce((s, a) => s + a.count, 0)
    const g = goals[m.id] || { policies: 8, calls: 100, quotes: 30, premium: 10000 }
    return { m, items, prem, calls, quotes, g }
  }).sort((a, b) => b.prem - a.prem) // ← sorted by premium

  // ── Lead returns filters ──────────────────────────────────────
  const filteredLeads = leads
    .filter(l => leadFilter === 'All' || l.status === leadFilter)
    .filter(l => leadSourceFilter === 'All' || l.source === leadSourceFilter)

  const leadCounts = {}
  LEAD_STATUSES.forEach(s => { leadCounts[s] = leads.filter(l => l.status === s).length })
  const leadSrcCounts = {}
  LEAD_SOURCES.forEach(s => { leadSrcCounts[s] = leads.filter(l => l.source === s).length })

  const tabs = isAdmin
    ? ['Leaderboard', 'Log sale', 'Log activity', 'Lead Returns', 'Goals']
    : ['Leaderboard', 'Log sale', 'Log activity', 'Lead Returns']

  return (
    <>
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Sales tracker</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>This month · {monthLabel}</div>
        </div>

        <TabBar tabs={tabs} active={tab} setActive={setTab} />

        {/* ── LEADERBOARD ── */}
        {tab === 'Leaderboard' && (
          <Card p={0}>
            {lbData.length === 0
              ? <EmptyState text="No data yet for this month." />
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['#', 'Agent', 'Items sold', 'Premium', 'Calls', 'Quotes'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lbData.map(({ m, items, prem, calls, quotes, g }, i) => (
                      <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '11px 12px', fontSize: 14 }}>{MEDALS[i]}</td>
                        <td style={{ padding: '11px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#1e40af' }}>{m.ini}</div>
                            <span style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 12px', minWidth: 90 }}><MiniBar val={items} max={g.policies} /></td>
                        <td style={{ padding: '11px 12px', minWidth: 110 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: pcol(prem, g.premium), marginBottom: 1 }}>${prem.toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>{pct(prem, g.premium)}% of ${g.premium.toLocaleString()}</div>
                        </td>
                        <td style={{ padding: '11px 12px', minWidth: 85 }}><MiniBar val={calls} max={g.calls} /></td>
                        <td style={{ padding: '11px 12px', minWidth: 85 }}><MiniBar val={quotes} max={g.quotes} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </Card>
        )}

        {/* ── LOG SALE ── */}
        {tab === 'Log sale' && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log a sale</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {isAdmin && (
                <Field label="Agent">
                  <select style={IS} value={sForm.uid} onChange={e => setSForm(f => ({ ...f, uid: e.target.value }))}>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Client name *">
                <input style={IS} value={sForm.client} onChange={e => setSForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Smith, John" />
              </Field>
              <Field label="Item type">
                <select style={IS} value={sForm.pt} onChange={e => setSForm(f => ({ ...f, pt: e.target.value }))}>
                  {['Auto', 'Home', 'Life', 'Renters', 'Other'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Annual premium ($)">
                <input style={IS} type="number" value={sForm.premium} onChange={e => setSForm(f => ({ ...f, premium: e.target.value }))} placeholder="e.g. 1200" />
              </Field>
            </div>
            <Btn onClick={addSale} disabled={saving}>{saving ? 'Saving…' : 'Log sale'}</Btn>
            {sales.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Recent</div>
                {sales.slice(0, 6).map(s => {
                  const m = profiles.find(p => p.id === s.uid)
                  return (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{s.client}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{m?.name} · {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Chip label={s.policy_type} />
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#166534', marginTop: 2 }}>${(s.premium || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── LOG ACTIVITY ── */}
        {tab === 'Log activity' && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log daily activity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {isAdmin && (
                <Field label="Agent">
                  <select style={IS} value={aForm.uid} onChange={e => setAForm(f => ({ ...f, uid: e.target.value }))}>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Activity type">
                <select style={IS} value={aForm.type} onChange={e => setAForm(f => ({ ...f, type: e.target.value }))}>
                  {['Call', 'Quote', 'Email', 'Meeting'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Count *">
                <input style={IS} type="number" value={aForm.count} onChange={e => setAForm(f => ({ ...f, count: e.target.value }))} placeholder="e.g. 15" />
              </Field>
              <Field label="Notes">
                <input style={IS} value={aForm.notes} onChange={e => setAForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </Field>
            </div>
            <Btn onClick={addActivity} disabled={saving}>{saving ? 'Saving…' : 'Log activity'}</Btn>
            {acts.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Recent</div>
                {acts.slice(0, 6).map(a => {
                  const m = profiles.find(p => p.id === a.uid)
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{m?.name} — {a.type}s</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{a.notes || new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 600, color: N }}>{a.count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── LEAD RETURNS ── */}
        {tab === 'Lead Returns' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 185px', gap: 12 }}>
              <div>
                {/* Log form */}
                <Card mb={14}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log a lead return</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Name *">
                      <input style={IS} value={lForm.name} onChange={e => setLForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Smith" />
                    </Field>
                    <Field label="Phone *">
                      <input style={IS} value={lForm.phone} onChange={e => setLForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 708-555-0123" />
                    </Field>
                    <Field label="Source">
                      <select style={IS} value={lForm.source} onChange={e => setLForm(f => ({ ...f, source: e.target.value }))}>
                        {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Notes">
                      <input style={IS} value={lForm.notes} onChange={e => setLForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional context…" />
                    </Field>
                  </div>
                  <Btn onClick={addLead} disabled={saving}>{saving ? 'Saving…' : '+ Log lead return'}</Btn>
                </Card>

                {/* Status filters */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Status:</span>
                  {['All', ...LEAD_STATUSES].map(s => (
                    <button key={s} onClick={() => setLeadFilter(s)} style={{
                      padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                      background: leadFilter === s ? N : '#f3f4f6',
                      color: leadFilter === s ? '#fff' : '#6b7280',
                    }}>{s}</button>
                  ))}
                </div>

                {/* Source filters */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Source:</span>
                  {['All', ...LEAD_SOURCES].map(s => (
                    <button key={s} onClick={() => setLeadSourceFilter(s)} style={{
                      padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                      background: leadSourceFilter === s ? '#374151' : '#f3f4f6',
                      color: leadSourceFilter === s ? '#fff' : '#6b7280',
                    }}>{s}</button>
                  ))}
                </div>

                {/* Leads table */}
                <Card p={0}>
                  {filteredLeads.length === 0
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
                          {filteredLeads.flatMap(l => {
                            const sc = LEAD_STATUS_COLORS[l.status] || LEAD_STATUS_COLORS['New']
                            const src = LEAD_SOURCE_COLORS[l.source] || LEAD_SOURCE_COLORS['Other']
                            const isExp = leadExpanded === l.id
                            return [
                              <tr key={l.id} onClick={() => setLeadExpanded(isExp ? null : l.id)} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}>
                                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{l.name}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280' }}>{l.phone}</td>
                                <td style={{ padding: '9px 12px' }}>
                                  <span style={{ background: src.bg, color: src.tx, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{l.source}</span>
                                </td>
                                <td style={{ padding: '9px 12px', fontSize: 11, color: '#9ca3af' }}>
                                  {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </td>
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
                                          {LEAD_STATUSES.map(s => {
                                            const c = LEAD_STATUS_COLORS[s]
                                            return (
                                              <button key={s} onClick={e => { e.stopPropagation(); updateLeadStatus(l.id, s) }} style={{
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
                                          onBlur={e => updateLeadNotes(l.id, e.target.value)}
                                          placeholder="Add notes…"
                                          style={{ ...IS, fontSize: 12 }}
                                          onClick={e => e.stopPropagation()}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                        <button onClick={e => { e.stopPropagation(); deleteLead(l.id) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: '4px 0' }}>🗑 Delete</button>
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
                    ...LEAD_STATUSES.map(s => ({ label: s, val: leadCounts[s] || 0, c: LEAD_STATUS_COLORS[s]?.tx }))
                  ].map((s, i, a) => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < a.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: s.c || '#111' }}>{s.val}</span>
                    </div>
                  ))}
                </Card>

                <Card>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 10 }}>By source</div>
                  {LEAD_SOURCES.map((s, i) => {
                    const src = LEAD_SOURCE_COLORS[s]
                    return (
                      <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < LEAD_SOURCES.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{s}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: src.tx }}>{leadSrcCounts[s] || 0}</span>
                      </div>
                    )
                  })}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── GOALS ── */}
        {tab === 'Goals' && isAdmin && (
          <Card p={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Agent', 'Items sold', 'Premium', 'Calls', 'Quotes', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const g = goals[m.id] || { policies: 8, calls: 100, quotes: 30, premium: 10000 }
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{m.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{g.policies}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>${(g.premium || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{g.calls}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{g.quotes}</td>
                      <td style={{ padding: '10px 12px' }}><Btn sm variant="outline" onClick={() => startEditGoal(m.id)}>Edit</Btn></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {editGoal && (
        <Modal title={`Edit goals — ${profiles.find(p => p.id === editGoal)?.name}`} onClose={() => setEditGoal(null)}>
          <Field label="Monthly items sold target">
            <input style={IS} type="number" value={gForm.items} onChange={e => setGForm(f => ({ ...f, items: e.target.value }))} />
          </Field>
          <Field label="Monthly premium target ($)">
            <input style={IS} type="number" value={gForm.premium} onChange={e => setGForm(f => ({ ...f, premium: e.target.value }))} />
          </Field>
          <Field label="Monthly calls target">
            <input style={IS} type="number" value={gForm.calls} onChange={e => setGForm(f => ({ ...f, calls: e.target.value }))} />
          </Field>
          <Field label="Monthly quotes target">
            <input style={IS} type="number" value={gForm.quotes} onChange={e => setGForm(f => ({ ...f, quotes: e.target.value }))} />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => setEditGoal(null)}>Cancel</Btn>
            <Btn onClick={saveGoal}>Save goals</Btn>
          </div>
        </Modal>
      )}
    </>
  )
}
