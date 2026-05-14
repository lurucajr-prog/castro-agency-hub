import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Modal, Spinner, EmptyState, IS } from './shared'

const RESULTS = ['Pending', 'Left a Review', 'Declined', 'No Response']
const METHODS = ['Text', 'Email', 'Phone', 'In Person']

const TEMPLATES = [
  { label: 'Text message', text: "Hi [Client Name], it was great helping you with your [policy type] today! If you have a moment, we'd really appreciate a Google review — it helps our small agency a lot. [Google Review Link]. Thank you!" },
  { label: 'Email',        text: "Hi [Client Name], thank you for trusting us with your insurance. If you've had a good experience, a quick Google review would mean the world to our team. It only takes a minute: [Google Review Link]. We really appreciate it!" },
  { label: 'Phone script', text: '"Before I let you go — we\'re always trying to grow. Would you be open to leaving us a quick Google review? I can text you the link right now."' },
]

// ── Star burst animation ──────────────────────────────────────
function launchStars() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width = window.innerWidth; canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const cx = canvas.width / 2; const cy = canvas.height / 2
  const stars = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.3
    const speed = Math.random() * 12 + 6
    return { x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 18 + 10, color: ['⭐','🌟','✨'][Math.floor(Math.random() * 3)], opacity: 1, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2 }
  })
  let frame = 0
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.vy += 0.3; s.opacity -= 0.018; s.rotation += s.rotSpeed
      if (s.opacity <= 0) return
      ctx.save(); ctx.globalAlpha = s.opacity; ctx.font = `${s.size}px serif`; ctx.translate(s.x, s.y); ctx.rotate(s.rotation); ctx.fillText(s.color, -s.size / 2, s.size / 2); ctx.restore()
    })
    frame++
    if (frame < 90) requestAnimationFrame(draw); else canvas.remove()
  }
  draw()
}

function ReviewToast({ client, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '2px solid #d97706', borderRadius: 16, padding: '16px 28px', zIndex: 9998, textAlign: 'center', boxShadow: 'var(--shadow-lg)', minWidth: 240 }}>
      <div style={{ fontSize: 32, marginBottom: 6 }}>⭐</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Review logged!</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{client}</div>
    </div>
  )
}

