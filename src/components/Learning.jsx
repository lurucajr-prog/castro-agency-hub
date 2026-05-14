import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Field, Modal, Spinner, EmptyState, IS } from './shared'

const TABS = ['Cheat Sheets', 'Scripts', 'FAQs']
const TAB_META = {
  'Cheat Sheets': { icon: '📋', desc: 'Visual guides and reference sheets' },
  'Scripts':      { icon: '💬', desc: 'Call scripts and conversation guides' },
  'FAQs':         { icon: '❓', desc: 'Common client questions and answers' },
}

// ─── CHEAT SHEETS ─────────────────────────────────────────────
function CheatSheets({ user }) {
  const [sheets,     setSheets]     = useState([])
  const [reads,      setReads]      = useState([])   // cheat_sheet_reads rows
  const [profiles,   setProfiles]   = useState([])   // for admin read-by modal
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(false)
  const [form,       setForm]       = useState({ title: '', description: '' })
  const [file,       setFile]       = useState(null)
  const [preview,    setPreview]    = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [lightbox,   setLightbox]   = useState(null)
  const [deleting,   setDeleting]   = useState(null)
  const [readByModal,setReadByModal] = useState(null)  // sheet to show who read it
  const fileRef = useRef(null)
  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [sh, rd, pr] = await Promise.all([
      supabase.from('cheat_sheets').select('*').order('created_at', { ascending: false }),
      supabase.from('cheat_sheet_reads').select('*'),
      isAdmin ? supabase.from('profiles').select('id, name, ini, role') : Promise.resolve({ data: [] }),
    ])
    setSheets(sh.data || [])
    setReads(rd.data || [])
    setProfiles(pr.data || [])
    setLoading(false)
  }

  async function markRead(sheetId) {
    const already = reads.some(r => r.sheet_id === sheetId && r.uid === user.id)
    if (already) return
    const { data } = await supabase.from('cheat_sheet_reads').insert({ sheet_id: sheetId, uid: user.id }).select().single()
    if (data) setReads(prev => [...prev, data])
  }

  function handleFileSelect(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  async function save() {
    if (!form.title.trim() || !file) return
    setSaving(true)
    try {
      const ext      = file.name.split('.').pop()
      const fileName = `sheet-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('cheat-sheets').upload(fileName, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('cheat-sheets').getPublicUrl(fileName)
      const isImage = file.type.startsWith('image/')
      const { data } = await supabase.from('cheat_sheets').insert({
        title:       form.title,
        description: form.description,
        image_url:   isImage ? publicUrl : null,
        file_url:    publicUrl,
        created_by:  user.id,
      }).select().single()
      if (data) setSheets(ss => [data, ...ss])
      setModal(false)
      setForm({ title: '', description: '' })
      setFile(null)
      setPreview(null)
    } catch {
      alert('Upload failed. Make sure the "cheat-sheets" storage bucket exists.')
    }
    setSaving(false)
  }

  async function deleteSheet(id) {
    if (!window.confirm('Delete this cheat sheet?')) return
    setDeleting(id)
    await supabase.from('cheat_sheets').delete().eq('id', id)
    setSheets(ss => ss.filter(s => s.id !== id))
    setDeleting(null)
  }

  if (loading) return <Spinner />

  const agentCount = profiles.filter(p => p.role === 'member').length || 1

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{sheets.length} cheat sheet{sheets.length !== 1 ? 's' : ''}</div>
        {isAdmin && <Btn onClick={() => setModal(true)}>+ Upload cheat sheet</Btn>}
      </div>

      {sheets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>No cheat sheets yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{isAdmin ? 'Upload your first one above!' : 'Your admin will upload guides here.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {sheets.map(s => {
            const myRead      = reads.some(r => r.sheet_id === s.id && r.uid === user.id)
            const readCount   = reads.filter(r => r.sheet_id === s.id).length
            const readByNames = profiles.filter(p => reads.some(r => r.sheet_id === s.id && r.uid === p.id)).map(p => p.name)

            return (
              <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {/* Image preview */}
                {s.image_url ? (
                  <div
                    onClick={() => { setLightbox(s.image_url); markRead(s.id) }}
                    style={{ height: 180, overflow: 'hidden', cursor: 'zoom-in', background: 'var(--surface-2)', position: 'relative' }}
                  >
                    <img src={s.image_url} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', fontWeight: 500 }}>Click to expand</div>
                    {myRead && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: '#166534', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', fontWeight: 600 }}>✓ Read</div>
                    )}
                  </div>
                ) : (
                  <div style={{ height: 110, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, position: 'relative' }}>
                    📄
                    {myRead && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: '#166534', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', fontWeight: 600 }}>✓ Read</div>
                    )}
                  </div>
                )}

                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: s.description ? 4 : 10 }}>{s.title}</div>
                  {s.description && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>{s.description}</div>}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <a
                      href={s.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markRead(s.id)}
                      style={{ flex: 1, textAlign: 'center', padding: '7px 0', background: N, color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
                    >
                      {s.image_url ? '🔍 View full size' : '📥 Download'}
                    </a>
                    {isAdmin && (
                      <>
                        {/* Read count button */}
                        <button
                          onClick={() => setReadByModal(s)}
                          style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-2)', color: readCount > 0 ? 'var(--success)' : 'var(--text-4)', cursor: 'pointer', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
                          title="See who read this"
                        >
                          {readCount > 0 ? '✓' : '○'} {readCount}
                        </button>
                        <button
                          onClick={() => deleteSheet(s.id)}
                          disabled={deleting === s.id}
                          style={{ padding: '7px 10px', border: '1px solid var(--danger-light)', borderRadius: 7, background: 'var(--surface)', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}
                        >🗑</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload modal */}
      {modal && (
        <Modal title="Upload cheat sheet" onClose={() => { setModal(false); setFile(null); setPreview(null) }}>
          <Field label="Title *">
            <input style={IS} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Renter's Insurance Guide" />
          </Field>
          <Field label="Description (optional)">
            <input style={IS} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief summary" />
          </Field>
          <Field label="File (image or PDF) *">
            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border-2)', borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}>
              {preview
                ? <img src={preview} alt="preview" style={{ maxHeight: 160, borderRadius: 6, objectFit: 'contain' }} />
                : file
                  ? <div style={{ fontSize: 13, color: 'var(--text-2)' }}>📄 {file.name}</div>
                  : <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Click to select image or PDF</div>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => { setModal(false); setFile(null); setPreview(null) }}>Cancel</Btn>
            <Btn onClick={save} disabled={saving || !file || !form.title.trim()}>{saving ? 'Uploading…' : 'Upload'}</Btn>
          </div>
        </Modal>
      )}

      {/* Read-by modal (admin only) */}
      {readByModal && (
        <Modal title={`Who read "${readByModal.title}"`} onClose={() => setReadByModal(null)} width={380}>
          {(() => {
            const agents   = profiles.filter(p => p.role === 'member')
            const readUids = reads.filter(r => r.sheet_id === readByModal.id).map(r => r.uid)
            return (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                  {readUids.length} of {agents.length} agents have viewed this sheet
                </div>
                {agents.map(a => {
                  const hasRead = readUids.includes(a.id)
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: hasRead ? 'var(--success-light)' : 'var(--surface-2)', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: hasRead ? '#166534' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: hasRead ? '#fff' : 'var(--text-4)' }}>{a.ini}</div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', flex: 1 }}>{a.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: hasRead ? '#166534' : 'var(--text-4)' }}>{hasRead ? '✓ Read' : '○ Not yet'}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </Modal>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out', padding: 24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}

// ─── SCRIPTS ──────────────────────────────────────────────────
function Scripts({ user }) {
  const [scripts,  setScripts]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form,     setForm]     = useState({ title: '', category: 'Cold Call', content: '' })
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [copied,   setCopied]   = useState(null)
  const isAdmin = user.role === 'admin'
  const CATEGORIES = ['Cold Call', 'Warm Lead', 'Referral', 'Renewal', 'Objection Handler', 'Closing', 'General']

  useEffect(() => { fetchScripts() }, [])

  async function fetchScripts() {
    const { data } = await supabase.from('scripts').select('*').order('category').order('created_at', { ascending: false })
    setScripts(data || [])
    setLoading(false)
  }

  function openAdd()  { setForm({ title: '', category: 'Cold Call', content: '' }); setEditItem(null); setModal(true) }
  function openEdit(s){ setForm({ title: s.title, category: s.category, content: s.content }); setEditItem(s); setModal(true) }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    if (editItem) {
      const { data } = await supabase.from('scripts').update({ title: form.title, category: form.category, content: form.content }).eq('id', editItem.id).select().single()
      if (data) setScripts(ss => ss.map(s => s.id === editItem.id ? data : s))
    } else {
      const { data } = await supabase.from('scripts').insert({ ...form, created_by: user.id }).select().single()
      if (data) setScripts(ss => [data, ...ss])
    }
    setModal(false)
    setSaving(false)
  }

  async function deleteScript(id) {
    if (!window.confirm('Delete this script?')) return
    await supabase.from('scripts').delete().eq('id', id)
    setScripts(ss => ss.filter(s => s.id !== id))
  }

  function copyScript(text, id) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <Spinner />

  const CAT_COLORS = {
    'Cold Call':        { bg: '#fee2e2', tx: '#991b1b' },
    'Warm Lead':        { bg: '#dcfce7', tx: '#166534' },
    'Referral':         { bg: '#ede9fe', tx: '#5b21b6' },
    'Renewal':          { bg: '#dbeafe', tx: '#1e40af' },
    'Objection Handler':{ bg: '#fef9c3', tx: '#854d0e' },
    'Closing':          { bg: '#e0f2fe', tx: '#075985' },
    'General':          { bg: '#f3f4f6', tx: '#374151' },
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = scripts.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{scripts.length} script{scripts.length !== 1 ? 's' : ''}</div>
        {isAdmin && <Btn onClick={openAdd}>+ Add script</Btn>}
      </div>

      {scripts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>No scripts yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{isAdmin ? 'Add your first script above!' : 'Scripts will appear here once added.'}</div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: CAT_COLORS[cat]?.bg || '#f3f4f6', color: CAT_COLORS[cat]?.tx || '#374151', padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{cat}</span>
              <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{items.length} script{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(s => (
                <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(expanded === s.id ? null : s.id)} style={{ padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{s.title}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {isAdmin && (
                        <>
                          <button onClick={e => { e.stopPropagation(); openEdit(s) }} style={{ fontSize: 11, color: N, background: 'none', border: `1px solid ${N}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Edit</button>
                          <button onClick={e => { e.stopPropagation(); deleteScript(s.id) }} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Delete</button>
                        </>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{expanded === s.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded === s.id && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'var(--surface-2)' }}>
                      <pre style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7, margin: '0 0 10px' }}>{s.content}</pre>
                      <Btn sm variant="outline" onClick={() => copyScript(s.content, s.id)}>
                        {copied === s.id ? '✓ Copied!' : '📋 Copy script'}
                      </Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <Modal title={editItem ? 'Edit script' : 'Add script'} onClose={() => setModal(false)}>
          <Field label="Title *"><input style={IS} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Handling the 'too expensive' objection" /></Field>
          <Field label="Category">
            <select style={IS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Script content *">
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={8} placeholder="Write the full script here…" style={{ ...IS, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Save changes' : 'Add script'}</Btn>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── FAQs ──────────────────────────────────────────────────────
function FAQs({ user }) {
  const [faqs,     setFaqs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form,     setForm]     = useState({ question: '', answer: '', category: 'General' })
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState(null)
  const isAdmin = user.role === 'admin'
  const CATEGORIES = ['Coverage', 'Billing', 'Claims', 'Discounts', 'Bundling', 'General']

  useEffect(() => { fetchFaqs() }, [])

  async function fetchFaqs() {
    const { data } = await supabase.from('faqs').select('*').order('category').order('created_at', { ascending: false })
    setFaqs(data || [])
    setLoading(false)
  }

  function openAdd()  { setForm({ question: '', answer: '', category: 'General' }); setEditItem(null); setModal(true) }
  function openEdit(f){ setForm({ question: f.question, answer: f.answer, category: f.category }); setEditItem(f); setModal(true) }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)
    if (editItem) {
      const { data } = await supabase.from('faqs').update({ ...form }).eq('id', editItem.id).select().single()
      if (data) setFaqs(fs => fs.map(f => f.id === editItem.id ? data : f))
    } else {
      const { data } = await supabase.from('faqs').insert({ ...form, created_by: user.id }).select().single()
      if (data) setFaqs(fs => [data, ...fs])
    }
    setModal(false)
    setSaving(false)
  }

  async function deleteFaq(id) {
    if (!window.confirm('Delete this FAQ?')) return
    await supabase.from('faqs').delete().eq('id', id)
    setFaqs(fs => fs.filter(f => f.id !== id))
  }

  if (loading) return <Spinner />

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = faqs.filter(f => f.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{faqs.length} FAQ{faqs.length !== 1 ? 's' : ''}</div>
        {isAdmin && <Btn onClick={openAdd}>+ Add FAQ</Btn>}
      </div>

      {faqs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❓</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>No FAQs yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{isAdmin ? 'Add your first FAQ above!' : 'FAQs will appear here once added.'}</div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{cat}</div>
            {items.map(f => (
              <div key={f.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(expanded === f.id ? null : f.id)} style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', flex: 1, marginRight: 10 }}>Q: {f.question}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {isAdmin && (
                      <>
                        <button onClick={e => { e.stopPropagation(); openEdit(f) }} style={{ fontSize: 11, color: N, background: 'none', border: `1px solid ${N}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={e => { e.stopPropagation(); deleteFaq(f.id) }} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Delete</button>
                      </>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{expanded === f.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expanded === f.id && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'var(--surface-2)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                    {f.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {modal && (
        <Modal title={editItem ? 'Edit FAQ' : 'Add FAQ'} onClose={() => setModal(false)}>
          <Field label="Question *"><input style={IS} value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="e.g. Why did my rate go up?" /></Field>
          <Field label="Category">
            <select style={IS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Answer *">
            <textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} rows={5} placeholder="Write a clear, client-friendly answer…" style={{ ...IS, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editItem ? 'Save changes' : 'Add FAQ'}</Btn>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── MAIN LEARNING COMPONENT ──────────────────────────────────
export default function Learning({ user }) {
  const [tab, setTab] = useState('Cheat Sheets')
  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>Learning center</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Scripts, guides, and resources for the team</div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {TABS.map(t => {
          const active = tab === t
          const meta   = TAB_META[t]
          return (
            <div key={t} onClick={() => setTab(t)} style={{ padding: '10px 18px', borderRadius: 10, cursor: 'pointer', background: active ? N : 'var(--surface)', border: `1px solid ${active ? N : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 8, boxShadow: active ? '0 2px 8px rgba(27,58,107,0.15)' : 'none', transition: 'all 0.15s' }}>
              <span style={{ fontSize: 16 }}>{meta.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#fff' : 'var(--text-1)' }}>{t}</div>
                <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-4)' }}>{meta.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div>
        {tab === 'Cheat Sheets' && <CheatSheets user={user} />}
        {tab === 'Scripts'      && <Scripts user={user} />}
        {tab === 'FAQs'         && <FAQs user={user} />}
      </div>
    </div>
  )
}
