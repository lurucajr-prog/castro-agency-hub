import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Field, Modal, Chip, Spinner, TabBar, EmptyState, IS, MiniBar, pct, pcol } from './shared'

const MEDALS = ['🥇','🥈','🥉','4','5','6','7']

const ITEM_TYPES = ['Auto', 'Home', 'Life', 'Renters', 'Home Bundle', 'Auto Bundle (Condo or Renters)', 'Landlord', 'Other']
const ITEMS_ADDED_TYPES = ['Vehicle', 'Driver', 'Property', 'Jewelry / Valuables', 'Other']
const SERVICE_TEAM = ['Evelyn', 'Tania']

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
  'BP':                       { bg: '#ede9fe', tx: '#5b21b6' },
  'Allstate Lead Marketplace': { bg: '#dbeafe', tx: '#1e40af' },
  'Other':                    { bg: '#f3f4f6', tx: '#374151' },
}

// ── Confetti ──────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const colors = ['#C8102E','#1B3A6B','#FFD700','#16a34a','#f97316','#8b5cf6','#ec4899','#06b6d4']
  const particles = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 80,
    w: Math.random() * 13 + 5, h: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 5 + 2,
    angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 10,
    drift: (Math.random() - 0.5) * 3,
    opacity: 1,
  }))
  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.y += p.speed; p.x += p.drift; p.angle += p.spin
      if (frame > 140) p.opacity = Math.max(0, p.opacity - 0.015)
      ctx.save(); ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180)
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    })
    frame++
    if (frame < 220) requestAnimationFrame(animate)
    else if (canvas.parentNode) document.body.removeChild(canvas)
  }
  animate()
}

// ── Fanfare sound (Web Audio API — no copyright) ──────────────
function playFanfare() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [
      { freq: 523, start: 0,    dur: 0.18 },
      { freq: 659, start: 0.14, dur: 0.18 },
      { freq: 784, start: 0.28, dur: 0.18 },
      { freq: 1047,start: 0.42, dur: 0.35 },
      { freq: 880, start: 0.50, dur: 0.18 },
      { freq: 1047,start: 0.62, dur: 0.5  },
    ]
    notes.forEach(n => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = n.freq
      osc.type = 'sine'
      const t = ctx.currentTime + n.start
      gain.gain.setValueAtTime(0.25, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur)
      osc.start(t); osc.stop(t + n.dur + 0.05)
    })
  } catch(e) { /* audio not supported */ }
}

