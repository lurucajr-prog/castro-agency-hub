// ============================================================
// Castro Agency Hub — DirectMessages
// Place this file at: src/components/DirectMessages.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R, Spinner, ConfirmModal } from './shared'

const GIPHY_KEY = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'

async function fetchGifs(query) {
  const url = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`
  const res  = await fetch(url)
  const data = await res.json()
  return data.data || []
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showPushNotification(title, body, onClick) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'castro-dm' })
  n.onclick = () => { window.focus(); n.close(); onClick?.() }
  setTimeout(() => n.close(), 6000)
}

export default function DirectMessages({ user, setPage, darkMode, dmTarget, onDmTargetConsumed }) {
  const [profiles,       setProfiles]       = useState([])
  const [selected,       setSelected]       = useState(null)
  const [conversations,  setConversations]  = useState({})
  const [text,           setText]           = useState('')
  const [uploading,      setUploading]      = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [lightbox,       setLightbox]       = useState(null)
  const [unread,         setUnread]         = useState({})
  const [notifEnabled,   setNotifEnabled]   = useState(Notification?.permission === 'granted')
  const [confirmDelete,  setConfirmDelete]  = useState(null)

  // GIF picker
  const [showGifPicker,  setShowGifPicker]  = useState(false)
  const [gifSearch,      setGifSearch]      = useState('')
  const [gifs,           setGifs]           = useState([])
  const [gifsLoading,    setGifsLoading]    = useState(false)

  const endRef      = useRef(null)
  const imageRef    = useRef(null)
  const pdfRef      = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => { selectedRef.current = selected }, [selected])

  // Auto-select from dmTarget
  useEffect(() => {
    if (dmTarget && profiles.length > 0) {
      const target = profiles.find(p => p.id === dmTarget)
      if (target) { selectConversation(target); onDmTargetConsumed?.() }
    }
  }, [dmTarget, profiles])

  useEffect(() => {
    fetchProfiles()
  }, [])

  // Load trending GIFs initially
  useEffect(() => {
    if (showGifPicker && gifs.length === 0) loadGifs('')
  }, [showGifPicker])

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id)
    const ps = (data || []).map(p => ({
      ...p,
      ini: p.ini || p.name?.slice(0, 2).toUpperCase() || '??',
    }))
    setProfiles(ps)

    // Fetch unread counts
    const umap = {}
    for (const p of ps) {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_uid', p.id)
        .eq('to_uid', user.id)
        .eq('read', false)
      umap[p.id] = count || 0
    }
    setUnread(umap)
    setLoading(false)
  }

  async function selectConversation(profile) {
    setSelected(profile)
    setShowGifPicker(false)

    if (!conversations[profile.id]) {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(from_uid.eq.${user.id},to_uid.eq.${profile.id}),and(from_uid.eq.${profile.id},to_uid.eq.${user.id})`)
        .order('created_at', { ascending: true })
      setConversations(c => ({ ...c, [profile.id]: data || [] }))
    }

    // Mark as read
    await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('from_uid', profile.id)
      .eq('to_uid', user.id)
      .eq('read', false)
    setUnread(u => ({ ...u, [profile.id]: 0 }))

    // Subscribe to real-time
    supabase.channel(`dm_${user.id}_${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, async payload => {
        const msg = payload.new
        const other = selectedRef.current
        if (
          (msg.from_uid === other?.id && msg.to_uid === user.id) ||
          (msg.from_uid === user.id  && msg.to_uid === other?.id)
        ) {
          setConversations(c => ({
            ...c,
            [other.id]: [...(c[other.id] || []), msg],
          }))
          if (msg.from_uid === other?.id) {
            await supabase.from('direct_messages').update({ read: true }).eq('id', msg.id)
          }
        } else if (msg.to_uid === user.id) {
          setUnread(u => ({ ...u, [msg.from_uid]: (u[msg.from_uid] || 0) + 1 }))
          const sender = profiles.find(p => p.id === msg.from_uid)
          showPushNotification(
            `New message from ${sender?.name || 'Teammate'}`,
            msg.text || (msg.file_name ? `📎 ${msg.file_name}` : msg.image_url ? '📷 Image' : ''),
            () => setPage('dms')
          )
        }
      })
      .subscribe()

    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }

  async function sendMessage(imageUrl = null, fileUrl = null, fileName = null) {
    const trimmed = text.trim()
    if (!trimmed && !imageUrl && !fileUrl) return
    const sel = selectedRef.current
    if (!sel) return
    setText('')
    setShowGifPicker(false)

    const { data } = await supabase.from('direct_messages').insert({
      from_uid:  user.id,
      to_uid:    sel.id,
      text:      trimmed || '',
      image_url: imageUrl || null,
      file_url:  fileUrl  || null,
      file_name: fileName || null,
      read:      false,
    }).select().single()

    if (data) {
      setConversations(c => ({ ...c, [sel.id]: [...(c[sel.id] || []), data] }))
    }
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }
    setUploading(true)
    const ext      = file.name.split('.').pop() || 'png'
    const fileName = `dm-img-${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: file.type })
    if (error) { alert('Upload failed.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    await sendMessage(publicUrl)
    setUploading(false)
    e.target.value = ''
  }

  async function handlePdfUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { alert('File must be under 20MB.'); return }
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storedName = `dm-${user.id}-${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from('dm-files').upload(storedName, file, { contentType: file.type })
    if (error) { alert('Upload failed. Make sure the dm-files storage bucket exists.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('dm-files').getPublicUrl(storedName)
    await sendMessage(null, publicUrl, file.name)
    setUploading(false)
    e.target.value = ''
  }

  async function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    const file = item.getAsFile()
    if (file) {
      setUploading(true)
      const fileName = `dm-paste-${user.id}-${Date.now()}.png`
      const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: 'image/png' })
      if (error) { alert('Paste upload failed.'); setUploading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
      await sendMessage(publicUrl)
      setUploading(false)
    }
  }

  async function loadGifs(query) {
    setGifsLoading(true)
    const results = await fetchGifs(query)
    setGifs(results)
    setGifsLoading(false)
  }

  async function sendGif(gif) {
    const url = gif.images?.fixed_height?.url || gif.images?.original?.url
    if (!url) return
    setShowGifPicker(false)
    await sendMessage(url)
  }

  async function confirmDeleteMessage() {
    if (!confirmDelete) return
    await supabase.from('direct_messages').delete().eq('id', confirmDelete.id)
    const other = selectedRef.current
    if (other) {
      setConversations(c => ({
        ...c,
        [other.id]: (c[other.id] || []).filter(m => m.id !== confirmDelete.id),
      }))
    }
    setConfirmDelete(null)
  }

  async function enableNotifications() {
    const ok = await requestNotificationPermission()
    setNotifEnabled(ok)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function formatTime(ts) {
    const d     = new Date(ts)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (loading) return <Spinner />

  const currentMsgs = selected ? (conversations[selected.id] || []) : []

  return (
    <>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 250, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>Direct messages</div>
            {!notifEnabled ? (
              <button onClick={enableNotifications} style={{ width: '100%', padding: '7px 10px', background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: 'var(--primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                🔔 Enable notifications
              </button>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />
                Notifications on
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {profiles.map(p => {
              const msgs       = conversations[p.id] || []
              const last       = msgs[msgs.length - 1]
              const uCount     = unread[p.id] || 0
              const isSelected = selected?.id === p.id

              function lastPreview(m) {
                if (!m) return 'No messages yet'
                if (m.file_name) return `📎 ${m.file_name}`
                if (m.image_url && !m.text) return '📷 Image'
                return m.text || ''
              }

              return (
                <div
                  key={p.id}
                  onClick={() => selectConversation(p)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'var(--primary-light)' : 'var(--surface)',
                    borderLeft: isSelected ? `3px solid ${N}` : '3px solid transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: p.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af' }}>{p.ini}</div>
                      <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: uCount > 0 ? 700 : 500, color: 'var(--text-1)' }}>{p.name}</span>
                        {uCount > 0 && <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}>{uCount}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: uCount > 0 ? 'var(--text-2)' : 'var(--text-4)', fontWeight: uCount > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lastPreview(last)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Conversation area */}
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-2)' }}>Select a teammate to message</div>
            <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Your conversations are private</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: selected.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: selected.role === 'admin' ? '#fff' : '#1e40af' }}>{selected.ini}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{selected.title} · Private message</div>
              </div>
            </div>

            {/* Messages */}
            <div
              style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}
              onClick={() => setShowGifPicker(false)}
            >
              {currentMsgs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginTop: 40 }}>
                  Start a conversation with {selected.name} 👋
                </div>
              )}
              {currentMsgs.map((m, idx) => {
                const isMe    = m.from_uid === user.id
                const sender  = profiles.find(p => p.id === m.from_uid) || (m.from_uid === user.id ? user : null)
                const canDel  = isMe || user.role === 'admin'
                const isLast  = idx === currentMsgs.length - 1
                const showRead = isMe && isLast && m.read

                return (
                  <div
                    key={m.id || idx}
                    style={{ display: 'flex', gap: 9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}
                    onMouseEnter={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity = '1' }}
                    onMouseLeave={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity = '0' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: sender?.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: sender?.role === 'admin' ? '#fff' : '#1e40af' }}>
                      {sender?.ini || '??'}
                    </div>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{isMe ? 'You' : sender?.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{formatTime(m.created_at)}</span>
                      </div>

                      {/* PDF / file download card */}
                      {m.file_url && (
                        <a
                          href={m.file_url}
                          target="_blank"
                          rel="noreferrer"
                          download={m.file_name}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: isMe ? N : 'var(--surface)',
                            border: `1px solid ${isMe ? N : 'var(--border)'}`,
                            borderRadius: 10, padding: '10px 14px',
                            textDecoration: 'none', cursor: 'pointer',
                            maxWidth: 280,
                          }}
                        >
                          <div style={{ fontSize: 26, flexShrink: 0 }}>📄</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: isMe ? '#fff' : 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                              {m.file_name || 'Attachment'}
                            </div>
                            <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-4)', marginTop: 2 }}>
                              Click to download
                            </div>
                          </div>
                        </a>
                      )}

                      {/* Image */}
                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt="shared"
                          onClick={() => setLightbox(m.image_url)}
                          style={{ maxWidth: 280, maxHeight: 220, borderRadius: 10, display: 'block', cursor: 'zoom-in', objectFit: 'cover' }}
                        />
                      )}

                      {/* Text */}
                      {m.text && (
                        <div style={{
                          background: isMe ? N : 'var(--surface)',
                          color: isMe ? '#fff' : 'var(--text-1)',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          padding: '9px 14px', fontSize: 13, lineHeight: 1.5,
                          border: `1px solid ${isMe ? N : 'var(--border)'}`,
                          marginTop: m.image_url || m.file_url ? 4 : 0,
                        }}>
                          {m.text}
                        </div>
                      )}

                      {showRead && (
                        <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-4)', marginTop: 3 }}>✓ Read</div>
                      )}
                    </div>

                    {canDel && (
                      <button
                        className="del-btn"
                        onClick={() => setConfirmDelete(m)}
                        style={{ opacity: 0, transition: 'opacity 0.15s', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, alignSelf: 'center', padding: '2px 4px' }}
                        title="Delete message"
                      >🗑</button>
                    )}
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {/* GIF picker */}
            {showGifPicker && (
              <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 14px', flexShrink: 0 }}>
                <input
                  value={gifSearch}
                  onChange={e => { setGifSearch(e.target.value); loadGifs(e.target.value) }}
                  placeholder="Search GIFs…"
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, background: 'var(--surface-2)', color: 'var(--text-1)', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {gifsLoading
                    ? <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-4)', fontSize: 12, padding: 16 }}>Loading…</div>
                    : gifs.map(g => (
                        <img
                          key={g.id}
                          src={g.images?.fixed_height_small?.url}
                          alt={g.title}
                          onClick={() => sendGif(g)}
                          style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                        />
                      ))
                  }
                </div>
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Image upload */}
                <button
                  onClick={() => imageRef.current?.click()}
                  disabled={uploading}
                  title="Send image"
                  style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}
                >📷</button>

                {/* PDF upload */}
                <button
                  onClick={() => pdfRef.current?.click()}
                  disabled={uploading}
                  title="Send PDF or file"
                  style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}
                >📎</button>

                {/* GIF button */}
                <button
                  onClick={() => setShowGifPicker(o => !o)}
                  style={{ height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${showGifPicker ? N : 'var(--border)'}`, background: showGifPicker ? 'var(--primary-light)' : 'var(--surface)', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: showGifPicker ? N : 'var(--text-3)', flexShrink: 0 }}
                >GIF</button>

                <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                <input ref={pdfRef}   type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" style={{ display: 'none' }} onChange={handlePdfUpload} />

                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={onKey}
                  onPaste={handlePaste}
                  placeholder={uploading ? 'Uploading…' : `Message ${selected.name}… (or paste image)`}
                  disabled={uploading}
                  style={{ flex: 1, fontSize: 13, padding: '9px 15px', border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface-2)', color: 'var(--text-1)', outline: 'none', fontFamily: 'inherit' }}
                />

                <button
                  onClick={() => sendMessage()}
                  disabled={uploading || (!text.trim())}
                  style={{ background: N, color: '#fff', border: 'none', borderRadius: 22, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, opacity: uploading ? 0.6 : 1 }}
                >Send</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out', padding: 24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain' }} />
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this message?"
          message="This permanently removes the message for both people."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteMessage}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
