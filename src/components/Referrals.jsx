import { useState, useEffect } from 'react'
import { supabase }             from '../lib/supabase'
import { N, Card, Btn, Field, Chip, Spinner, EmptyState, IS, ConfirmModal } from './shared'
import { launchConfetti }        from '../utils/animations'
import { exportCSV }             from '../utils/csv'

const STATUSES = ['New Lead', 'Contacted', 'Quoted', 'Sold', 'Not Interested']

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

// Follow-up date pill — shows overdue/due today in red/amber
function FollowUpBadge({ date }) {
  if (!date) return null
  const today     = new Date().toISOString().split('T')[0]
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const isOverdue = date < today
  const isToday   = date === today
  const isTomorrow = date === tomorrow

  let bg, tx, label
  if (isOverdue)      { bg='var(--danger-light)';  tx='#991b1b';  label='⚠ Overdue' }
  else if (isToday)   { bg='var(--warning-light)'; tx='#92400e';  label='📅 Today' }
  else if (isTomorrow){ bg='var(--warning-light)'; tx='#92400e';  label='📅 Tomorrow' }
  else                { bg='var(--surface-3)';     tx='var(--text-3)'; label='📅 ' + new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' }) }

  return (
    <span style={{ fontSize:10, fontWeight:500, background:bg, color:tx, padding:'2px 7px', borderRadius:99 }}>
      {label}
    </span>
  )
}

export default function Referrals({ user }) {
  const [refs,          setRefs]          = useState([])
  const [profiles,      setProfiles]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('All')
  const [expanded,      setExpanded]      = useState(null)
  const [form,          setForm]          = useState({
    referred_by: '', prospect: '', phone: '', status: 'New Lead',
    notes: '', follow_up_date: '', assigned_to: '', assigned_to_name: '', source_type: 'Word of Mouth',
  })
  const [saving,        setSaving]        = useState(false)
  const [soldToast,     setSoldToast]     = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Inline edit states for expanded row
  const [editNotes,     setEditNotes]     = useState({})   // { [id]: string }
  const [editFollowUp,  setEditFollowUp]  = useState({})   // { [id]: string }
  const [editAssigned,  setEditAssigned]  = useState({})   // { [id]: { uid, name } }

  const isAdmin  = user.role === 'admin'
  const members  = profiles.filter(p => p.role === 'member' || p.role === 'admin')
  const today    = new Date().toISOString().split('T')[0]

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

    // Check for follow-up reminders due today
    await checkFollowUpReminders(data)
  }

  // Fire in-hub notifications for referrals with follow_up_date = today
  // Uses follow_up_notified column so we never notify twice in the same day
  async function checkFollowUpReminders(allRefs) {
    const due = allRefs.filter(r =>
      r.follow_up_date === today &&
      r.follow_up_notified !== today &&
      !['Sold', 'Not Interested'].includes(r.status)
    )
    if (due.length === 0) return

    for (const ref of due) {
      // Notify the assigned agent, or the current user if unassigned and they're admin
      const targetUid = ref.assigned_to || (isAdmin ? user.id : null)
      if (!targetUid) continue

      // Only fire notification for the current user (server-side would handle others)
      if (targetUid === user.id) {
        await supabase.from('notifications').insert({
          to_uid:     user.id,
          type:       'task',
          title:      `Follow-up due: ${ref.prospect}`,
          body:       `Referred by ${ref.referred_by} · Status: ${ref.status}`,
          nav_target: 'referrals',
        })
      }

      // Mark as notified so it doesn't fire again today
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
      source_type:      form.source_type || 'Word of Mouth',
    }).select().single()
    if (error) { console.error('[Referrals] add error', error); setSaving(false); return }
    if (data) setRefs(rs => [data, ...rs])
    setForm({ referred_by:'', prospect:'', phone:'', status:'New Lead', notes:'', follow_up_date:'', assigned_to:'', assigned_to_name:'', source_type:'Word of Mouth' })
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
    const assignment      = editAssigned[id]
    const assigned_to     = assignment?.uid || null
    const assigned_to_name = assignment?.name || null
    await supabase.from('referrals').update({ assigned_to, assigned_to_name }).eq('id', id)
    setRefs(rs => rs.map(r => r.id === id ? { ...r, assigned_to, assigned_to_name } : r))

    // Notify the assigned person if it's not the current user
    if (assigned_to && assigned_to !== user.id) {
      const ref = refs.find(r => r.id === id)
      await supabase.from('notifications').insert({
        to_uid:     assigned_to,
        type:       'referral_assigned',
        title:      `📋 Referral assigned to you`,
        body:       `${ref?.prospect || 'A referral'} — referred by ${ref?.referred_by || 'unknown'}`,
        nav_target: 'referrals',
        read:       false,
      })
    }
  }

  async function deleteRef(ref) {
    const { error } = await supabase.from('referrals').delete().eq('id', ref.id)
    if (error) { console.error('[Referrals] delete error', error); return }
    setRefs(rs => rs.filter(r => r.id !== ref.id))
    setConfirmDelete(null)
    if (expanded === ref.id) setExpanded(null)
  }

  if (loading) return <Spinner />

  // Stats
  const total      = refs.length
  const sold       = refs.filter(r => r.status === 'Sold').length
  const pipeline   = refs.filter(r => ['New Lead','Contacted','Quoted'].includes(r.status)).length
  const notInt     = refs.filter(r => r.status === 'Not Interested').length
  const conversion = total > 0 ? Math.round(sold / total * 100) : 0
  const followUpDue = refs.filter(r => r.follow_up_date && r.follow_up_date <= today && !['Sold','Not Interested'].includes(r.status)).length

  // Top referrers
  const rc = {}
  refs.forEach(r => { rc[r.referred_by] = (rc[r.referred_by] || 0) + 1 })
  const top = Object.entries(rc).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Filter
  const filtered = filter === 'All' ? refs : refs.filter(r => r.status === filter)

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
                  r.referred_by,
                  r.prospect,
                  r.phone || '',
                  r.status,
                  r.assigned_to_name || '',
                  r.follow_up_date || '',
                  r.notes || '',
                ])
                exportCSV('referrals.csv', ['Date','Referred By','Prospect','Phone','Status','Assigned To','Follow-up Date','Notes'], rows)
              }}>
                ⬇ Export CSV
              </Btn>
            )}
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
                <Field label="How did they find us?">
                  <select style={IS} value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type:e.target.value }))}>
                    {['Word of Mouth','Google / Online','Social Media','Walked In','Direct Ask','Other'].map(o => <option key={o}>{o}</option>)}
                  </select>
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
                  {followUpDue} referral{followUpDue!==1?'s':''} {followUpDue===1?'is':'are'} due for follow-up today or overdue.
                </span>
                <button onClick={() => setFilter('All')} style={{ fontSize:11, color:'#92400e', background:'none', border:'1px solid #d97706', borderRadius:5, padding:'2px 8px', cursor:'pointer', marginLeft:'auto' }}>
                  View all
                </button>
              </div>
            )}

            {/* Filter pills */}
            <div style={{ display:'flex', gap:5, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
              {['All', ...STATUSES].map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{ padding:'3px 11px', borderRadius:99, border:'none', cursor:'pointer', fontSize:11, fontWeight:500, background: filter===s?N:'var(--surface-3)', color: filter===s?'#fff':'var(--text-3)' }}>{s}</button>
              ))}
            </div>

            {/* Referrals table */}
            <Card p={0}>
              {filtered.length === 0 ? <EmptyState text="No referrals found." icon="🤝" /> : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--surface-2)' }}>
                      {['Prospect','Referred by','Assigned','Follow-up','Status',''].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.flatMap(r => {
                      const date    = new Date(r.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })
                      const isExp   = expanded === r.id
                      const notesVal    = editNotes[r.id]    !== undefined ? editNotes[r.id]    : (r.notes || '')
                      const followUpVal = editFollowUp[r.id] !== undefined ? editFollowUp[r.id] : (r.follow_up_date || '')
                      const assignedUid = editAssigned[r.id] !== undefined ? editAssigned[r.id]?.uid : r.assigned_to

                      return [
                        <tr key={r.id} onClick={() => setExpanded(isExp ? null : r.id)} style={{ borderTop:'1px solid var(--border)', cursor:'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'9px 12px', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>
                            {r.prospect}
                            {r.notes && <div style={{ fontSize:10, color:'var(--text-4)', marginTop:1, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.notes}</div>}
                          </td>
                          <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)' }}>{r.referred_by}</td>
                          <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-3)' }}>{r.assigned_to_name || <span style={{ color:'var(--text-4)', fontStyle:'italic' }}>Unassigned</span>}</td>
                          <td style={{ padding:'9px 12px' }}><FollowUpBadge date={r.follow_up_date} /></td>
                          <td style={{ padding:'9px 12px' }}><Chip label={r.status} /></td>
                          <td style={{ padding:'9px 12px', fontSize:10, color:'var(--text-4)' }}>{isExp ? '▲' : '▼'}</td>
                        </tr>,

                        isExp && (
                          <tr key={r.id + 'x'} style={{ background:'var(--surface-2)', borderTop:'1px solid var(--border)' }}>
                            <td colSpan={6} style={{ padding:'12px 14px' }}>
                              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

                                {/* Status row */}
                                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                                  <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:500 }}>Status:</span>
                                  {STATUSES.map(s => (
                                    <button key={s} onClick={e => { e.stopPropagation(); updateStatus(r.id, s, r.prospect) }} style={{ padding:'3px 9px', borderRadius:99, cursor:'pointer', fontSize:11, border:`1px solid ${r.status===s?N:'var(--border)'}`, background: r.status===s?N:'var(--surface)', color: r.status===s?'#fff':'var(--text-3)' }}>{s}</button>
                                  ))}
                                  {r.phone && <span style={{ fontSize:11, color:'var(--text-4)', marginLeft:4 }}>📞 {r.phone}</span>}
                                </div>

                                {/* Notes + follow-up + assignment row */}
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }} onClick={e => e.stopPropagation()}>

                                  {/* Notes */}
                                  <Field label="Notes" mb={0}>
                                    <textarea
                                      value={notesVal}
                                      onChange={e => setEditNotes(n => ({ ...n, [r.id]: e.target.value }))}
                                      onBlur={() => saveNotes(r.id)}
                                      placeholder="Add context, follow-up notes…"
                                      rows={2}
                                      style={{ ...IS, resize:'none', lineHeight:1.5, fontSize:12 }}
                                    />
                                  </Field>

                                  {/* Follow-up date */}
                                  <Field label="Follow-up date" mb={0}>
                                    <input
                                      type="date"
                                      value={followUpVal}
                                      onChange={e => setEditFollowUp(f => ({ ...f, [r.id]: e.target.value }))}
                                      onBlur={() => saveFollowUp(r.id)}
                                      style={{ ...IS, fontSize:12 }}
                                    />
                                    {followUpVal && (
                                      <button onClick={() => { setEditFollowUp(f => ({ ...f, [r.id]: '' })); setTimeout(() => saveFollowUp(r.id), 0) }} style={{ fontSize:10, color:'var(--text-4)', background:'none', border:'none', cursor:'pointer', marginTop:3 }}>
                                        Clear date
                                      </button>
                                    )}
                                  </Field>

                                  {/* Assign to */}
                                  <Field label="Assign to" mb={0}>
                                    <select
                                      value={assignedUid || ''}
                                      onChange={e => {
                                        const m = members.find(m => m.id === e.target.value)
                                        setEditAssigned(a => ({ ...a, [r.id]: m ? { uid: m.id, name: m.name } : { uid: '', name: '' } }))
                                      }}
                                      onBlur={() => saveAssignment(r.id)}
                                      style={{ ...IS, fontSize:12 }}
                                    >
                                      <option value="">Unassigned</option>
                                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                  </Field>

                                  {/* Source */}
                                  <Field label="How they found us" mb={0}>
                                    <select
                                      value={r.source_type || 'Word of Mouth'}
                                      onChange={async e => {
                                        const src = e.target.value
                                        await supabase.from('referrals').update({ source_type: src }).eq('id', r.id)
                                        setRefs(rs => rs.map(x => x.id === r.id ? { ...x, source_type: src } : x))
                                      }}
                                      style={{ ...IS, fontSize:12 }}
                                    >
                                      {['Word of Mouth','Google / Online','Social Media','Walked In','Direct Ask','Other'].map(o => <option key={o}>{o}</option>)}
                                    </select>
                                  </Field>
                                </div>

                                {/* Delete button */}
                                <div style={{ display:'flex', justifyContent:'flex-end' }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => setConfirmDelete(r)} style={{ fontSize:11, color:'#ef4444', background:'none', border:'1px solid #fca5a5', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                                    🗑 Delete referral
                                  </button>
                                </div>
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
            {/* Top referrers */}
            <Card mb={10}>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', marginBottom:10 }}>Top referrers</div>
              {top.length === 0
                ? <div style={{ fontSize:12, color:'var(--text-4)', textAlign:'center', padding:8 }}>None yet.</div>
                : top.map(([name, count], i) => (
                  <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom: i<top.length-1?'1px solid var(--border)':'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontSize:11 }}>{['🥇','🥈','🥉','4.','5.'][i]}</span>
                      <span style={{ fontSize:11, color:'var(--text-1)' }}>{name.split(',')[0]}</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:500, color:N }}>{count}</span>
                  </div>
                ))
              }
            </Card>

            {/* Stats */}
            <Card mb={10}>
              {[
                { label:'Total',         val:total },
                { label:'Sold',          val:sold,    c:'#166534' },
                { label:'Pipeline',      val:pipeline, c:'#92400e' },
                { label:'Not Interested',val:notInt,  c:'#991b1b' },
              ].map((s, i, a) => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom: i<a.length-1?'1px solid var(--border)':'none' }}>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>{s.label}</span>
                  <span style={{ fontSize:12, fontWeight:500, color:s.c||'var(--text-1)' }}>{s.val}</span>
                </div>
              ))}
            </Card>

            {/* Conversion rate */}
            <Card mb={10}>
              <div style={{ fontSize:10, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Conversion rate</div>
              <div style={{ fontSize:28, fontWeight:700, color: conversion >= 30 ? '#166534' : conversion >= 15 ? '#d97706' : '#991b1b', marginBottom:4 }}>
                {conversion}%
              </div>
              <div style={{ height:5, background:'var(--surface-3)', borderRadius:99, marginBottom:5 }}>
                <div style={{ width:Math.min(100,conversion)+'%', height:'100%', background: conversion>=30?'#16a34a':conversion>=15?'#d97706':'#dc2626', borderRadius:99, transition:'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize:10, color:'var(--text-4)' }}>{sold} sold out of {total} total</div>
            </Card>

            {/* Follow-ups due */}
            {followUpDue > 0 && (
              <Card style={{ background:'var(--warning-light)', border:'1px solid #fcd34d' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#92400e', marginBottom:4 }}>📅 Follow-ups due</div>
                <div style={{ fontSize:22, fontWeight:700, color:'#92400e' }}>{followUpDue}</div>
                <div style={{ fontSize:10, color:'#78350f' }}>referral{followUpDue!==1?'s':''} need attention</div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {soldToast && <ReferralSoldToast prospect={soldToast} onDone={() => setSoldToast(null)} />}

      {confirmDelete && (
        <ConfirmModal
          title="Delete this referral?"
          message={`This will permanently remove ${confirmDelete.prospect} from the referral tracker.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteRef(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