export default function Reviews({ user }) {
  const [revs,          setRevs]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [copied,        setCopied]        = useState(null)
  const [copiedLink,    setCopiedLink]    = useState(false)
  const [reviewLink,    setReviewLink]    = useState('')
  const [editingLink,   setEditingLink]   = useState(false)
  const [linkDraft,     setLinkDraft]     = useState('')
  const [form,          setForm]          = useState({ client: '', policy_type: 'Auto', trigger_type: 'New Policy', method: 'Text', result: 'Pending' })
  const [saving,        setSaving]        = useState(false)
  const [reviewToast,   setReviewToast]   = useState(null)
  const [hoveredRow,    setHoveredRow]    = useState(null)

  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [revsRes, settingsRes] = await Promise.all([
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('*').eq('key', 'google_review_link').maybeSingle(),
    ])
    setRevs(revsRes.data || [])
    setReviewLink(settingsRes.data?.value || '')
    setLoading(false)
  }

  async function saveReviewLink() {
    await supabase.from('settings').upsert({ key: 'google_review_link', value: linkDraft.trim() }, { onConflict: 'key' })
    setReviewLink(linkDraft.trim())
    setEditingLink(false)
  }

  function copyLink() {
    if (!reviewLink) return
    navigator.clipboard.writeText(reviewLink).catch(() => {})
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
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

  if (loading) return <Spinner />

  const done = revs.filter(r => r.result === 'Left a Review').length

  // Conversion rate by method
  const methodStats = METHODS.map(m => {
    const mRevs = revs.filter(r => r.method === m)
    const mDone = mRevs.filter(r => r.result === 'Left a Review').length
    return { method: m, total: mRevs.length, done: mDone, pct: mRevs.length > 0 ? Math.round(mDone / mRevs.length * 100) : 0 }
  }).filter(s => s.total > 0)

  const METHOD_ICONS = { Text: '💬', Email: '📧', Phone: '📞', 'In Person': '🤝' }

  return (
    <>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>Review requests</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Track every ask and build accountability</div>
          </div>
          <Btn variant="outline" onClick={() => setShowTemplates(true)}>Templates</Btn>
        </div>

        {/* ── Google review link ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>⭐</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>Google Review Link</div>
            {editingLink ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  style={{ ...IS, flex: 1, fontSize: 12 }}
                  value={linkDraft}
                  onChange={e => setLinkDraft(e.target.value)}
                  placeholder="Paste your Google review URL…"
                  autoFocus
                />
                <Btn sm onClick={saveReviewLink}>Save</Btn>
                <Btn sm variant="outline" onClick={() => setEditingLink(false)}>Cancel</Btn>
              </div>
            ) : reviewLink ? (
              <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{reviewLink}</div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic' }}>No link set yet{isAdmin ? ' — click Edit to add one' : ''}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            {reviewLink && (
              <Btn sm variant="outline" onClick={copyLink}>
                {copiedLink ? '✓ Copied!' : '📋 Copy link'}
              </Btn>
            )}
            {isAdmin && (
              <Btn sm variant="outline" onClick={() => { setLinkDraft(reviewLink); setEditingLink(true) }}>
                {reviewLink ? 'Edit' : '+ Add link'}
              </Btn>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        {isAdmin && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
              {[
                { label: 'Total requests', val: revs.length,                                           c: '#1e40af' },
                { label: 'Left a review',  val: done,                                                  c: '#166534' },
                { label: 'Pending',        val: revs.filter(r => r.result === 'Pending').length,       c: '#92400e' },
                { label: 'Conversion',     val: revs.length ? Math.round(done / revs.length * 100) + '%' : '0%', c: N },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: s.c }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Conversion by method */}
            {methodStats.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {methodStats.map(s => (
                  <div key={s.method} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px', minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                      {METHOD_ICONS[s.method]} {s.method}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.pct >= 50 ? 'var(--success)' : s.pct > 0 ? N : 'var(--text-4)' }}>
                      {s.pct}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>{s.done}/{s.total} converted</div>
                    {/* Mini bar */}
                    <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 99, marginTop: 6 }}>
                      <div style={{ width: s.pct + '%', height: '100%', background: s.pct >= 50 ? 'var(--success)' : N, borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Log form ── */}
        <Card mb={14}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 11 }}>Log a review request</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <Field label="Client name *">
              <input style={IS} value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Smith, John" />
            </Field>
            <Field label="Policy type">
              <select style={IS} value={form.policy_type} onChange={e => setForm(f => ({ ...f, policy_type: e.target.value }))}>
                {['Auto', 'Home', 'Life', 'Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Trigger">
              <select style={IS} value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                {['New Policy', 'Renewal'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Method">
              <select style={IS} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {METHODS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Result">
              <select style={IS} value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
                {RESULTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Btn onClick={addRev} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving…' : 'Log request'}
              </Btn>
            </div>
          </div>
        </Card>

        {/* ── Review list ── */}
        <Card p={0}>
          {revs.length === 0 ? <EmptyState text="No review requests logged yet." icon="⭐" /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Client', 'Policy', 'Date', 'Method', 'Asked by', 'Result', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revs.map(r => (
                  <tr
                    key={r.id}
                    style={{ borderTop: '1px solid var(--border)', background: hoveredRow === r.id ? 'var(--surface-2)' : 'transparent' }}
                    onMouseEnter={() => setHoveredRow(r.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{r.policy_type}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{METHOD_ICONS[r.method]} {r.method}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-3)' }}>{r.asked_by_name}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <select
                        value={r.result}
                        onChange={e => updateResult(r.id, e.target.value, r.client)}
                        style={{ border: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', color: 'var(--text-1)', fontFamily: 'inherit' }}
                      >
                        {RESULTS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', width: 40 }}>
                      <button
                        onClick={() => deleteReview(r.id)}
                        title="Delete"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#ef4444', opacity: hoveredRow === r.id ? 1 : 0, transition: 'opacity 0.15s', padding: '2px 4px' }}
                      >🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Templates modal */}
      {showTemplates && (
        <Modal title="Review templates" onClose={() => setShowTemplates(false)}>
          {reviewLink && (
            <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12, color: 'var(--primary)' }}>
              💡 Remember to replace [Google Review Link] with your actual link. <button onClick={copyLink} style={{ background: 'none', border: 'none', color: N, fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: 0 }}>{copiedLink ? '✓ Copied' : 'Copy it now'}</button>
            </div>
          )}
          {TEMPLATES.map((t, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{t.label}</span>
                <Btn sm variant="outline" onClick={() => copyTemplate(t.text, i)}>{copied === i ? '✓ Copied' : 'Copy'}</Btn>
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>{t.text}</div>
            </div>
          ))}
        </Modal>
      )}

      {reviewToast && <ReviewToast client={reviewToast} onDone={() => setReviewToast(null)} />}
    </>
  )
}
