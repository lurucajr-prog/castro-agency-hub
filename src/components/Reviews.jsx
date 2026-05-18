// ============================================================
// Castro Agency Hub — Reviews
// Place this file at: src/components/Reviews.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Modal, Spinner, EmptyState, IS } from './shared'

const RESULTS   = ['Pending', 'Left a Review', 'Declined', 'No Response']
const TEMPLATES = [
  { label: 'Text message', text: "Hi [Client Name], it was great helping you with your [policy type] today! If you have a moment, we'd really appreciate a Google review — it helps our small agency a lot. [Google Review Link]. Thank you!" },
  { label: 'Email',        text: "Hi [Client Name], thank you for trusting us with your insurance. If you've had a good experience, a quick Google review would mean the world to our team. It only takes a minute: [Google Review Link]. We really appreciate it!" },
  { label: 'Phone script', text: '"Before I let you go — we\'re always trying to grow. Would you be open to leaving us a quick Google review? I can text you the link right now."' },
]

const RESULT_STYLE = {
  'Pending':       { bg: '#fef9c3', tx: '#92400e' },
  'Left a Review': { bg: '#dcfce7', tx: '#166534' },
  'Declined':      { bg: '#fee2e2', tx: '#991b1b' },
  'No Response':   { bg: '#f3f4f6', tx: '#6b7280' },
}

function launchStars() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const cx  = canvas.width / 2
  const cy  = canvas.height / 2
  const stars = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.3
    const speed = Math.random() * 12 + 6
    return { x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 18 + 10, emoji: ['⭐','🌟','✨'][Math.floor(Math.random() * 3)], opacity: 1, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2 }
  })
  const confetti = Array.from({ length: 80 }, () => ({
    x: cx + (Math.random() - 0.5) * 100, y: cy + (Math.random() - 0.5) * 100,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4, gravity: 0.35,
    w: Math.random() * 10 + 5, h: Math.random() * 5 + 3,
    color: ['#FFD700','#FFC0CB','#FFE4B5','#FFFACD','#F0E68C','#1B3A6B','#C8102E'][Math.floor(Math.random() * 7)],
    angle: Math.random() * 360, spin: (Math.random() - 0.5) * 8, opacity: 1,
  }))
  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.vx *= 0.97; s.vy *= 0.97; s.vy += 0.15; s.rotation += s.rotSpeed
      if (frame > 60) s.opacity = Math.max(0, s.opacity - 0.02)
      ctx.save(); ctx.globalAlpha = s.opacity; ctx.font = `${s.size}px serif`
      ctx.translate(s.x, s.y); ctx.rotate(s.rotation); ctx.fillText(s.emoji, -s.size / 2, s.size / 2); ctx.restore()
    })
    confetti.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.angle += p.spin
      if (frame > 80) p.opacity = Math.max(0, p.opacity - 0.015)
      ctx.save(); ctx.globalAlpha = p.opacity; ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180)
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
    })
    frame++
    if (frame < 180) requestAnimationFrame(animate)
    else if (canvas.parentNode) document.body.removeChild(canvas)
  }
  animate()
}