// ── Sale toast ────────────────────────────────────────────────
function SaleToast({ client, premium, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#fff', border: '2px solid #16a34a', borderRadius: 16,
      padding: '18px 32px', zIndex: 9998, textAlign: 'center',
      boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'toastIn 0.4s ease',
      minWidth: 260,
    }}>
      <style>{`@keyframes toastIn{from{transform:translateX(-50%) translateY(-30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Sale logged!</div>
      <div style={{ fontSize: 13, color: '#374151' }}>{client} · <strong style={{ color: '#166534' }}>${Number(premium).toLocaleString()}</strong></div>
    </div>
  )
}

export default function Sales({ user }) {
  const [tab, setTab] = useState('Leaderboard')
  const [sales, setSales] = useState([])
  const [acts, setActs] = useState([])
  const [goals, setGoals] = useState({})
  const [leads, setLeads] = useState([])
  const [itemsAdded, setItemsAdded] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editGoal, setEditGoal] = useState(null)
  const [gForm, setGForm] = useState({ monthly_items: '', monthly_premium: '', monthly_quotes: '', weekly_items: '', weekly_premium: '', weekly_quotes: '' })
  const [sForm, setSForm] = useState({ uid: '', client: '', pt: 'Auto', premium: '' })
  const [aForm, setAForm] = useState({ uid: '', type: 'Quote', count: '', notes: '' })
  const [iaForm, setIaForm] = useState({ uid: '', client: '', item_type: 'Vehicle', notes: '' })
  const [lForm, setLForm] = useState({ name: '', phone: '', source: 'BP', notes: '' })
  const [saving, setSaving] = useState(false)
  const [leadFilter, setLeadFilter] = useState('All')
  const [leadSourceFilter, setLeadSourceFilter] = useState('All')
  const [leadExpanded, setLeadExpanded] = useState(null)
  const [saleToast, setSaleToast] = useState(null)

  const isAdmin = user.role === 'admin'
  const members = profiles.filter(p => p.role === 'member')
  const isServiceTeam = SERVICE_TEAM.includes(user.name)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  // Start of current week (Monday)
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now.setDate(diff))
  weekStart.setHours(0, 0, 0, 0)
  const weekStartISO = weekStart.toISOString()
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    if (members.length > 0) {
      const defaultUid = isAdmin ? members[0].id : user.id
      setSForm(f => ({ ...f, uid: defaultUid }))
      setAForm(f => ({ ...f, uid: defaultUid }))
      setIaForm(f => ({ ...f, uid: isServiceTeam ? user.id : defaultUid }))
    }
  }, [profiles])

  async function fetchAll() {
    const [s, a, g, p, l, ia] = await Promise.all([
      supabase.from('sales').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('goals').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('lead_returns').select('*').order('created_at', { ascending: false }),
      supabase.from('items_added').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
    ])
    setSales(s.data || [])
    setActs(a.data || [])
    const gMap = {}
    ;(g.data || []).forEach(x => { gMap[x.uid] = x })
    setGoals(gMap)
    setProfiles(p.data || [])
    setLeads(l.data || [])
    setItemsAdded(ia.data || [])
    setLoading(false)
  }

  async function addSale() {
    if (!sForm.client.trim() || !sForm.premium) return
    setSaving(true)
    const uid = isAdmin ? sForm.uid : user.id
    const { data } = await supabase.from('sales')
      .insert({ uid, client: sForm.client, policy_type: sForm.pt, premium: Number(sForm.premium) })
      .select().single()
    if (data) {
      setSales(ss => [data, ...ss])
      launchConfetti()
      playFanfare()
      setSaleToast({ client: sForm.client, premium: sForm.premium })
    }
    setSForm(f => ({ ...f, client: '', premium: '' }))
    setSaving(false)
  }

  async function addActivity() {
    if (!aForm.count) return
    setSaving(true)
    const uid = isAdmin ? aForm.uid : user.id
    const { data } = await supabase.from('activities')
      .insert({ uid, type: aForm.type, count: Number(aForm.count), notes: aForm.notes })
      .select().single()
    if (data) setActs(aa => [data, ...aa])
    setAForm(f => ({ ...f, count: '', notes: '' }))
    setSaving(false)
  }

  async function addItemAdded() {
    if (!iaForm.client.trim()) return
    setSaving(true)
    const uid = isAdmin ? iaForm.uid : user.id
    const { data } = await supabase.from('items_added')
      .insert({ uid, client: iaForm.client, item_type: iaForm.item_type, notes: iaForm.notes })
      .select().single()
    if (data) setItemsAdded(ii => [data, ...ii])
    setIaForm(f => ({ ...f, client: '', notes: '' }))
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
    const payload = {
      uid: editGoal,
      policies: Number(gForm.monthly_items),
      premium: Number(gForm.monthly_premium),
      quotes: Number(gForm.monthly_quotes),
      weekly_policies: Number(gForm.weekly_items),
      weekly_premium: Number(gForm.weekly_premium),
      weekly_quotes: Number(gForm.weekly_quotes),
    }
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
    const g = goals[uid] || { policies: 8, premium: 10000, quotes: 30, weekly_policies: 2, weekly_premium: 2500, weekly_quotes: 8 }
    setGForm({
      monthly_items: g.policies, monthly_premium: g.premium, monthly_quotes: g.quotes,
      weekly_items: g.weekly_policies || 2, weekly_premium: g.weekly_premium || 2500, weekly_quotes: g.weekly_quotes || 8,
    })
    setEditGoal(uid)
  }

  if (loading) return <Spinner />

  // Leaderboard sorted by premium
  const lbData = members.map(m => {
    const ms = sales.filter(s => s.uid === m.id)
    const ma = acts.filter(a => a.uid === m.id)
    const items = ms.length
    const prem = ms.reduce((s, x) => s + (x.premium || 0), 0)
    const quotes = Math.max(0, ma.filter(a => a.type === 'Quote').reduce((s, a) => s + a.count, 0))
    const g = goals[m.id] || { policies: 8, premium: 10000, quotes: 30 }
    return { m, items, prem, quotes, g }
  }).sort((a, b) => b.prem - a.prem)

  // Weekly data
  const weekSales = sales.filter(s => s.created_at >= weekStartISO)
  const weekActs = acts.filter(a => a.created_at >= weekStartISO)

  // Lead returns filters
  const filteredLeads = leads
    .filter(l => leadFilter === 'All' || l.status === leadFilter)
    .filter(l => leadSourceFilter === 'All' || l.source === leadSourceFilter)
  const leadCounts = {}
  LEAD_STATUSES.forEach(s => { leadCounts[s] = leads.filter(l => l.status === s).length })
  const leadSrcCounts = {}
  LEAD_SOURCES.forEach(s => { leadSrcCounts[s] = leads.filter(l => l.source === s).length })

  const tabs = isAdmin
    ? ['Leaderboard', 'Log sale', 'Log activity', 'Items added', 'Lead Returns', 'Goals']
    : ['Leaderboard', 'Log sale', 'Log activity', 'Items added', 'Lead Returns']

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
            {lbData.length === 0 ? <EmptyState text="No data yet for this month." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['#', 'Agent', 'Items sold', 'Premium', 'Quotes'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lbData.map(({ m, items, prem, quotes, g }, i) => (
                    <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '11px 12px', fontSize: 14 }}>{MEDALS[i]}</td>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#1e40af' }}>{m.ini}</div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{m.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 12px', minWidth: 90 }}><MiniBar val={items} max={g.policies || 8} /></td>
                      <td style={{ padding: '11px 12px', minWidth: 110 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: pcol(prem, g.premium || 10000), marginBottom: 1 }}>${prem.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{pct(prem, g.premium || 10000)}% of ${(g.premium || 10000).toLocaleString()}</div>
                      </td>
                      <td style={{ padding: '11px 12px', minWidth: 85 }}><MiniBar val={Math.max(0, quotes)} max={g.quotes || 30} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                  {ITEM_TYPES.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Premium ($)">
                <input style={IS} type="number" value={sForm.premium} onChange={e => setSForm(f => ({ ...f, premium: e.target.value }))} placeholder="e.g. 1200" />
              </Field>
            </div>
            <Btn onClick={addSale} disabled={saving}>{saving ? 'Saving…' : '🎯 Log sale'}</Btn>
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
                  {['Quote', 'Meeting'].map(o => <option key={o}>{o}</option>)}
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

        {/* ── ITEMS ADDED ── */}
        {tab === 'Items added' && (
          <div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#1e40af', marginBottom: 14 }}>
              Use this tab to log items added to existing policies — like adding a car, driver, or property to a current client's account.
            </div>
            <Card mb={14}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log an item added</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {isAdmin && (
                  <Field label="Agent">
                    <select style={IS} value={iaForm.uid} onChange={e => setIaForm(f => ({ ...f, uid: e.target.value }))}>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Client name *">
                  <input style={IS} value={iaForm.client} onChange={e => setIaForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Smith, John" />
                </Field>
                <Field label="What was added">
                  <select style={IS} value={iaForm.item_type} onChange={e => setIaForm(f => ({ ...f, item_type: e.target.value }))}>
                    {ITEMS_ADDED_TYPES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Notes">
                  <input style={IS} value={iaForm.notes} onChange={e => setIaForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional details…" />
                </Field>
              </div>
              <Btn onClick={addItemAdded} disabled={saving}>{saving ? 'Saving…' : '+ Log item'}</Btn>
            </Card>

            <Card p={0}>
              {itemsAdded.length === 0
                ? <EmptyState text="No items logged yet this month." />
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Client', 'Item added', 'Agent', 'Date', 'Notes'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itemsAdded.map(item => {
                        const m = profiles.find(p => p.id === item.uid)
                        return (
                          <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{item.client}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{item.item_type}</span>
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280' }}>{m?.name}</td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: '#9ca3af' }}>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{item.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              }
            </Card>
          </div>
        )}

        {/* ── LEAD RETURNS ── */}
        {tab === 'Lead Returns' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 185px', gap: 12 }}>
              <div>
                <Card mb={14}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log a lead return</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Name *"><input style={IS} value={lForm.name} onChange={e => setLForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Smith" /></Field>
                    <Field label="Phone *"><input style={IS} value={lForm.phone} onChange={e => setLForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 708-555-0123" /></Field>
                    <Field label="Source">
                      <select style={IS} value={lForm.source} onChange={e => setLForm(f => ({ ...f, source: e.target.value }))}>
                        {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Notes"><input style={IS} value={lForm.notes} onChange={e => setLForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional…" /></Field>
                  </div>
                  <Btn onClick={addLead} disabled={saving}>{saving ? 'Saving…' : '+ Log lead return'}</Btn>
                </Card>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Status:</span>
                  {['All', ...LEAD_STATUSES].map(s => (
                    <button key={s} onClick={() => setLeadFilter(s)} style={{ padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, background: leadFilter === s ? N : '#f3f4f6', color: leadFilter === s ? '#fff' : '#6b7280' }}>{s}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Source:</span>
                  {['All', ...LEAD_SOURCES].map(s => (
                    <button key={s} onClick={() => setLeadSourceFilter(s)} style={{ padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, background: leadSourceFilter === s ? '#374151' : '#f3f4f6', color: leadSourceFilter === s ? '#fff' : '#6b7280' }}>{s}</button>
                  ))}
                </div>
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
                                <td style={{ padding: '9px 12px' }}><span style={{ background: src.bg, color: src.tx, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{l.source}</span></td>
                                <td style={{ padding: '9px 12px', fontSize: 11, color: '#9ca3af' }}>{new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                <td style={{ padding: '9px 12px' }}><span style={{ background: sc.bg, color: sc.tx, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{l.status}</span></td>
                                <td style={{ padding: '9px 12px', fontSize: 10, color: '#9ca3af' }}>{isExp ? '▲' : '▼'}</td>
                              </tr>,
                              isExp && (
                                <tr key={l.id + 'x'} style={{ background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                                  <td colSpan={6} style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                      <div>
                                        <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' }}>Update status</div>
                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                          {LEAD_STATUSES.map(s => { const c = LEAD_STATUS_COLORS[s]; return (
                                            <button key={s} onClick={e => { e.stopPropagation(); updateLeadStatus(l.id, s) }} style={{ padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11, fontWeight: 500, border: `1px solid ${l.status === s ? c.tx : '#e5e7eb'}`, background: l.status === s ? c.bg : '#fff', color: l.status === s ? c.tx : '#6b7280' }}>{s}</button>
                                          )})}
                                        </div>
                                      </div>
                                      <div style={{ flex: 1, minWidth: 180 }}>
                                        <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' }}>Notes</div>
                                        <input defaultValue={l.notes || ''} onBlur={e => updateLeadNotes(l.id, e.target.value)} placeholder="Add notes…" style={{ ...IS, fontSize: 12 }} onClick={e => e.stopPropagation()} />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                        <button onClick={e => { e.stopPropagation(); deleteLead(l.id) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12 }}>🗑 Delete</button>
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
              <div>
                <Card mb={10}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 10 }}>By status</div>
                  {[{ label: 'Total', val: leads.length }, ...LEAD_STATUSES.map(s => ({ label: s, val: leadCounts[s] || 0, c: LEAD_STATUS_COLORS[s]?.tx }))].map((s, i, a) => (
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
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Monthly */}
              <Card p={0}>
                <div style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 12, fontWeight: 500, color: '#111' }}>Monthly goals</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Agent', 'Items', 'Premium', 'Quotes', ''].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => {
                      const g = goals[m.id] || { policies: 8, premium: 10000, quotes: 30 }
                      return (
                        <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{m.name}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280' }}>{g.policies}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280' }}>${(g.premium || 0).toLocaleString()}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280' }}>{g.quotes}</td>
                          <td style={{ padding: '9px 12px' }}><Btn sm variant="outline" onClick={() => startEditGoal(m.id)}>Edit</Btn></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
              {/* Weekly */}
              <Card p={0}>
                <div style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 12, fontWeight: 500, color: '#111' }}>Weekly goals</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Agent', 'Items', 'Premium', 'Quotes'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => {
                      const g = goals[m.id] || { weekly_policies: 2, weekly_premium: 2500, weekly_quotes: 8 }
                      const ws = weekSales.filter(s => s.uid === m.id)
                      const wPrem = ws.reduce((s, x) => s + (x.premium || 0), 0)
                      const wQ = Math.max(0, weekActs.filter(a => a.uid === m.id && a.type === 'Quote').reduce((s, a) => s + a.count, 0))
                      return (
                        <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{m.name}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: pcol(ws.length, g.weekly_policies || 2) }}>{ws.length}/{g.weekly_policies || 2}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: pcol(wPrem, g.weekly_premium || 2500) }}>${wPrem.toLocaleString()}/${(g.weekly_premium || 2500).toLocaleString()}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: pcol(wQ, g.weekly_quotes || 8) }}>{wQ}/{g.weekly_quotes || 8}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit goal modal */}
      {editGoal && (
        <Modal title={`Edit goals — ${profiles.find(p => p.id === editGoal)?.name}`} onClose={() => setEditGoal(null)}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 10, padding: '6px 10px', background: '#f9fafb', borderRadius: 6 }}>Monthly targets</div>
          <Field label="Items sold target"><input style={IS} type="number" value={gForm.monthly_items} onChange={e => setGForm(f => ({ ...f, monthly_items: e.target.value }))} /></Field>
          <Field label="Premium target ($)"><input style={IS} type="number" value={gForm.monthly_premium} onChange={e => setGForm(f => ({ ...f, monthly_premium: e.target.value }))} /></Field>
          <Field label="Quotes target"><input style={IS} type="number" value={gForm.monthly_quotes} onChange={e => setGForm(f => ({ ...f, monthly_quotes: e.target.value }))} /></Field>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', margin: '12px 0 10px', padding: '6px 10px', background: '#f9fafb', borderRadius: 6 }}>Weekly targets</div>
          <Field label="Items sold target"><input style={IS} type="number" value={gForm.weekly_items} onChange={e => setGForm(f => ({ ...f, weekly_items: e.target.value }))} /></Field>
          <Field label="Premium target ($)"><input style={IS} type="number" value={gForm.weekly_premium} onChange={e => setGForm(f => ({ ...f, weekly_premium: e.target.value }))} /></Field>
          <Field label="Quotes target"><input style={IS} type="number" value={gForm.weekly_quotes} onChange={e => setGForm(f => ({ ...f, weekly_quotes: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => setEditGoal(null)}>Cancel</Btn>
            <Btn onClick={saveGoal}>Save goals</Btn>
          </div>
        </Modal>
      )}

      {saleToast && <SaleToast client={saleToast.client} premium={saleToast.premium} onDone={() => setSaleToast(null)} />}
    </>
  )
}
