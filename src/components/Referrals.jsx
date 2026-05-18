// ============================================================
// Castro Agency Hub — Referrals
// Place this file at: src/components/Referrals.jsx
// Batch 1: added referrer thank-you log per referral
// ============================================================
import { useState, useEffect } from 'react'
import { supabase }             from '../lib/supabase'
import { N, Card, Btn, Field, Chip, Modal, Spinner, EmptyState, IS, ConfirmModal } from './shared'
import { launchConfetti }        from '../utils/animations'
import { exportCSV }             from '../utils/csv'

const STATUSES = ['New Lead', 'Contacted', 'Quoted', 'Sold', 'Not Interested']

const TY_SCRIPT = (referredBy, prospect) =>
  `Hi ${referredBy}! I just wanted to reach out and say thank you for referring ${prospect} to us. Your support truly means everything to our team — we really appreciate you spreading the word. If there is ever anything we can do for you, please don't hesitate to reach out!`

function ReferralSoldToast({ prospect, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'var(--surface)', border:'2px solid #16a34a', borderRadius:16, padding:'18px 32px', zIndex:9998, textAlign:'center', boxShadow:'var(--shadow-lg)', animation:'toastIn 0.4s ease', minWidth:260 }}>
      <div style={{ fontSize:40, marginBottom:8 }}>🤝</div>
      <div style={{ fontSize:17, fontWeight:700, color:'#166534', marginBottom:4 }}>Referral closed!</div>
      <div style={{ fontSize:13, color:'var(--text-2)' }}>{prospect} — marked as Sold</div>
    </div>
  )
}

