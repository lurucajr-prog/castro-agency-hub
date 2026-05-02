import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Modal, Chip, Spinner, TabBar, EmptyState, IS, MiniBar, pct, pcol } from './shared'

const MEDALS = ['🥇','🥈','🥉','4','5','6','7']

export default function Sales({ user }) {
  const [tab, setTab] = useState('Leaderboard')
  const [sales, setSales] = useState([])
  const [acts, setActs] = useState([])
  const [goals, setGoals] = useState({})
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editGoal, setEditGoal] = useState(null)
  const [gForm, setGForm] = useState({ policies: '', calls: '', quotes: '', premium: '' })
  const [sForm, setSForm] = useState({ uid: '', client: '', pt: 'Auto', premium: '' })
  const [aForm, setAForm] = useState({ uid: '', type: 'Call', count: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const isAdmin = user.role === 'admin'
  const members = profiles.filter(p => p.role === 'member')

  // Current month filter
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
    const [s, a, g, p] = await Promise.all([
      supabase.from('sales').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('goals').select('*'),
      supabase.from('profiles').select('*'),
    ])
    setSales(s.data || [])
    setActs(a.data || [])
    const gMap = {}
    ;(g.data || []).forEach(x => { gMap[x.uid] = x })
    setGoals(gMap)
    setProfiles(p.data || [])
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

  async function saveGoal() {
    if (!editGoal) return
    const payload = { uid: editGoal, policies: Number(gForm.policies), calls: Number(gForm.calls), quotes: Number(gForm.quotes), premium: Number(gForm.premium) }
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
    setGForm({ policies: g.policies, calls: g.calls, quotes: g.quotes, premium: g.premium })
    setEditGoal(uid)
  }

  if (loading) return <Spinner />

  const lbData = members.map(m => {
    const ms = sales.filter(s => s.uid === m.id)
    const ma = acts.filter(a => a.uid === m.id)
    const pols = ms.length
    const prem = ms.reduce((s, x) => s + (x.premium || 0), 0)
    const calls = ma.filter(a => a.type === 'Call').reduce((s, a) => s + a.count, 0)
    const quotes = ma.filter(a => a.type === 'Quote').reduce((s, a) => s + a.count, 0)
    const g = goals[m.id] || { policies: 8, calls: 100, quotes: 30, premium: 10000 }
    return { m, pols, prem, calls, quotes, g }
  }).sort((a, b) => b.pols - a.pols)

  const tabs = isAdmin ? ['Leaderboard', 'Log sale', 'Log activity', 'Goals'] : ['Leaderboard', 'Log sale', 'Log activity']

  return (
    <>
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Sales tracker</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>This month · {monthLabel}</div>
        </div>

        <TabBar tabs={tabs} active={tab} setActive={setTab} />

        {tab === 'Leaderboard' && (
          <Card p={0}>
            {lbData.length === 0
              ? <EmptyState text="No data yet for this month." />
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['#', 'Agent', 'Policies', 'Premium', 'Calls', 'Quotes'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lbData.map(({ m, pols, prem, calls, quotes, g }, i) => (
                      <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '11px 12px', fontSize: 14 }}>{MEDALS[i]}</td>
                        <td style={{ padding: '11px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#1e40af' }}>{m.ini}</div>
                            <span style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 12px', minWidth: 90 }}><MiniBar val={pols} max={g.policies} /></td>
                        <td style={{ padding: '11px 12px', minWidth: 100 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: pcol(prem, g.premium), marginBottom: 1 }}>${prem.toLocaleString()}</div>
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

        {tab === 'Log sale' && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log a policy sale</div>
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
              <Field label="Policy type">
                <select style={IS} value={sForm.pt} onChange={e => setSForm(f => ({ ...f, pt: e.target.value }))}>
                  {['Auto', 'Home', 'Life', 'Other'].map(o => <option key={o}>{o}</option>)}
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

        {tab === 'Goals' && isAdmin && (
          <Card p={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Agent', 'Policies', 'Premium', 'Calls', 'Quotes', ''].map(h => (
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
          <Field label="Monthly policies target">
            <input style={IS} type="number" value={gForm.policies} onChange={e => setGForm(f => ({ ...f, policies: e.target.value }))} />
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
