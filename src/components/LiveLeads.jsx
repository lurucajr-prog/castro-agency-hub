import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Btn, Field, Spinner, EmptyState, IS } from './shared'

const VENDORS = ['SmartFinancial', 'Datalot']
const STATUSES = ['Still Working', 'Sold', 'Not Interested', 'Return']
const NOT_INTERESTED_REASONS = ['Premium', 'Did not qualify']

const STATUS_STYLE = {
  'Still Working': { bg: '#dbeafe', tx: '#1e40af', icon: '⏳' },
  'Sold':          { bg: '#dcfce7', tx: '#166534', icon: '🎉' },
  'Not Interested':{ bg: '#fee2e2', tx: '#991b1b', icon: '✗' },
  'Return':        { bg: '#fef9c3', tx: '#854d0e', icon: '↩' },
}

const VENDOR_STYLE = {
  'SmartFinancial': { bg: '#ede9fe', tx: '#5b21b6' },
  'Datalot':        { bg: '#e0f2fe', tx: '#075985' },
}

const REASON_STYLE = {
  'Premium':         { bg: '#fee2e2', tx: '#991b1b' },
  'Did not qualify': { bg: '#fef9c3', tx: '#854d0e' },
}

const SAD_MESSAGES = [
  "Shake it off — next one is yours! 💪",
  "Don't sweat it, keep dialing! 📞",
  "Brush it off, the next call is a close! 🎯",
  "Not this one — but you're one step closer! 🔥",
  "Every no gets you closer to the yes! Keep going! 🚀",
  "Tough break. Reset and attack the next one! ⚡",
]

function launchConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const colors = ['#C8102E','#1B3A6B','#FFD700','#16a34a','#f97316','#8b5cf6','#ec4899','#06b6d4']
  const particles = Array.from({ length: 200 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * 100,
    w: Math.random() * 14 + 6, h: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 5 + 2, angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 10, drift: (Math.random() - 0.5) * 3, opacity: 1,
  }))
  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.y += p.speed; p.x += p.drift; p.angle += p.spin
      if (frame > 144) p.opacity = Math.max(0, p.opacity - 0.015)
      ctx.save(); ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180)
      ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h)
      ctx.restore()
    })
    frame++
    if (frame < 240) requestAnimationFrame(animate)
    else if (canvas.parentNode) document.body.removeChild(canvas)
  }
  animate()
}

function launchSadRain() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const emojis = ['😤','😩','😞','💔','😤','😒']
  const particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * canvas.width, y: -40 - Math.random() * 60,
    size: Math.random() * 22 + 18, speed: Math.random() * 3 + 1.5,
    drift: (Math.random() - 0.5) * 1.5,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    opacity: 1, wobble: Math.random() * Math.PI * 2,
  }))
  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.y += p.speed; p.x += p.drift + Math.sin(p.wobble + frame * 0.05) * 0.5
      if (frame > 80) p.opacity = Math.max(0, p.opacity - 0.02)
      ctx.save(); ctx.globalAlpha = p.opacity
      ctx.font = `${p.size}px serif`; ctx.fillText(p.emoji, p.x, p.y)
      ctx.restore()
    })
    frame++
    if (frame < 150) requestAnimationFrame(animate)
    else if (canvas.parentNode) document.body.removeChild(canvas)
  }
  animate()
}