function FollowUpBadge({ date }) {
  if (!date) return null
  const today     = new Date().toISOString().split('T')[0]
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const isOverdue  = date < today
  const isToday    = date === today
  const isTomorrow = date === tomorrow
  let bg, tx, label
  if (isOverdue)       { bg='var(--danger-light)';  tx='#991b1b';  label='⚠ Overdue' }
  else if (isToday)    { bg='var(--warning-light)'; tx='#92400e';  label='📅 Today' }
  else if (isTomorrow) { bg='var(--warning-light)'; tx='#92400e';  label='📅 Tomorrow' }
  else                 { bg='var(--surface-3)';     tx='var(--text-3)'; label='📅 ' + new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' }) }
  return <span style={{ fontSize:10, fontWeight:500, background:bg, color:tx, padding:'2px 7px', borderRadius:99 }}>{label}</span>
}

export default function Referrals({ user }) {
  const [refs,         setRefs]         = useState([])
  const [profiles,     setProfiles]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('All')
  const [expanded,     setExpanded]     = useState(null)
  const [form,         setForm]         = useState({ referred_by:'', prospect:'', phone:'', status:'New Lead', notes:'', follow_up_date:'', assigned_to:'', assigned_to_name:'' })
  const [saving,       setSaving]       = useState(false)
  const [soldToast,    setSoldToast]    = useState(null)
  const [confirmDelete,setConfirmDelete]= useState(null)

  // Inline edit states for expanded row
  const [editNotes,    setEditNotes]    = useState({})
  const [editFollowUp, setEditFollowUp] = useState({})
  const [editAssigned, setEditAssigned] = useState({})

  // Thank-you modal state
  const [tyModal,   setTyModal]   = useState(null)  // referral object
  const [tyCopied,  setTyCopied]  = useState(false)
  const [tySending, setTySending] = useState(false)

  const isAdmin = user.role === 'admin'
  const members = profiles.filter(p => p.role === 'member' || p.role === 'admin')
  const today   = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [refsRes, profilesRes] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    const data = refsRes.data || []
    setRefs(data)
    setProfiles(profilesRes.data || [])
    setLoading(false)
    await checkFollowUpReminders(data)
  }

  async function checkFollowUpReminders(allRefs) {
    const due = allRefs.filter(r =>
      r.follow_up_date === today &&
      r.follow_up_notified !== today &&
      !['Sold','Not Interested'].includes(r.status)
    )
    for (const ref of due) {
      const targetUid = ref.assigned_to || (isAdmin ? user.id : null)
      if (targetUid === user.id) {
        await supabase.from('notifications').insert({
          to_uid: user.id, type:'task',
          title: `Follow-up due: ${ref.prospect}`,
          body:  `Referred by ${ref.referred_by} · Status: ${ref.status}`,
          nav_target:'referrals',
        })
      }
      await supabase.from('referrals').update({ follow_up_notified: today }).eq('id', ref.id)
      setRefs(rs => rs.map(r => r.id === ref.id ? { ...r, follow_up_notified: today } : r))
    }
  }

  async function addRef() {
    if (!form.referred_by.trim() || !form.prospect.trim()) return
    setSaving(true)
    const assignedProfile = members.find(m => m.id === form.assigned_to)
    const { data, error } = await supabase.from('referrals').insert({
      referred_by:      form.referred_by,
      prospect:         form.prospect,
      phone:            form.phone || null,
      status:           form.status,
      notes:            form.notes || null,
      follow_up_date:   form.follow_up_date || null,
      assigned_to:      form.assigned_to || null,
      assigned_to_name: assignedProfile?.name || null,
    }).select().single()
    if (error) { console.error('[Referrals] add error', error); setSaving(false); return }
    if (data) setRefs(rs => [data, ...rs])
    setForm({ referred_by:'', prospect:'', phone:'', status:'New Lead', notes:'', follow_up_date:'', assigned_to:'', assigned_to_name:'' })
    setSaving(false)
  }

  async function updateStatus(id, status, prospectName) {
    const { error } = await supabase.from('referrals').update({ status }).eq('id', id)
    if (error) { console.error('[Referrals] status error', error); return }
    setRefs(rs => rs.map(r => r.id === id ? { ...r, status } : r))
    if (status === 'Sold') { launchConfetti(); setSoldToast(prospectName) }
  }

  async function saveNotes(id) {
    const notes = editNotes[id] ?? refs.find(r => r.id === id)?.notes ?? ''
    await supabase.from('referrals').update({ notes }).eq('id', id)
    setRefs(rs => rs.map(r => r.id === id ? { ...r, notes } : r))
  }

  async function saveFollowUp(id) {
    const follow_up_date = editFollowUp[id] ?? ''
    await supabase.from('referrals').update({ follow_up_date: follow_up_date || null, follow_up_notified: null }).eq('id', id)
    setRefs(rs => rs.map(r => r.id === id ? { ...r, follow_up_date: follow_up_date || null, follow_up_notified: null } : r))
  }

  async function saveAssignment(id) {
    const assignment       = editAssigned[id]
    const assigned_to      = assignment?.uid  || null
    const assigned_to_name = assignment?.name || null
    await supabase.from('referrals').update({ assigned_to, assigned_to_name }).eq('id', id)
    setRefs(rs => rs.map(r => r.id === id ? { ...r, assigned_to, assigned_to_name } : r))
  }

  async function deleteRef(ref) {
    const { error } = await supabase.from('referrals').delete().eq('id', ref.id)
    if (error) { console.error('[Referrals] delete error', error); return }
    setRefs(rs => rs.filter(r => r.id !== ref.id))
    setConfirmDelete(null)
    if (expanded === ref.id) setExpanded(null)
  }

  async function markTySent(ref) {
    setTySending(true)
    const now = new Date().toISOString()
    await supabase.from('referrals').update({ thank_you_sent_at: now }).eq('id', ref.id)
    setRefs(rs => rs.map(r => r.id === ref.id ? { ...r, thank_you_sent_at: now } : r))
    setTySending(false)
    setTyModal(null)
  }

  function copyScript(ref) {
    const script = TY_SCRIPT(ref.referred_by, ref.prospect)
    navigator.clipboard.writeText(script).catch(() => {})
    setTyCopied(true)
    setTimeout(() => setTyCopied(false), 2000)
  }

  if (loading) return <Spinner />

  const total      = refs.length
  const sold       = refs.filter(r => r.status === 'Sold').length
  const pipeline   = refs.filter(r => ['New Lead','Contacted','Quoted'].includes(r.status)).length
  const notInt     = refs.filter(r => r.status === 'Not Interested').length
  const conversion = total > 0 ? Math.round(sold / total * 100) : 0
  const followUpDue = refs.filter(r => r.follow_up_date && r.follow_up_date <= today && !['Sold','Not Interested'].includes(r.status)).length

  const rc = {}
  refs.forEach(r => { rc[r.referred_by] = (rc[r.referred_by] || 0) + 1 })
  const top = Object.entries(rc).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const filtered = filter === 'All' ? refs : refs.filter(r => r.status === filter)

  const STATUS_COLORS = {
    'New Lead':      { bg:'#f3f4f6', tx:'#374151' },
    'Contacted':     { bg:'#dbeafe', tx:'#1e40af' },
    'Quoted':        { bg:'#fef9c3', tx:'#854d0e' },
    'Sold':          { bg:'#dcfce7', tx:'#166534' },
    'Not Interested':{ bg:'#fee2e2', tx:'#991b1b' },
  }

  return (
    <>
      <div style={{ padding:20 }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:18, fontWeight:600, color:'var(--text-1)', marginBottom:2 }}>Referral tracker</div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>Log referrals quickly — even mid-call</div>
            </div>
            {refs.length > 0 && (
              <Btn sm variant="outline" onClick={() => {
                const rows = refs.map(r => [
                  new Date(r.created_at).toLocaleDateString('en-US'),
                  r.referred_by, r.prospect, r.phone || '', r.status,
                  r.assigned_to_name || '', r.follow_up_date || '',
                  r.thank_you_sent_at ? 'Yes' : 'No', r.notes || '',
                ])
                exportCSV('referrals.csv', ['Date','Referred By','Prospect','Phone','Status','Assigned To','Follow-up Date','Thank-You Sent','Notes'], rows)
              }}>
                ⬇ Export CSV
              </Btn>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:12 }}>
            {[
              { label:'Total', val:total, c:'var(--text-1)' },
              { label:'In Pipeline', val:pipeline, c:'#1e40af' },
              { label:'Sold', val:sold, c:'#166534' },
              { label:'Conversion', val:conversion+'%', c:N },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:'var(--text-4)', fontWeight:500, textTransform:'uppercase', letterSpacing:0.4, marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:600, color:s.c }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 190px', gap:12 }}>
          <div>
            {/* Quick add form */}
            <Card mb={12}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:11 }}>Quick add</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                <Field label="Referred by *">
                  <input style={IS} value={form.referred_by} onChange={e => setForm(f => ({ ...f, referred_by:e.target.value }))} placeholder="Client name" />
                </Field>
                <Field label="Prospect *">
                  <input style={IS} value={form.prospect} onChange={e => setForm(f => ({ ...f, prospect:e.target.value }))} placeholder="Prospect name" />
                </Field>
                <Field label="Phone / email">
                  <input style={IS} value={form.phone} onChange={e => setForm(f => ({ ...f, phone:e.target.value }))} placeholder="Optional" />
                </Field>
                <Field label="Status">
                  <select style={IS} value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>
                    {STATUSES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Assign to">
                  <select style={IS} value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to:e.target.value }))}>
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
                <Field label="Follow-up date">
                  <input style={IS} type="date" value={form.follow_up_date} min={today} onChange={e => setForm(f => ({ ...f, follow_up_date:e.target.value }))} />
                </Field>
                <Field label="Notes" style={{ gridColumn:'1 / -1' }}>
                  <input style={IS} value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} placeholder="Optional context…" />
                </Field>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
                <Btn onClick={addRef} disabled={saving}>{saving ? 'Saving…' : '+ Log referral'}</Btn>
              </div>
            </Card>

            {/* Follow-up due banner */}
            {followUpDue > 0 && (
              <div style={{ background:'var(--warning-light)', border:'1px solid #fcd34d', borderRadius:8, padding:'9px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:14 }}>📅</span>
                <span style={{ fontSize:12, fontWeight:500, color:'#92400e' }}>
                  {followUpDue} referral{followUpDue !== 1 ? 's' : ''} {followUpDue === 1 ? 'is' : 'are'} due for follow-up today or overdue.
                </span>
              </div>
            )}

            {/* Filter chips */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {['All', ...STATUSES].map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  style={{ padding:'3px 11px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${filter===s ? N : 'var(--border)'}`, background: filter===s ? N : 'var(--surface)', color: filter===s ? '#fff' : 'var(--text-2)' }}>
                  {s} {s !== 'All' ? `(${refs.filter(r => r.status === s).length})` : ''}
                </button>
              ))}
            </div>

            {/* Referrals table */}
            <Card p={0}>
              {filtered.length === 0 ? <EmptyState text="No referrals here yet." icon="↗" /> : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--surface-2)' }}>
                      {['Referred by','Prospect','Phone','Status','Assigned','Follow-up','Thank-you',''].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.flatMap(r => {
                      const isExp = expanded === r.id
                      const sc    = STATUS_COLORS[r.status] || STATUS_COLORS['New Lead']
                      return [
                        <tr key={r.id}
                          onClick={() => setExpanded(isExp ? null : r.id)}
                          style={{ borderTop:'1px solid var(--border)', cursor:'pointer', background: isExp ? 'var(--primary-light)' : 'var(--surface)' }}
                          onMouseEnter={e => { if (!isExp) e.currentTarget.style.background='var(--surface-2)' }}
                          onMouseLeave={e => { if (!isExp) e.currentTarget.style.background='var(--surface)' }}>
                          <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>{r.referred_by}</td>
                          <td style={{ padding:'9px 12px', fontSize:12, color:'var(--text-2)' }}>{r.prospect}</td>
                          <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)' }}>{r.phone || '—'}</td>
                          <td style={{ padding:'9px 12px' }}>
                            <span style={{ background:sc.bg, color:sc.tx, padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:500 }}>{r.status}</span>
                          </td>
                          <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)' }}>{r.assigned_to_name || '—'}</td>
                          <td style={{ padding:'9px 12px' }}><FollowUpBadge date={r.follow_up_date} /></td>
                          <td style={{ padding:'9px 12px' }}>
                            {r.thank_you_sent_at
                              ? <span style={{ fontSize:10, fontWeight:600, color:'var(--success)', background:'var(--success-light)', padding:'2px 7px', borderRadius:99 }}>✓ Sent</span>
                              : <span style={{ fontSize:10, color:'var(--text-4)' }}>—</span>
                            }
                          </td>
                          <td style={{ padding:'9px 12px', fontSize:10, color:'var(--text-4)', textAlign:'center' }}>{isExp ? '▲' : '▼'}</td>
                        </tr>,

                        isExp && (
                          <tr key={r.id + 'x'} style={{ background:'var(--primary-light)', borderTop:'1px solid var(--border)' }}>
                            <td colSpan={8} style={{ padding:'14px 16px' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                                {/* Status buttons */}
                                <div>
                                  <div style={{ fontSize:10, fontWeight:500, color:'var(--text-4)', marginBottom:6, textTransform:'uppercase' }}>Update status</div>
                                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                                    {STATUSES.map(s => {
                                      const c = STATUS_COLORS[s]
                                      return (
                                        <button key={s} onClick={() => updateStatus(r.id, s, r.prospect)}
                                          style={{ padding:'3px 9px', borderRadius:99, cursor:'pointer', fontSize:11, fontWeight:500, border:`1px solid ${r.status===s ? c.tx : 'var(--border)'}`, background: r.status===s ? c.bg : 'var(--surface)', color: r.status===s ? c.tx : 'var(--text-3)' }}>
                                          {s}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>

                                {/* Notes */}
                                <div>
                                  <Field label="Notes">
                                    <input style={IS} defaultValue={r.notes || ''} onChange={e => setEditNotes(n => ({ ...n, [r.id]: e.target.value }))} onBlur={() => saveNotes(r.id)} placeholder="Add notes…" />
                                  </Field>
                                </div>

                                {/* Follow-up + assignment */}
                                <div>
                                  <Field label="Follow-up date">
                                    <input style={IS} type="date" defaultValue={r.follow_up_date || ''} onChange={e => setEditFollowUp(f => ({ ...f, [r.id]: e.target.value }))} onBlur={() => saveFollowUp(r.id)} />
                                  </Field>
                                  <Field label="Assigned to">
                                    <select style={{ ...IS, fontSize:12 }}
                                      value={editAssigned[r.id]?.uid ?? r.assigned_to ?? ''}
                                      onChange={e => {
                                        const m = members.find(m => m.id === e.target.value)
                                        setEditAssigned(a => ({ ...a, [r.id]: m ? { uid:m.id, name:m.name } : { uid:'', name:'' } }))
                                      }}
                                      onBlur={() => saveAssignment(r.id)}>
                                      <option value="">Unassigned</option>
                                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                  </Field>
                                </div>
                              </div>

                              {/* Thank-you + delete row */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                                <button
                                  onClick={() => { setTyCopied(false); setTyModal(r) }}
                                  style={{ fontSize:12, fontWeight:500, color: r.thank_you_sent_at ? 'var(--success)' : N, background:'none', border:`1px solid ${r.thank_you_sent_at ? 'var(--success)' : N}`, borderRadius:7, padding:'5px 13px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                                  {r.thank_you_sent_at ? '✓ Thank-you sent' : '💌 Send thank-you'}
                                </button>
                                <button onClick={() => setConfirmDelete(r)}
                                  style={{ fontSize:11, color:'#ef4444', background:'none', border:'1px solid #fca5a5', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                                  🗑 Delete referral
                                </button>
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

          {/* Right sidebar */}
          <div>
            <Card mb={10}>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>Top referrers</div>
              {top.length === 0
                ? <div style={{ fontSize:12, color:'var(--text-4)', textAlign:'center', padding:8 }}>None yet.</div>
                : top.map(([name, count], i) => (
                  <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom: i < top.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontSize:11 }}>{['🥇','🥈','🥉','4.','5.'][i]}</span>
                      <span style={{ fontSize:12, color:'var(--text-2)' }}>{name}</span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:500, color:N }}>{count}</span>
                  </div>
                ))
              }
            </Card>

            <Card>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>Pipeline</div>
              {[
                { label:'New Lead',       val:refs.filter(r => r.status==='New Lead').length,       c:'#374151' },
                { label:'Contacted',      val:refs.filter(r => r.status==='Contacted').length,      c:'#1e40af' },
                { label:'Quoted',         val:refs.filter(r => r.status==='Quoted').length,         c:'#854d0e' },
                { label:'Sold',           val:refs.filter(r => r.status==='Sold').length,           c:'#166534' },
                { label:'Not Interested', val:refs.filter(r => r.status==='Not Interested').length, c:'#991b1b' },
              ].map((s, i, arr) => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>{s.label}</span>
                  <span style={{ fontSize:12, fontWeight:500, color:s.c }}>{s.val}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>

      {/* ── Thank-you modal ── */}
      {tyModal && (
        <Modal title="💌 Send thank-you" onClose={() => setTyModal(null)}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:6 }}>
              Copy and send this message to {tyModal.referred_by}
            </div>
            <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', fontSize:13, color:'var(--text-1)', lineHeight:1.7 }}>
              {TY_SCRIPT(tyModal.referred_by, tyModal.prospect)}
            </div>
          </div>
          {tyModal.thank_you_sent_at && (
            <div style={{ fontSize:11, color:'var(--success)', marginBottom:10, display:'flex', alignItems:'center', gap:5 }}>
              <span>✓</span>
              Thank-you marked as sent on {new Date(tyModal.thank_you_sent_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
            </div>
          )}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn variant="outline" onClick={() => setTyModal(null)}>Close</Btn>
            <button
              onClick={() => copyScript(tyModal)}
              style={{ padding:'8px 16px', background: tyCopied ? 'var(--success)' : 'var(--surface-3)', color: tyCopied ? '#fff' : 'var(--text-1)', border:`1px solid ${tyCopied ? 'var(--success)' : 'var(--border)'}`, borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit' }}>
              {tyCopied ? '✓ Copied!' : 'Copy script'}
            </button>
            {!tyModal.thank_you_sent_at && (
              <Btn onClick={() => markTySent(tyModal)} disabled={tySending}>
                {tySending ? 'Saving…' : 'Mark as sent'}
              </Btn>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this referral?"
          message={`"${confirmDelete.prospect}" referred by ${confirmDelete.referred_by} will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteRef(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {soldToast && <ReferralSoldToast prospect={soldToast} onDone={() => setSoldToast(null)} />}
    </>
  )
}
