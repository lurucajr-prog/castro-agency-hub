// ============================================================
// Castro Agency Hub — Sales (Protected Production Version)
// Place this file at: src/components/Sales.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { supabase }                    from '../lib/supabase'
import { N, R, Card, Btn, Field, Modal, Chip, Spinner, TabBar, EmptyState, IS, MiniBar, pct, pcol, ConfirmModal } from './shared'
import { launchConfetti, playFanfare } from '../utils/animations'
import { logAudit }                    from '../utils/db'
import { exportCSV }                   from '../utils/csv'

const MEDALS = ['🥇','🥈','🥉','4','5','6','7']

const ITEM_TYPES = [
  'Auto','Home','Life','Renters','Condo',
  'Home Bundle (Home + Auto)','Auto + Renters Bundle',
  'Auto + Condo Bundle','Landlord','Other',
]

const ITEMS_ADDED_TYPES = ['Vehicle','Driver','Property','Jewelry / Valuables','Other']

const LEAD_SOURCES  = ['BP','Allstate Lead Marketplace','Other']
const LEAD_STATUSES = ['New','Contacted','Quoted','Sold','Lost']
const LEAD_STATUS_COLORS = {
  'New':       { bg:'#f3f4f6', tx:'#374151' },
  'Contacted': { bg:'#dbeafe', tx:'#1e40af' },
  'Quoted':    { bg:'#fef9c3', tx:'#854d0e' },
  'Sold':      { bg:'#dcfce7', tx:'#166534' },
  'Lost':      { bg:'#fee2e2', tx:'#991b1b' },
}
const LEAD_SOURCE_COLORS = {
  'BP':                        { bg:'#ede9fe', tx:'#5b21b6' },
  'Allstate Lead Marketplace': { bg:'#dbeafe', tx:'#1e40af' },
  'Other':                     { bg:'#f3f4f6', tx:'#374151' },
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`
}

function getMonthOpts() {
  const opts = []
  const now  = new Date()
  for (let i = 0; i < 12; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`
    const label = d.toLocaleDateString('en-US', { month:'long', year:'numeric' })
    opts.push({ value, label })
  }
  return opts
}
const MONTH_OPTS = getMonthOpts()