function ReviewToast({ client, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '2px solid #d97706', borderRadius: 16, padding: '18px 32px', zIndex: 9998, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'toastIn 0.4s ease', minWidth: 260 }}>
      <style>{`@keyframes toastIn{from{transform:translateX(-50%) translateY(-30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
      <div style={{ fontSize: 40, marginBottom: 8 }}>⭐</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Review received!</div>
      <div style={{ fontSize: 13, color: '#374151' }}>{client} left a Google review</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>That's what we're talking about!</div>
    </div>
  )
}

export default function Reviews({ user, setPage }) {
  const [revs,             setRevs]             = useState([])
  const [loading,          setLoading]          = useState(true)
  const [showTemplates,    setShowTemplates]    = useState(false)
  const [showLinkModal,    setShowLinkModal]    = useState(false)
  const [googleReviewLink, setGoogleReviewLink] = useState('')
  const [copied,           setCopied]           = useState(null)
  const [linkCopied,       setLinkCopied]       = useState(false)
  const [form,             setForm]             = useState({ client: '', policy_type: 'Auto', trigger_type: 'New Policy', method: 'Text', result: 'Pending' })
  const [saving,           setSaving]           = useState(false)
  const [reviewToast,      setReviewToast]      = useState(null)
  const [hoveredRow,       setHoveredRow]       = useState(null)

  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchRevs(); fetchReviewLink() }, [])

  async function fetchRevs() {
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
    setRevs(data || [])
    setLoading(false)
  }

  async function fetchReviewLink() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'google_review_link').single()
    setGoogleReviewLink(data?.value || '')
  }

  async function addRev() {
    if (!form.client.trim()) return
    setSaving(true)
    const { data } = await supabase.from('reviews')
      .insert({ ...form, asked_by_name: user.name, asked_by_uid: user.id })
      .select().single()
    if (data) {
      setRevs(rs => [data, ...rs])
      if (form.result === 'Left a Review') { launchStars(); setReviewToast(form.client) }
    }
    setForm({ client: '', policy_type: 'Auto', trigger_type: 'New Policy', method: 'Text', result: 'Pending' })
    setSaving(false)
  }

  async function updateResult(id, result, clientName) {
    await supabase.from('reviews').update({ result }).eq('id', id)
    setRevs(rs => rs.map(r => r.id === id ? { ...r, result } : r))
    if (result === 'Left a Review') { launchStars(); setReviewToast(clientName) }
  }

  async function deleteReview(id) {
    if (!window.confirm('Delete this review request?')) return
    await supabase.from('reviews').delete().eq('id', id)
    setRevs(rs => rs.filter(r => r.id !== id))
  }

  function copyTemplate(text, i) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  function copyLink() {
    if (!googleReviewLink) return
    navigator.clipboard.writeText(googleReviewLink).catch(() => {})
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  if (loading) return <Spinner />

  const done = revs.filter(r => r.result === 'Left a Review').length

  return (
    <>
      <div style={{ padding: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>Review requests</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Track every ask and build accountability</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowLinkModal(true)}
              style={{ padding: '7px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📋 Copy review link
            </button>
            <Btn variant="outline" onClick={() => setShowTemplates(true)}>Templates</Btn>
          </div>
        </div>

        {/* Stats (admin only) */}
        {isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total requests', val: revs.length,                                                      c: '#1e40af' },
              { label: 'Left a review',  val: done,                                                              c: '#166534' },
              { label: 'Pending',        val: revs.filter(r => r.result === 'Pending').length,                  c: '#92400e' },
              { label: 'Conversion',     val: revs.length ? Math.round(done / revs.length * 100) + '%' : '0%', c: N        },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: s.c }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Log form */}
        <Card mb={14}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 11 }}>Log a review request</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <Field label="Client name *">
              <input style={IS} value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Maria Gonzalez" />
            </Field>
            <Field label="Policy type">
              <select style={IS} value={form.policy_type} onChange={e => setForm(f => ({ ...f, policy_type: e.target.value }))}>
                {['Auto', 'Home', 'Life', 'Renters', 'Condo', 'Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Trigger">
              <select style={IS} value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                {['New Policy', 'Renewal', 'Claim', 'Service Call', 'Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Method">
              <select style={IS} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {['Text', 'Email', 'Phone', 'In Person'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Result" style={{ gridColumn: '1 / -1' }}>
              <select style={IS} value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
                {RESULTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn onClick={addRev} disabled={saving || !form.client.trim()}>{saving ? 'Saving…' : 'Log request'}</Btn>
          </div>
        </Card>

        {/* Reviews table */}
        <Card p={0}>
          {revs.length === 0 ? <EmptyState text="No review requests yet." icon="⭐" /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Date', 'Client', 'Policy', 'Trigger', 'Method', 'Result', 'Asked by', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revs.map(r => {
                  const rs = RESULT_STYLE[r.result] || {}
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }} onMouseEnter={() => setHoveredRow(r.id)} onMouseLeave={() => setHoveredRow(null)}>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>{r.client}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{r.policy_type}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{r.trigger_type}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{r.method}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <select
                          value={r.result}
                          onChange={e => updateResult(r.id, e.target.value, r.client)}
                          style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99, border: 'none', cursor: 'pointer', background: rs.bg || '#f3f4f6', color: rs.tx || '#374151', outline: 'none' }}
                        >
                          {RESULTS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{r.asked_by_name || '-'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {(isAdmin || r.asked_by_uid === user.id) && hoveredRow === r.id && (
                          <button onClick={() => deleteReview(r.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }} title="Delete">🗑</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Templates modal */}
      {showTemplates && (
        <Modal title="Review request templates" onClose={() => setShowTemplates(false)}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>Copy a script and customize before sending.</div>
          {TEMPLATES.map((t, i) => (
            <div key={i} style={{ marginBottom: 16, background: 'var(--surface-2)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 8, fontStyle: t.label === 'Phone script' ? 'italic' : 'normal' }}>{t.text}</div>
              <button
                onClick={() => copyTemplate(t.text, i)}
                style={{ fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: copied === i ? '#dcfce7' : 'var(--surface)', color: copied === i ? '#166534' : 'var(--text-2)', cursor: 'pointer' }}
              >
                {copied === i ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </Modal>
      )}

      {/* Google review link modal */}
      {showLinkModal && (
        <Modal title="📋 Google review link" onClose={() => { setShowLinkModal(false); setLinkCopied(false) }}>
          {googleReviewLink ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.6 }}>
                Share this link with clients by text or email. One tap takes them straight to your Google review page.
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-1)', wordBreak: 'break-all', marginBottom: 14 }}>
                {googleReviewLink}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={copyLink} style={{ flex: 1 }}>
                  {linkCopied ? '✓ Copied!' : '📋 Copy link'}
                </Btn>
                <a href={googleReviewLink} target="_blank" rel="noreferrer">
                  <Btn variant="outline">Open ↗</Btn>
                </a>
              </div>
              {isAdmin && (
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-4)' }}>
                  To update this link, go to{' '}
                  <button onClick={() => { setShowLinkModal(false); setPage?.('settings') }} style={{ color: N, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: 'inherit' }}>Admin Settings</button>.
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔗</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>No review link set yet</div>
              {isAdmin ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>Go to Admin Settings to paste your Google review link.</div>
                  <Btn onClick={() => { setShowLinkModal(false); setPage?.('settings') }}>Go to Settings</Btn>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Ask Luis or Jr to add the Google review link in Settings.</div>
              )}
            </div>
          )}
        </Modal>
      )}

      {reviewToast && <ReviewToast client={reviewToast} onDone={() => setReviewToast(null)} />}
    </>
  )
}