function SoldToast({ name, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'#fff', border:'2px solid #16a34a', borderRadius:16, padding:'20px 36px', zIndex:9998, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', animation:'toastIn 0.4s ease' }}>
      <style>{`@keyframes toastIn{from{transform:translateX(-50%) translateY(-30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
      <div style={{ fontSize:44, marginBottom:8 }}>🎉</div>
      <div style={{ fontSize:18, fontWeight:700, color:'#166534', marginBottom:4 }}>Sale closed!</div>
      <div style={{ fontSize:14, color:'#6b7280' }}>{name} — marked as Sold</div>
    </div>
  )
}

function SadToast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3800); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'#fff', border:'2px solid #dc2626', borderRadius:16, padding:'20px 36px', zIndex:9998, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', animation:'toastIn 0.4s ease', minWidth:300 }}>
      <div style={{ fontSize:44, marginBottom:8 }}>😤</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#991b1b', marginBottom:6 }}>Didn't close this one.</div>
      <div style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>{message}</div>
    </div>
  )
}

export default function LiveLeads({ user }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', vendor: 'SmartFinancial' })
  const [saving, setSaving] = useState(false)
  const [soldToast, setSoldToast] = useState(null)
  const [sadToast, setSadToast] = useState(null)
  // Track which leads are showing the reason dropdown
  const [showReason, setShowReason] = useState({})

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    const { data } = await supabase
      .from('live_leads')
      .select('*, profiles(name, ini)')
      .order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  async function addLead() {
    if (!form.name.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('live_leads')
      .insert({ uid: user.id, name: form.name, vendor: form.vendor, status: 'Still Working', one_call_close: 'Pending' })
      .select('*, profiles(name, ini)').single()
    if (data) setLeads(ls => [data, ...ls])
    setForm({ name: '', vendor: 'SmartFinancial' })
    setSaving(false)
  }

  async function updateStatus(id, status, leadName) {
    await supabase.from('live_leads').update({ status, not_interested_reason: null }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status, not_interested_reason: null } : l))

    if (status === 'Sold') {
      launchConfetti()
      setSoldToast(leadName)
      // Clear reason dropdown if switching away from Not Interested
      setShowReason(sr => ({ ...sr, [id]: false }))
    } else if (status === 'Not Interested') {
      launchSadRain()
      setSadToast(SAD_MESSAGES[Math.floor(Math.random() * SAD_MESSAGES.length)])
      // Show reason dropdown
      setShowReason(sr => ({ ...sr, [id]: true }))
    } else {
      setShowReason(sr => ({ ...sr, [id]: false }))
    }
  }

  async function updateReason(id, reason) {
    await supabase.from('live_leads').update({ not_interested_reason: reason }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, not_interested_reason: reason } : l))
  }

  async function updateOCC(id, one_call_close) {
    await supabase.from('live_leads').update({ one_call_close }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, one_call_close } : l))
    if (one_call_close === 'No') {
      launchSadRain()
      setSadToast(SAD_MESSAGES[Math.floor(Math.random() * SAD_MESSAGES.length)])
    }
  }

  async function deleteLead(id) {
    if (!window.confirm('Remove this lead?')) return
    await supabase.from('live_leads').delete().eq('id', id)
    setLeads(ls => ls.filter(l => l.id !== id))
  }

  function onKey(e) { if (e.key === 'Enter') addLead() }

  if (loading) return <Spinner />

  const todayLeads = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString())
  const soldToday = todayLeads.filter(l => l.status === 'Sold').length
  const occYes = leads.filter(l => l.one_call_close === 'Yes').length
  const occTotal = leads.filter(l => l.one_call_close !== 'Pending').length
  const vendorCounts = {}
  VENDORS.forEach(v => { vendorCounts[v] = leads.filter(l => l.vendor === v).length })

  const OCC_STYLE = {
    'Pending': { bg: '#f3f4f6', tx: '#6b7280' },
    'Yes':     { bg: '#dcfce7', tx: '#166534' },
    'No':      { bg: '#fee2e2', tx: '#991b1b' },
  }

  return (
    <>
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Live Lead Recap</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Track live leads and results in real time</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: "Today's leads", val: todayLeads.length, c: '#1e40af' },
            { label: 'Sold today', val: soldToday, c: '#166534' },
            { label: 'Still working', val: todayLeads.filter(l => l.status === 'Still Working').length, c: '#d97706' },
            { label: 'OCC rate', val: occTotal ? Math.round(occYes / occTotal * 100) + '%' : '—', c: '#6d28d9' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.c }}>{s.val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 185px', gap: 12 }}>
          <div>
            <Card mb={14}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 12 }}>Log a live lead</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <Field label="Lead name *" style={{ flex: 1, marginBottom: 0 }}>
                  <input style={IS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={onKey} placeholder="e.g. John Smith" />
                </Field>
                <Field label="Vendor" style={{ width: 180, marginBottom: 0 }}>
                  <select style={IS} value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}>
                    {VENDORS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </Field>
                <Btn onClick={addLead} disabled={saving} style={{ flexShrink: 0, marginBottom: 1 }}>
                  {saving ? 'Adding…' : '+ Add lead'}
                </Btn>
              </div>
            </Card>

            <Card p={0}>
              {leads.length === 0
                ? <EmptyState text="No leads logged yet. Add one above!" />
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Lead name', 'Vendor', 'Agent', 'Time', 'One Call Close', 'Status', ''].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map(l => {
                        const ss = STATUS_STYLE[l.status] || STATUS_STYLE['Still Working']
                        const os = OCC_STYLE[l.one_call_close] || OCC_STYLE['Pending']
                        const vs = VENDOR_STYLE[l.vendor] || {}
                        const isNotInterested = l.status === 'Not Interested'
                        const rs = l.not_interested_reason ? REASON_STYLE[l.not_interested_reason] : null

                        return (
                          <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{l.name}</div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ background: vs.bg, color: vs.tx, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{l.vendor}</span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{l.profiles?.name || '—'}</td>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                              {new Date(l.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <select
                                value={l.one_call_close || 'Pending'}
                                onChange={e => updateOCC(l.id, e.target.value)}
                                style={{ border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: os.bg, color: os.tx, padding: '4px 10px', borderRadius: 99, outline: 'none' }}
                              >
                                {['Pending', 'Yes', 'No'].map(o => <option key={o} value={o}>{o === 'Yes' ? '✓ Yes' : o === 'No' ? '✗ No' : '— Pending'}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                <select
                                  value={l.status}
                                  onChange={e => updateStatus(l.id, e.target.value, l.name)}
                                  style={{ border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: ss.bg, color: ss.tx, padding: '4px 10px', borderRadius: 99, outline: 'none' }}
                                >
                                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_STYLE[s]?.icon} {s}</option>)}
                                </select>

                                {/* Reason dropdown — only shows when Not Interested */}
                                {isNotInterested && (
                                  <select
                                    value={l.not_interested_reason || ''}
                                    onChange={e => updateReason(l.id, e.target.value)}
                                    style={{
                                      border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 500, fontSize: 11,
                                      background: l.not_interested_reason ? REASON_STYLE[l.not_interested_reason]?.bg : '#fff',
                                      color: l.not_interested_reason ? REASON_STYLE[l.not_interested_reason]?.tx : '#9ca3af',
                                      padding: '4px 10px', borderRadius: 99, outline: 'none',
                                    }}
                                  >
                                    <option value="" disabled>Select reason…</option>
                                    {NOT_INTERESTED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <button onClick={() => deleteLead(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 15, lineHeight: 1 }}>×</button>
                            </td>
                          </tr>
                        )
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
              {STATUSES.map((s, i) => {
                const ss = STATUS_STYLE[s]
                const count = leads.filter(l => l.status === s).length
                return (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < STATUSES.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ss.tx, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#374151' }}>{s}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ss.tx }}>{count}</span>
                  </div>
                )
              })}
            </Card>

            <Card mb={10}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 10 }}>Not interested reasons</div>
              {NOT_INTERESTED_REASONS.map((r, i) => {
                const rs = REASON_STYLE[r]
                const count = leads.filter(l => l.not_interested_reason === r).length
                return (
                  <div key={r} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < NOT_INTERESTED_REASONS.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize: 11, color: '#374151' }}>{r}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: rs.tx }}>{count}</span>
                  </div>
                )
              })}
            </Card>

            <Card>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 10 }}>By vendor</div>
              {VENDORS.map((v, i) => {
                const vs = VENDOR_STYLE[v]
                return (
                  <div key={v} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < VENDORS.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize: 11, color: '#374151' }}>{v}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: vs.tx }}>{vendorCounts[v] || 0}</span>
                  </div>
                )
              })}
            </Card>
          </div>
        </div>
      </div>

      {soldToast && <SoldToast name={soldToast} onDone={() => setSoldToast(null)} />}
      {sadToast && <SadToast message={sadToast} onDone={() => setSadToast(null)} />}
    </>
  )
}