function calcStreak(sales, uid) {
  const dates = new Set(sales.filter(s => s.uid === uid).map(s => new Date(s.created_at).toDateString()))
  let streak = 0; const d = new Date()
  if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (dates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

function fmt(n) { return Number(n || 0).toLocaleString() }

function SaleToast({ sale, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'var(--surface)', border:'2px solid #16a34a', borderRadius:16, padding:'18px 32px', zIndex:9998, textAlign:'center', boxShadow:'var(--shadow-lg)', animation:'toastIn 0.4s ease', minWidth:260 }}>
      <style>{`@keyframes toastIn{from{transform:translateX(-50%) translateY(-30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
      <div style={{ fontSize:40, marginBottom:8 }}>🎯</div>
      <div style={{ fontSize:17, fontWeight:700, color:'#166534', marginBottom:4 }}>Sale logged!</div>
      <div style={{ fontSize:13, color:'var(--text-2)' }}>{sale.client} · ${Number(sale.premium).toLocaleString()}</div>
    </div>
  )
}

function MyGoalCard({ sales, acts, goals, userId, weekSales, weekActs }) {
  const g        = goals[userId] || { policies:8, premium:10000, quotes:30, weekly_policies:2, weekly_premium:2500, weekly_quotes:8 }
  const myItems  = sales.reduce((s, x) => s + (x.items || 1), 0)
  const myPrem   = sales.reduce((s, x) => s + (x.premium || 0), 0)
  const myQuotes = Math.max(0, acts.filter(a => a.type === 'Quote').reduce((s, a) => s + a.count, 0))
  const wItems   = weekSales.reduce((s, x) => s + (x.items || 1), 0)
  const wPrem    = weekSales.reduce((s, x) => s + (x.premium || 0), 0)
  const wQuotes  = Math.max(0, weekActs.filter(a => a.type === 'Quote').reduce((s, a) => s + a.count, 0))

  const rows = [
    { label:'Items',   monthly:myItems,  weekly:wItems,  mGoal:g.policies||8,      wGoal:g.weekly_policies||2,    dollar:false },
    { label:'Premium', monthly:myPrem,   weekly:wPrem,   mGoal:g.premium||10000,   wGoal:g.weekly_premium||2500,  dollar:true  },
    { label:'Quotes',  monthly:myQuotes, weekly:wQuotes, mGoal:g.quotes||30,       wGoal:g.weekly_quotes||8,      dollar:false },
  ]

  return (
    <Card mb={14}>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', marginBottom:12 }}>My progress this month</div>
      {rows.map(r => {
        const p = r.mGoal > 0 ? Math.round(Math.min(100, r.monthly / r.mGoal * 100)) : 0
        return (
          <div key={r.label} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11 }}>
              <span style={{ color:'var(--text-2)', fontWeight:500 }}>{r.label}</span>
              <span style={{ color:pcol(r.monthly, r.mGoal) }}>
                {r.dollar ? '$' : ''}{fmt(r.monthly)} / {r.dollar ? '$' : ''}{fmt(r.mGoal)} goal · {p}%
              </span>
            </div>
            <div style={{ height:4, background:'var(--surface-3)', borderRadius:99, marginBottom:4 }}>
              <div style={{ width:p+'%', height:'100%', background:pcol(r.monthly, r.mGoal), borderRadius:99, transition:'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize:10, color:'var(--text-4)' }}>
              Week: {r.dollar ? '$' : ''}{fmt(r.weekly)} / {r.dollar ? '$' : ''}{fmt(r.wGoal)}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

export default function Sales({ user }) {
  const [tab,           setTab]          = useState('Leaderboard')
  const [sales,         setSales]        = useState([])
  const [allSales,      setAllSales]     = useState([])
  const [acts,          setActs]         = useState([])
  const [goals,         setGoals]        = useState({})
  const [leads,         setLeads]        = useState([])
  const [itemsAdded,    setItemsAdded]   = useState([])
  const [profiles,      setProfiles]     = useState([])
  const [loading,       setLoading]      = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey)

  const [editGoal,  setEditGoal]  = useState(null)
  const [gForm,     setGForm]     = useState({ monthly_items:'', monthly_premium:'', monthly_quotes:'', weekly_items:'', weekly_premium:'', weekly_quotes:'' })
  const [sForm,     setSForm]     = useState({ uid:'', client:'', pt:'Auto', premium:'', items:1 })
  const [iaForm,    setIaForm]    = useState({ uid:'', client:'', item_type:'Vehicle', notes:'' })
  const [lForm,     setLForm]     = useState({ name:'', phone:'', source:'BP', notes:'' })
  const [saving,    setSaving]    = useState(false)

  const [editingSale,   setEditingSale]   = useState(null)
  const [editSaleForm,  setEditSaleForm]  = useState({})
  const [savingEdit,    setSavingEdit]    = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  
  const [pendingLeadUpdate, setPendingLeadUpdate] = useState(null)

  const [leadFilter,       setLeadFilter]       = useState('All')
  const [leadSourceFilter, setLeadSourceFilter] = useState('All')
  const [leadExpanded,     setLeadExpanded]     = useState(null)

  const [saleToast,   setSaleToast]   = useState(null)
  const [showItemDef, setShowItemDef] = useState(false)

  const isAdmin = user.role === 'admin'
  const now     = new Date()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [selYear, selMonth] = selectedMonth.split('-').map(Number)
  const monthStart  = new Date(selYear, selMonth - 1, 1).toISOString()
  const monthEnd    = new Date(selYear, selMonth, 0, 23, 59, 59).toISOString()
  const isThisMonth = selectedMonth === currentMonthKey()
  const monthLabel  = new Date(selYear, selMonth - 1, 1).toLocaleDateString('en-US', { month:'long', year:'numeric' })

  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now); weekStart.setDate(diff); weekStart.setHours(0,0,0,0)
  const weekStartISO = weekStart.toISOString()

  useEffect(() => { const lbParticipants = profiles.filter(p => p.role === 'member' || (p.role === 'admin' && p.show_on_leaderboard)); if (lbParticipants.length > 0) { const def = isAdmin ? lbParticipants[0].id : user.id; setSForm(f => ({ ...f, uid:def })); setIaForm(f => ({ ...f, uid:def })) } }, [profiles])
  useEffect(() => { fetchStaticData() }, [])
  useEffect(() => { fetchMonthData()  }, [selectedMonth])

  async function fetchStaticData() {
    const [g, p, l] = await Promise.all([
      supabase.from('goals').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('lead_returns').select('*').order('created_at', { ascending:false }),
    ])
    const gMap = {}; (g.data || []).forEach(x => { gMap[x.uid] = x })
    setGoals(gMap)
    setProfiles(p.data || [])
    setLeads(l.data || [])
    setLoading(false)
  }

  async function fetchMonthData() {
    const [s, allS, a, ia] = await Promise.all([
      supabase.from('sales').select('*').gte('created_at', monthStart).lte('created_at', monthEnd).order('created_at', { ascending:false }),
      supabase.from('sales').select('uid, created_at, items').gte('created_at', thirtyDaysAgo),
      supabase.from('activities').select('*').gte('created_at', monthStart).lte('created_at', monthEnd).order('created_at', { ascending:false }),
      supabase.from('items_added').select('*').gte('created_at', monthStart).lte('created_at', monthEnd).order('created_at', { ascending:false }),
    ])
    setSales(s.data || [])
    setAllSales(allS.data || [])
    setActs(a.data || [])
    setItemsAdded(ia.data || [])
  }

  async function addSale() {
    if (!sForm.client.trim() || !sForm.premium) return
    setSaving(true)
    const uid       = isAdmin ? sForm.uid : user.id
    const itemCount = Math.max(1, Number(sForm.items) || 1)
    const { data, error } = await supabase.from('sales')
      .insert({ uid, client:sForm.client, policy_type:sForm.pt, premium:Number(sForm.premium), items:itemCount })
      .select().single()
    if (error) { console.error('[Sales] add error', error); setSaving(false); return }
    if (data) {
      setSales(ss => [data, ...ss])
      launchConfetti()
      playFanfare()
      setSaleToast({ client:sForm.client, premium:sForm.premium })
      await logAudit({ user, action:'INSERT', table:'sales', record_id:data.id, new_data:data })

      const agentProfile = profiles.find(p => p.id === uid)
      const agentName    = agentProfile?.name || user.name
      const notifPayload = profiles
        .filter(p => p.id !== user.id)
        .map(p => ({
          to_uid:     p.id,
          type:       'sale',
          title:      `${agentName} just closed a sale! 🎯`,
          body:       `${sForm.client} · ${sForm.pt} · $${Number(sForm.premium).toLocaleString()}`,
          nav_target: 'sales',
          read:       false,
        }))
      if (notifPayload.length > 0) {
        await supabase.from('notifications').insert(notifPayload)
      }
    }
    setSForm(f => ({ ...f, client:'', premium:'', items:1 }))
    setSaving(false)
  }

  function openEditSale(sale) {
    setEditingSale(sale)
    setEditSaleForm({ client:sale.client, pt:sale.policy_type, premium:sale.premium, items:sale.items || 1 })
  }

  async function saveEditSale() {
    if (!editSaleForm.client.trim() || !editSaleForm.premium) return
    setSavingEdit(true)
    const update = { client:editSaleForm.client, policy_type:editSaleForm.pt, premium:Number(editSaleForm.premium), items:Math.max(1, Number(editSaleForm.items) || 1) }
    const { error } = await supabase.from('sales').update(update).eq('id', editingSale.id)
    if (error) { console.error('[Sales] edit error', error); setSavingEdit(false); return }
    setSales(ss => ss.map(s => s.id === editingSale.id ? { ...s, ...update } : s))
    await logAudit({ user, action:'UPDATE', table:'sales', record_id:editingSale.id, old_data:editingSale, new_data:{ ...editingSale, ...update } })
    setEditingSale(null)
    setSavingEdit(false)
  }

  async function deleteSale(sale) {
    await supabase.from('sales').delete().eq('id', sale.id)
    setSales(ss => ss.filter(s => s.id !== sale.id))
    await logAudit({ user, action:'DELETE', table:'sales', record_id:sale.id, old_data:sale })
    setConfirmDelete(null)
  }

  async function addItemAdded() {
    if (!iaForm.client.trim()) return
    setSaving(true)
    const uid = isAdmin ? iaForm.uid : user.id
    const { data } = await supabase.from('items_added').insert({ uid, client:iaForm.client, item_type:iaForm.item_type, notes:iaForm.notes }).select().single()
    if (data) setItemsAdded(ii => [data, ...ii])
    setIaForm(f => ({ ...f, client:'', notes:'' }))
    setSaving(false)
  }

  async function addLead() {
    if (!lForm.name.trim() || !lForm.phone.trim()) return
    setSaving(true)
    const { data } = await supabase.from('lead_returns').insert({ ...lForm, logged_by:user.id, status:'New' }).select().single()
    if (data) setLeads(ls => [data, ...ls])
    setLForm({ name:'', phone:'', source:'BP', notes:'' })
    setSaving(false)
  }

  async function executeLeadStatusUpdate(id, nextStatus) {
    await supabase.from('lead_returns').update({ status: nextStatus }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status: nextStatus } : l))
    setPendingLeadUpdate(null)
  }

  async function updateLeadNotes(id, notes) {
    await supabase.from('lead_returns').update({ notes }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, notes } : l))
  }

  async function confirmLeadDelete(id) {
    await supabase.from('lead_returns').delete().eq('id', id)
    setLeads(ls => ls.filter(l => l.id !== id))
    setConfirmDelete(null)
  }

  async function saveGoal() {
    if (!editGoal) return
    const payload = {
      uid:             editGoal,
      policies:        Number(gForm.monthly_items),
      premium:         Number(gForm.monthly_premium),
      quotes:          Number(gForm.monthly_quotes),
      weekly_policies: Number(gForm.weekly_items),
      weekly_premium:  Number(gForm.weekly_premium),
      weekly_quotes:   Number(gForm.weekly_quotes),
    }
    const existing = goals[editGoal]
    if (existing?.id) await supabase.from('goals').update(payload).eq('id', existing.id)
    else await supabase.from('goals').insert(payload)
    setGoals(g => ({ ...g, [editGoal]:{ ...payload, id:existing?.id } }))
    setEditGoal(null)
  }

  function startEditGoal(uid) {
    const g = goals[uid] || { policies:8, premium:10000, quotes:30, weekly_policies:2, weekly_premium:2500, weekly_quotes:8 }
    setGForm({ monthly_items:g.policies||8, monthly_premium:g.premium||10000, monthly_quotes:g.quotes||30, weekly_items:g.weekly_policies||2, weekly_premium:g.weekly_premium||2500, weekly_quotes:g.weekly_quotes||8 })
    setEditGoal(uid)
  }

  function autoFillWeekly() {
    setGForm(f => ({
      ...f,
      weekly_items:   Math.ceil(Number(f.monthly_items)   / 4) || '',
      weekly_premium: Math.ceil(Number(f.monthly_premium) / 4) || '',
      weekly_quotes:  Math.ceil(Number(f.monthly_quotes)  / 4) || '',
    }))
  }

  if (loading) return <Spinner />

  const lbParticipants = profiles.filter(p => p.role === 'member' || (p.role === 'admin' && p.show_on_leaderboard))

  const lbData = lbParticipants.map(m => {
    const ms     = sales.filter(s => s.uid === m.id)
    const ma     = acts.filter(a => a.uid === m.id)
    const items  = ms.reduce((s, x) => s + (x.items || 1), 0)
    const prem   = ms.reduce((s, x) => s + (x.premium || 0), 0)
    const quotes = Math.max(0, ma.filter(a => a.type === 'Quote').reduce((s, a) => s + a.count, 0))
    const g      = goals[m.id] || { policies:8, premium:10000, quotes:30 }
    const streak = calcStreak(allSales, m.id)
    return { m, items, prem, quotes, g, streak }
  }).sort((a, b) => b.prem - a.prem)

  const weekSales = sales.filter(s => s.created_at >= weekStartISO)
  const weekActs  = acts.filter(a => a.created_at >= weekStartISO)

  const filteredLeads   = leads.filter(l => (leadFilter === 'All' || l.status === leadFilter) && (leadSourceFilter === 'All' || l.source === leadSourceFilter))
  const leadCounts      = {}; LEAD_STATUSES.forEach(s => { leadCounts[s]    = leads.filter(l => l.status === s).length })
  const leadSrcCounts   = {}; LEAD_SOURCES.forEach(s  => { leadSrcCounts[s] = leads.filter(l => l.source === s).length })

  const mySales     = sales.filter(s => s.uid === user.id)
  const myActs      = acts.filter(a => a.uid === user.id)
  const myWeekSales = weekSales.filter(s => s.uid === user.id)
  const myWeekActs  = weekActs.filter(a => a.uid === user.id)

  const tabs = ['Leaderboard', 'Log sale', 'Items added', 'Lead Returns', ...(isAdmin ? ['Goals'] : [])]

  return (
    <>
      <div style={{ padding:20 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:600, color:'var(--text-1)', marginBottom:2 }}>Sales tracker</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>{isThisMonth ? 'This month' : 'Viewing archive'} · {monthLabel}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {(isAdmin || sales.length > 0) && (
              <Btn sm variant="outline" onClick={() => {
                const rows = sales.map(s => { const agent = profiles.find(p => p.id === s.uid); return [new Date(s.created_at).toLocaleDateString('en-US'), agent?.name||'Unknown', s.client, s.policy_type, s.premium, s.items||1] })
                exportCSV(`sales-${selectedMonth}.csv`, ['Date','Agent','Client','Policy Type','Premium ($)','Items'], rows)
              }}>⬇ Export CSV</Btn>
            )}
            {!isThisMonth && (
              <button onClick={() => setSelectedMonth(currentMonthKey())} style={{ fontSize:11, color:N, background:'var(--primary-light)', border:`1px solid ${N}`, borderRadius:7, padding:'5px 11px', cursor:'pointer', fontWeight:500 }}>
                ← Back to current month
              </button>
            )}
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ ...IS, width:'auto', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>
              {MONTH_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <TabBar tabs={tabs} active={tab} setActive={setTab} />

        {/* ── TAB 1: LEADERBOARD ── */}
        {tab === 'Leaderboard' && (
          <>
            {!isAdmin && <MyGoalCard sales={mySales} acts={myActs} goals={goals} userId={user.id} weekSales={myWeekSales} weekActs={myWeekActs} />}
            <Card p={0}>
              {lbData.length === 0 ? <EmptyState text="No sales data for this month." icon="🏆" /> : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--surface-2)' }}>
                      {['Rank','Agent','Items','Premium','Quotes','Streak','Goal'].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lbData.map(({ m, items, prem, quotes, g, streak }, i) => {
                      const isMe   = m.id === user.id
                      const premPct = g.premium > 0 ? Math.round(Math.min(100, prem / g.premium * 100)) : 0
                      return (
                        <tr key={m.id} style={{ borderTop:'1px solid var(--border)', background: isMe ? 'var(--primary-light)' : 'transparent' }}>
                          <td style={{ padding:'9px 12px', fontSize:14 }}>{MEDALS[i] || (i+1)}</td>
                          <td style={{ padding:'9px 12px' }}>
                            <div style={{ fontSize:12, fontWeight:isMe?700:500, color:'var(--text-1)' }}>{m.name}{isMe && <span style={{ fontSize:9, color:N, marginLeft:5, fontWeight:700 }}>YOU</span>}</div>
                            <div style={{ fontSize:10, color:'var(--text-4)' }}>{m.title}</div>
                          </td>
                          <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{items}</td>
                          <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'#166534' }}>${prem.toLocaleString()}</td>
                          <td style={{ padding:'9px 12px', fontSize:12, color:'var(--text-3)' }}>{quotes}</td>
                          <td style={{ padding:'9px 12px', fontSize:12, color: streak>0?'#d97706':'var(--text-4)' }}>{streak > 0 ? `🔥 ${streak}d` : '—'}</td>
                          <td style={{ padding:'9px 12px', minWidth:100 }}>
                            <div style={{ fontSize:10, color:pcol(prem, g.premium), marginBottom:3 }}>{premPct}%</div>
                            <div style={{ height:3, background:'var(--surface-3)', borderRadius:99 }}>
                              <div style={{ width:premPct+'%', height:'100%', background:pcol(prem, g.premium), borderRadius:99, transition:'width 0.4s' }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}

        {/* ── TAB 2: LOG SALE ── */}
        {tab === 'Log sale' && (
          <Card>
            {isThisMonth && (
              <>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 }}>Log a new sale</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  {isAdmin && (
                    <Field label="Agent">
                      <select style={IS} value={sForm.uid} onChange={e => setSForm(f => ({ ...f, uid:e.target.value }))}>
                        {lbParticipants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Client name *"><input style={IS} value={sForm.client} onChange={e => setSForm(f => ({ ...f, client:e.target.value }))} placeholder="e.g. Smith, John" /></Field>
                  <Field label="Item type">
                    <select style={IS} value={sForm.pt} onChange={e => setSForm(f => ({ ...f, pt:e.target.value }))}>
                      {ITEM_TYPES.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Premium ($)"><input style={IS} type="number" value={sForm.premium} onChange={e => setSForm(f => ({ ...f, premium:e.target.value }))} placeholder="e.g. 1200" /></Field>
                  <Field label={<div style={{ display:'flex', alignItems:'center', gap:6 }}><span>Item count</span><button onClick={() => setShowItemDef(s => !s)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--text-3)', padding:0 }}>ℹ️</button></div>}><input style={IS} type="number" min="1" value={sForm.items} onChange={e => setSForm(f => ({ ...f, items:e.target.value }))} placeholder="1" /></Field>
                </div>
                {showItemDef && (
                  <div style={{ background:'var(--primary-light)', border:'1px solid var(--primary-mid)', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#1e40af', lineHeight:1.7 }}>
                    <div style={{ fontWeight:600, marginBottom:4 }}>How to count items:</div>
                    <div>• 1 car = <strong>1 item</strong> · • Auto with 2 cars = <strong>2 items</strong><br />• Home Bundle (Home + Auto, 2 cars) = <strong>3 items</strong></div>
                  </div>
                )}
                <Btn onClick={addSale} disabled={saving}>{saving ? 'Saving…' : '🎯 Log sale'}</Btn>
              </>
            )}
            {sales.length > 0 && (
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>{isThisMonth ? 'Recent sales' : `All sales — ${monthLabel}`}</div>
                {sales.map(s => {
                  const m = profiles.find(p => p.id === s.uid); const canEdit = isAdmin || s.uid === user.id
                  return (
                    <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{s.client}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{m?.name} · {new Date(s.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })} · {s.items||1} item{(s.items||1)!==1?'s':''}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Chip label={s.policy_type} />
                        <div style={{ fontSize:12, fontWeight:500, color:'#166534' }}>${(s.premium||0).toLocaleString()}</div>
                        {canEdit && (
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => openEditSale(s)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--text-4)', fontSize:13 }}>✏️</button>
                            <button onClick={() => setConfirmDelete(s)} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', fontSize:13 }}>🗑</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── TAB 3: ITEMS ADDED ── */}
        {tab === 'Items added' && (
          <div>
            <div style={{ background:'var(--primary-light)', border:'1px solid var(--primary-mid)', borderRadius:8, padding:'9px 13px', fontSize:12, color:'#1e40af', marginBottom:14 }}>Log items added to existing policies — like a new vehicle, driver, or property added to a current account.</div>
            {isThisMonth && (
              <Card mb={14}>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 }}>Log an item added</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {isAdmin && (
                    <Field label="Agent">
                      <select style={IS} value={iaForm.uid} onChange={e => setIaForm(f => ({ ...f, uid:e.target.value }))}>
                        {lbParticipants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Client name *"><input style={IS} value={iaForm.client} onChange={e => setIaForm(f => ({ ...f, client:e.target.value }))} placeholder="e.g. Smith, John" /></Field>
                  <Field label="What was added">
                    <select style={IS} value={iaForm.item_type} onChange={e => setIaForm(f => ({ ...f, item_type:e.target.value }))}>
                      {ITEMS_ADDED_TYPES.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Notes"><input style={IS} value={iaForm.notes} onChange={e => setIaForm(f => ({ ...f, notes:e.target.value }))} placeholder="Optional…" /></Field>
                </div>
                <Btn onClick={addItemAdded} disabled={saving}>{saving ? 'Saving…' : '+ Log item'}</Btn>
              </Card>
            )}
            <Card p={0}>
              {itemsAdded.length === 0 ? <EmptyState text={`No items logged for ${monthLabel}.`} icon="📋" /> : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--surface-2)' }}>
                      {['Client','Item added','Agent','Date','Notes'].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itemsAdded.map(item => {
                      const m = profiles.find(p => p.id === item.uid)
                      return (
                        <tr key={item.id} style={{ borderTop:'1px solid var(--border)' }}>
                          <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{item.client}</td>
                          <td style={{ padding:'9px 12px' }}><span style={{ background:'var(--primary-mid)', color:'#1e40af', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:500 }}>{item.item_type}</span></td>
                          <td style={{ padding:'9px 12px', fontSize:12, color:'var(--text-3)' }}>{m?.name}</td>
                          <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-4)' }}>{new Date(item.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</td>
                          <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)' }}>{item.notes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}

        {/* ── TAB 4: LEAD RETURNS ── */}
        {tab === 'Lead Returns' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 185px', gap:12 }}>
              <div>
                {isThisMonth && (
                  <Card mb={14}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 }}>Log a lead return</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <Field label="Name *"><input style={IS} value={lForm.name} onChange={e => setLForm(f => ({ ...f, name:e.target.value }))} placeholder="e.g. John Smith" /></Field>
                      <Field label="Phone *"><input style={IS} value={lForm.phone} onChange={e => setLForm(f => ({ ...f, phone:e.target.value }))} placeholder="e.g. 708-555-0123" /></Field>
                      <Field label="Source">
                        <select style={IS} value={lForm.source} onChange={e => setLForm(f => ({ ...f, source:e.target.value }))}>
                          {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="Notes"><input style={IS} value={lForm.notes} onChange={e => setLForm(f => ({ ...f, notes:e.target.value }))} placeholder="Optional context…" /></Field>
                    </div>
                    <Btn onClick={addLead} disabled={saving}>{saving ? 'Saving…' : '+ Log lead return'}</Btn>
                  </Card>
                )}
                <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap' }}>
                  {['All', ...LEAD_STATUSES].map(s => <button key={s} onClick={() => setLeadFilter(s)} style={{ padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer', fontSize:11, fontWeight:500, background:leadFilter===s?N:'var(--surface-3)', color:leadFilter===s?'#fff':'var(--text-3)' }}>{s}</button>)}
                </div>
                <div style={{ display:'flex', gap:5, marginBottom:10, flexWrap:'wrap' }}>
                  {['All', ...LEAD_SOURCES].map(s => { const sc = LEAD_SOURCE_COLORS[s]; const act = leadSourceFilter === s; return <button key={s} onClick={() => setLeadSourceFilter(s)} style={{ padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer', fontSize:10, fontWeight:500, background:act?(sc?.bg||N):'var(--surface-3)', color:act?(sc?.tx||'#fff'):'var(--text-3)' }}>{s}</button> })}
                </div>
                <Card p={0}>
                  {filteredLeads.length === 0 ? <EmptyState text="No lead returns match this filter." icon="↩" /> : (
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:'var(--surface-2)' }}>
                          {['Name','Phone','Source','Status','Logged','Notes',''].map(h => <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:.4 }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map(l => {
                          const sc = LEAD_STATUS_COLORS[l.status] || {}; const src = LEAD_SOURCE_COLORS[l.source] || {}; const isExp = leadExpanded === l.id
                          return [
                            <tr key={l.id} onClick={() => setLeadExpanded(isExp ? null : l.id)} style={{ borderTop:'1px solid var(--border)', cursor:'pointer' }}>
                              <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{l.name}</td>
                              <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)' }}>{l.phone}</td>
                              <td style={{ padding:'9px 12px' }}><span style={{ fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:99, background:src.bg||'#f3f4f6', color:src.tx||'#374151' }}>{l.source}</span></td>
                              <td style={{ padding:'9px 12px' }}>
                                <select value={l.status} onChange={e => { e.stopPropagation(); setPendingLeadUpdate({ id: l.id, target: e.target.value }) }} onClick={e => e.stopPropagation()} style={{ fontSize:11, fontWeight:500, padding:'2px 7px', borderRadius:99, border:'none', cursor:'pointer', background:sc.bg||'#f3f4f6', color:sc.tx||'#374151', outline:'none' }}>
                                  {LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}
                                </select>
                              </td>
                              <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-4)' }}>{new Date(l.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</td>
                              <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.notes || '—'}</td>
                              <td style={{ padding:'9px 12px', fontSize:10, color:'var(--text-4)' }}>{isExp ? '▲' : '▼'}</td>
                            </tr>,
                            isExp && (
                              <tr key={l.id+'x'} style={{ background:'var(--surface-2)', borderTop:'1px solid var(--border)' }}>
                                <td colSpan={7} style={{ padding:'10px 14px' }}>
                                  <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
                                    <Field label="Notes" mb={0} style={{ flex:1 }}><input style={{ ...IS, fontSize:12 }} defaultValue={l.notes || ''} onBlur={e => updateLeadNotes(l.id, e.target.value)} placeholder="Add notes…" onClick={e => e.stopPropagation()} /></Field>
                                    {isAdmin && <button onClick={e => { e.stopPropagation(); setConfirmDelete({ _type:'lead', id:l.id }) }} style={{ fontSize:11, color:'#ef4444', background:'none', border:'1px solid #fca5a5', borderRadius:6, padding:'5px 10px', cursor:'pointer' }}>🗑 Delete</button>}
                                  </div>
                                </td>
                              </tr>
                            ),
                          ].filter(Boolean)
                        })}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
              <div>
                <Card mb={10}>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>By status</div>
                  {LEAD_STATUSES.map(s => (
                    <div key={s} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:11, padding:'1px 6px', borderRadius:99, background:LEAD_STATUS_COLORS[s]?.bg, color:LEAD_STATUS_COLORS[s]?.tx, fontWeight:500 }}>{s}</span>
                      <span style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{leadCounts[s]||0}</span>
                    </div>
                  ))}
                </Card>
                <Card>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>By source</div>
                  {LEAD_SOURCES.map(s => (
                    <div key={s} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:11, color:'var(--text-3)' }}>{s}</span>
                      <span style={{ fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{leadSrcCounts[s]||0}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: GOALS ── */}
        {tab === 'Goals' && isAdmin && (
          <div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:14 }}>Set monthly and weekly targets for each agent. Click an agent row to edit.</div>
            <Card p={0}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--surface-2)' }}>
                    {['Agent','Mo. Items','Mo. Premium','Mo. Quotes','Wk. Items','Wk. Premium','Wk. Quotes',''].map(h => <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:.4 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const g = goals[m.id] || { policies:8, premium:10000, quotes:30, weekly_policies:2, weekly_premium:2500, weekly_quotes:8 }; const ms = sales.filter(s => s.uid === m.id); const ma = acts.filter(a => a.uid === m.id); const wSales = weekSales.filter(s => s.uid === m.id); const wActs = weekActs.filter(a => a.uid === m.id)
                    const mI = ms.reduce((s, x) => s + (x.items||1), 0); const mP = ms.reduce((s, x) => s + (x.premium||0), 0); const mQ = Math.max(0, ma.filter(a => a.type==='Quote').reduce((s, a) => s + a.count, 0))
                    const wI = wSales.reduce((s, x) => s + (x.items||1), 0); const wP = wSales.reduce((s, x) => s + (x.premium||0), 0); const wQ = Math.max(0, wActs.filter(a => a.type==='Quote').reduce((s, a) => s + a.count, 0))
                    return (
                      <tr key={m.id} style={{ borderTop:'1px solid var(--border)' }}>
                        <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{m.name}</td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:pcol(mI, g.policies||8) }}>{mI}/{g.policies||8}</td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:pcol(mP, g.premium||10000) }}>${mP.toLocaleString()}/{(g.premium||10000).toLocaleString()}</td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:pcol(mQ, g.quotes||30) }}>{mQ}/{g.quotes||30}</td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:pcol(wI, g.weekly_policies||2) }}>{wI}/{g.weekly_policies||2}</td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:pcol(wP, g.weekly_premium||2500) }}>${wP.toLocaleString()}/{(g.weekly_premium||2500).toLocaleString()}</td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:pcol(wQ, g.weekly_quotes||8) }}>{wQ}/{g.weekly_quotes||8}</td>
                        <td style={{ padding:'9px 12px' }}><button onClick={() => startEditGoal(m.id)} style={{ fontSize:11, color:N, background:'var(--primary-light)', border:`1px solid var(--primary-mid)`, borderRadius:6, padding:'3px 10px', cursor:'pointer' }}>Edit</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>

      {/* MODALS & PORTALS */}
      {editingSale && (
        <Modal title="Edit sale" onClose={() => setEditingSale(null)}>
          <Field label="Client name *"><input style={IS} value={editSaleForm.client} onChange={e => setEditSaleForm(f => ({ ...f, client:e.target.value }))} /></Field>
          <Field label="Item type"><select style={IS} value={editSaleForm.pt} onChange={e => setEditSaleForm(f => ({ ...f, pt:e.target.value }))}>{ITEM_TYPES.map(o => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Premium ($)"><input style={IS} type="number" value={editSaleForm.premium} onChange={e => setEditSaleForm(f => ({ ...f, premium:e.target.value }))} /></Field>
          <Field label="Item count"><input style={IS} type="number" min="1" value={editSaleForm.items} onChange={e => setEditSaleForm(f => ({ ...f, items:e.target.value }))} /></Field>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}><Btn variant="outline" onClick={() => setEditingSale(null)}>Cancel</Btn><Btn onClick={saveEditSale} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</Btn></div>
        </Modal>
      )}

      {editGoal && (
        <Modal title={`Edit goals — ${profiles.find(p => p.id === editGoal)?.name}`} onClose={() => setEditGoal(null)}>
          <Field label="Items sold"><input style={IS} type="number" value={gForm.monthly_items} onChange={e => setGForm(f => ({ ...f, monthly_items:e.target.value }))} /></Field>
          <Field label="Premium ($)"><input style={IS} type="number" value={gForm.monthly_premium} onChange={e => setGForm(f => ({ ...f, monthly_premium:e.target.value }))} /></Field>
          <Field label="Quotes"><input style={IS} type="number" value={gForm.monthly_quotes} onChange={e => setGForm(f => ({ ...f, monthly_quotes:e.target.value }))} /></Field>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}><Btn variant="outline" onClick={() => setEditGoal(null)}>Cancel</Btn><Btn onClick={saveGoal}>Save goals</Btn></div>
        </Modal>
      )}

      {pendingLeadUpdate && (
        <ConfirmModal
          title="Verify Pipeline Shift?"
          message={`Are you sure you want to transition this lead return record status over to "${pendingLeadUpdate.target}"?`}
          onConfirm={() => executeLeadStatusUpdate(pendingLeadUpdate.id, pendingLeadUpdate.target)}
          onCancel={() => setPendingLeadUpdate(null)}
        />
      )}

      {confirmDelete && !confirmDelete._type && (
        <ConfirmModal title="Delete this sale?" message={`This will permanently remove the sale for ${confirmDelete.client}.`} confirmLabel="Delete" danger onConfirm={() => deleteSale(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}

      {confirmDelete?._type === 'lead' && (
        <ConfirmModal title="Delete this lead return?" message="This will permanently remove the lead return record." confirmLabel="Delete" danger onConfirm={() => confirmLeadDelete(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />
      )}

      {saleToast && <SaleToast sale={saleToast} onDone={() => setSaleToast(null)} />}
    </>
  )
}
