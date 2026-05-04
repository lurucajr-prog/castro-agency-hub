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
  const [sheets, setSheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const fileRef = useRef(null)
  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchSheets() }, [])

  async function fetchSheets() {
    const { data } = await supabase.from('cheat_sheets').select('*').order('created_at', { ascending: false })
    setSheets(data || [])
    setLoading(false)
  }

  function handleFileSelect(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  async function save() {
    if (!form.title.trim() || !file) return
    setSaving(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `sheet-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('cheat-sheets').upload(fileName, file, { contentType: file.type })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('cheat-sheets').getPublicUrl(fileName)
      const isImage = file.type.startsWith('image/')

      const { data } = await supabase.from('cheat_sheets').insert({
        title: form.title,
        description: form.description,
        image_url: isImage ? publicUrl : null,
        file_url: publicUrl,
        created_by: user.id,
      }).select().single()

      if (data) setSheets(ss => [data, ...ss])
      setModal(false)
      setForm({ title: '', description: '' })
      setFile(null)
      setPreview(null)
    } catch (e) {
      alert('Upload failed. Make sure you created the "cheat-sheets" storage bucket.')
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{sheets.length} cheat sheet{sheets.length !== 1 ? 's' : ''} available</div>
        {isAdmin && <Btn onClick={() => setModal(true)}>+ Upload cheat sheet</Btn>}
      </div>

      {sheets.length === 0
        ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginBottom: 6 }}>No cheat sheets yet</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>{isAdmin ? 'Upload your first one above!' : 'Check back soon — your admin will upload guides here.'}</div>
          </div>
        )
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {sheets.map(s => (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {/* Image preview */}
                {s.image_url ? (
                  <div
                    onClick={() => setLightbox(s.image_url)}
                    style={{ height: 180, overflow: 'hidden', cursor: 'zoom-in', background: '#f9fafb', position: 'relative' }}
                  >
                    <img src={s.image_url} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', fontWeight: 500 }}>Click to expand</div>
                  </div>
                ) : (
                  <div style={{ height: 110, background: `linear-gradient(135deg, ${N}15, ${N}30)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📄</div>
                )}

                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: s.description ? 4 : 10 }}>{s.title}</div>
                  {s.description && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>{s.description}</div>}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <a
                      href={s.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flex: 1, textAlign: 'center', padding: '7px 0', background: N, color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
                    >
                      {s.image_url ? '🔍 View full size' : '📥 Download'}
                    </a>
                    {isAdmin && (
                      <button
                        onClick={() => deleteSheet(s.id)}
                        disabled={deleting === s.id}
                        style={{ padding: '7px 10px', border: '1px solid #fee2e2', borderRadius: 7, background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}
                      >🗑</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* Upload modal */}
      {modal && (
        <Modal title="Upload cheat sheet" onClose={() => { setModal(false); setFile(null); setPreview(null) }}>
          <Field label="Title *">
            <input style={IS} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Renter's Insurance Guide" />
          </Field>
          <Field label="Description (optional)">
            <input style={IS} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief summary of what this covers" />
          </Field>
          <Field label="File (image or PDF) *">
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #e5e7eb', borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}
            >
              {preview
                ? <img src={preview} alt="preview" style={{ maxHeight: 160, borderRadius: 6, objectFit: 'contain' }} />
                : file
                  ? <div style={{ fontSize: 13, color: '#374151' }}>📄 {file.name}</div>
                  : <div style={{ fontSize: 13, color: '#9ca3af' }}>Click to select image or PDF</div>
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
  const [scripts, setScripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ title: '', category: 'Cold Call', content: '' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied] = useState(null)
  const isAdmin = user.role === 'admin'

  const CATEGORIES = ['Cold Call', 'Warm Lead', 'Referral', 'Renewal', 'Objection Handler', 'Closing', 'General']

  useEffect(() => { fetchScripts() }, [])

  async function fetchScripts() {
    const { data } = await supabase.from('scripts').select('*').order('category').order('created_at', { ascending: false })
    setScripts(data || [])
    setLoading(false)
  }

  function openAdd() { setForm({ title: '', category: 'Cold Call', content: '' }); setEditItem(null); setModal(true) }
  function openEdit(s) { setForm({ title: s.title, category: s.category, content: s.content }); setEditItem(s); setModal(true) }

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

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = scripts.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  const CAT_COLORS = {
    'Cold Call': { bg: '#fee2e2', tx: '#991b1b' },
    'Warm Lead': { bg: '#dcfce7', tx: '#166534' },
    'Referral': { bg: '#ede9fe', tx: '#5b21b6' },
    'Renewal': { bg: '#dbeafe', tx: '#1e40af' },
    'Objection Handler': { bg: '#fef9c3', tx: '#854d0e' },
    'Closing': { bg: '#e0f2fe', tx: '#075985' },
    'General': { bg: '#f3f4f6', tx: '#374151' },
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{scripts.length} script{scripts.length !== 1 ? 's' : ''} available</div>
        {isAdmin && <Btn onClick={openAdd}>+ Add script</Btn>}
      </div>

      {scripts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginBottom: 6 }}>No scripts yet</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>{isAdmin ? 'Add your first script above!' : 'Scripts will appear here once added by your admin.'}</div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: CAT_COLORS[cat]?.bg || '#f3f4f6', color: CAT_COLORS[cat]?.tx || '#374151', padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{cat}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{items.length} script{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(s => (
                <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{s.title}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isAdmin && (
                        <>
                          <Btn sm variant="ghost" onClick={e => { e.stopPropagation(); openEdit(s) }}>Edit</Btn>
                          <Btn sm variant="ghost" onClick={e => { e.stopPropagation(); deleteScript(s.id) }} style={{ color: '#dc2626' }}>Delete</Btn>
                        </>
                      )}
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{expanded === s.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded === s.id && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 16px', background: '#fafafa' }}>
                      <pre style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{s.content}</pre>
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                        <Btn sm variant="outline" onClick={() => copyScript(s.content, s.id)}>
                          {copied === s.id ? '✓ Copied!' : 'Copy script'}
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <Modal title={editItem ? 'Edit script' : 'Add script'} onClose={() => setModal(false)} width={540}>
          <Field label="Title *">
            <input style={IS} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Auto insurance cold call opener" />
          </Field>
          <Field label="Category">
            <select style={IS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Script content *">
            <textarea
              style={{ ...IS, height: 200, resize: 'vertical', lineHeight: 1.6 }}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Type the full script here. Use [brackets] for fill-in-the-blank parts like [client name] or [policy type]."
            />
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

// ─── FAQs ─────────────────────────────────────────────────────
function FAQs({ user }) {
  const [faqs, setFaqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ question: '', answer: '', category: 'Billing & Rates' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const isAdmin = user.role === 'admin'

  const CATEGORIES = ['Billing & Rates', 'Coverage', 'Claims', 'Policy Changes', 'Discounts', 'General']
  const CAT_COLORS = {
    'Billing & Rates': { bg: '#dbeafe', tx: '#1e40af' },
    'Coverage':        { bg: '#dcfce7', tx: '#166534' },
    'Claims':          { bg: '#fee2e2', tx: '#991b1b' },
    'Policy Changes':  { bg: '#ede9fe', tx: '#5b21b6' },
    'Discounts':       { bg: '#fef9c3', tx: '#854d0e' },
    'General':         { bg: '#f3f4f6', tx: '#374151' },
  }

  useEffect(() => { fetchFaqs() }, [])

  async function fetchFaqs() {
    const { data } = await supabase.from('faqs').select('*').order('category').order('created_at', { ascending: true })
    setFaqs(data || [])
    setLoading(false)
  }

  function openAdd() { setForm({ question: '', answer: '', category: 'Billing & Rates' }); setEditItem(null); setModal(true) }
  function openEdit(f) { setForm({ question: f.question, answer: f.answer, category: f.category }); setEditItem(f); setModal(true) }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)
    if (editItem) {
      const { data } = await supabase.from('faqs').update({ question: form.question, answer: form.answer, category: form.category }).eq('id', editItem.id).select().single()
      if (data) setFaqs(fs => fs.map(f => f.id === editItem.id ? data : f))
    } else {
      const { data } = await supabase.from('faqs').insert({ ...form, created_by: user.id }).select().single()
      if (data) setFaqs(fs => [...fs, data])
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

  const filtered = faqs.filter(f => {
    if (!search) return true
    const s = search.toLowerCase()
    return f.question.toLowerCase().includes(s) || f.answer.toLowerCase().includes(s)
  })

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(f => f.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search FAQs…"
          style={{ ...IS, maxWidth: 280 }}
        />
        {isAdmin && <Btn onClick={openAdd}>+ Add FAQ</Btn>}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❓</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginBottom: 6 }}>{faqs.length === 0 ? 'No FAQs yet' : 'No results found'}</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>{isAdmin && faqs.length === 0 ? 'Add your first FAQ above!' : 'Try a different search.'}</div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: CAT_COLORS[cat]?.bg || '#f3f4f6', color: CAT_COLORS[cat]?.tx || '#374151', padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{cat}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{items.length} question{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(f => (
                <div key={f.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                    style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111', flex: 1, paddingRight: 10 }}>{f.question}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      {isAdmin && (
                        <>
                          <Btn sm variant="ghost" onClick={e => { e.stopPropagation(); openEdit(f) }}>Edit</Btn>
                          <Btn sm variant="ghost" onClick={e => { e.stopPropagation(); deleteFaq(f.id) }} style={{ color: '#dc2626' }}>Delete</Btn>
                        </>
                      )}
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{expanded === f.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded === f.id && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '13px 16px', background: '#fafafa' }}>
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{f.answer}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <Modal title={editItem ? 'Edit FAQ' : 'Add FAQ'} onClose={() => setModal(false)} width={520}>
          <Field label="Question *">
            <input style={IS} value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="e.g. How is my rate calculated?" />
          </Field>
          <Field label="Category">
            <select style={IS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Answer *">
            <textarea
              style={{ ...IS, height: 160, resize: 'vertical', lineHeight: 1.6 }}
              value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="Type the full answer here…"
            />
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
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Learning center</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Scripts, guides, and resources for the team</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {TABS.map(t => {
          const active = tab === t
          const meta = TAB_META[t]
          return (
            <div
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
                background: active ? N : '#fff',
                border: `1px solid ${active ? N : '#e5e7eb'}`,
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: active ? '0 2px 8px rgba(27,58,107,0.15)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{meta.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#fff' : '#111' }}>{t}</div>
                <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>{meta.desc}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div>
        {tab === 'Cheat Sheets' && <CheatSheets user={user} />}
        {tab === 'Scripts'      && <Scripts user={user} />}
        {tab === 'FAQs'         && <FAQs user={user} />}
      </div>
    </div>
  )
}
