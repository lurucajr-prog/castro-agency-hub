// ============================================================
// Castro Agency Hub — Direct Messages (matches Chat.jsx design)
// Place this file at: src/components/DirectMessages.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R, Spinner, ConfirmModal } from './shared'

const GIPHY_KEY = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showNotification(title, body, onClick) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico', tag: 'castro-dm' })
  n.onclick = () => { window.focus(); n.close(); onClick?.() }
  setTimeout(() => n.close(), 6000)
}

export default function DirectMessages({ user, setPage, darkMode, dmTarget, onDmTargetConsumed }) {
  const [profiles,      setProfiles]      = useState([])   // all teammates (excludes self)
  const [allProfiles,   setAllProfiles]   = useState([])   // everyone including self (for message lookups)
  const [selected,      setSelected]      = useState(null)
  const [conversations, setConversations] = useState({})   // { [otherUid]: [...messages] }
  const [text,          setText]          = useState('')
  const [uploading,     setUploading]     = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [lightbox,      setLightbox]      = useState(null)
  const [unread,        setUnread]        = useState({})
  const [notifEnabled,  setNotifEnabled]  = useState(Notification?.permission === 'granted')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [hoveredMsgId,  setHoveredMsgId]  = useState(null)

  // GIF picker
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch,     setGifSearch]     = useState('')
  const [gifs,          setGifs]          = useState([])
  const [gifsLoading,   setGifsLoading]   = useState(false)

  const scrollRef   = useRef(null)
  const fileRef     = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('dm_realtime_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        const msg = payload.new
        if (msg.from_uid !== user.id && msg.to_uid !== user.id) return
        const otherUid = msg.from_uid === user.id ? msg.to_uid : msg.from_uid

        setConversations(prev => ({
          ...prev,
          [otherUid]: [...(prev[otherUid] || []), msg]
        }))

        if (msg.from_uid !== user.id) {
          const currentSel = selectedRef.current
          if (currentSel?.id === otherUid) {
            // Auto-mark read if currently open
            supabase.from('direct_messages').update({ read: true })
              .eq('from_uid', otherUid).eq('to_uid', user.id).eq('read', false)
          } else {
            setUnread(u => ({ ...u, [otherUid]: (u[otherUid] || 0) + 1 }))
            setAllProfiles(profs => {
              const sender = profs.find(p => p.id === msg.from_uid)
              if (sender) {
                showNotification(
                  `New message from ${sender.name}`,
                  msg.image_url && !msg.text ? '📷 Sent an image' : (msg.text || ''),
                  () => setPage?.('dms')
                )
              }
              return profs
            })
          }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'direct_messages' }, payload => {
        const msg = payload.old
        const otherUid = msg.from_uid === user.id ? msg.to_uid : msg.from_uid
        setConversations(prev => ({
          ...prev,
          [otherUid]: (prev[otherUid] || []).filter(m => m.id !== msg.id)
        }))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // Auto-select from dmTarget (when navigating from a notification)
  useEffect(() => {
    if (dmTarget && profiles.length > 0) {
      const target = profiles.find(p => p.id === dmTarget)
      if (target) { selectConversation(target); onDmTargetConsumed?.() }
    }
  }, [dmTarget, profiles])

  // Scroll to bottom when conversation changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversations, selected])

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGifPicker && gifs.length === 0) loadGifs('')
  }, [showGifPicker])

  async function fetchData() {
    const [profRes, msgRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('direct_messages')
        .select('*')
        .or(`from_uid.eq.${user.id},to_uid.eq.${user.id}`)
        .order('created_at', { ascending: true }),
    ])

    const all = profRes.data || []
    setAllProfiles(all)
    setProfiles(all.filter(p => p.id !== user.id))

    const grouped = {}
    ;(msgRes.data || []).forEach(m => {
      const otherUid = m.from_uid === user.id ? m.to_uid : m.from_uid
      if (!grouped[otherUid]) grouped[otherUid] = []
      grouped[otherUid].push(m)
    })
    setConversations(grouped)

    const unreadCounts = {}
    ;(msgRes.data || []).forEach(m => {
      if (m.to_uid === user.id && !m.read) {
        unreadCounts[m.from_uid] = (unreadCounts[m.from_uid] || 0) + 1
      }
    })
    setUnread(unreadCounts)
    setLoading(false)
  }

  async function selectConversation(profile) {
    setSelected(profile)
    setText('')
    setShowGifPicker(false)
    await supabase.from('direct_messages').update({ read: true })
      .eq('from_uid', profile.id).eq('to_uid', user.id).eq('read', false)
    setUnread(u => ({ ...u, [profile.id]: 0 }))
  }

  async function sendMessage(imageUrl = null) {
    const trimmed = text.trim()
    if (!trimmed && !imageUrl) return
    setText('')
    setShowGifPicker(false)
    await supabase.from('direct_messages').insert({
      from_uid:  user.id,
      to_uid:    selected.id,
      text:      trimmed || null,
      image_url: imageUrl || null,
      read:      false,
    })
    // Notify recipient
    await supabase.from('notifications').insert({
      to_uid:     selected.id,
      type:       'dm',
      title:      `New message from ${user.name}`,
      body:       trimmed || '📷 Shared media',
      nav_target: 'dms',
      read:       false,
    })
  }

  async function sendGif(gifUrl) {
    setShowGifPicker(false)
    await supabase.from('direct_messages').insert({
      from_uid:  user.id,
      to_uid:    selected.id,
      text:      null,
      image_url: gifUrl,
      read:      false,
    })
    await supabase.from('notifications').insert({
      to_uid:     selected.id,
      type:       'dm',
      title:      `New message from ${user.name}`,
      body:       '🎞️ Sent a GIF',
      nav_target: 'dms',
      read:       false,
    })
  }

  async function loadGifs(q) {
    setGifsLoading(true)
    try {
      const url = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=g`
      const res  = await fetch(url)
      const data = await res.json()
      setGifs(data.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setGifsLoading(false)
    }
  }

  async function uploadAndSend(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }
    setUploading(true)
    try {
      const ext      = file.name ? file.name.split('.').pop() : 'png'
      const fileName = `dm-${user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
      await sendMessage(publicUrl)
    } catch {
      alert('Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleFileUpload(e) {
    const f = e.target.files[0]
    if (f) await uploadAndSend(f)
    e.target.value = ''
  }

  async function handlePaste(e) {
    const items     = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (file) await uploadAndSend(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
  }

  async function confirmDeleteMessage() {
    if (!confirmDelete) return
    await supabase.from('direct_messages').delete().eq('id', confirmDelete.id)
    setConversations(prev => ({
      ...prev,
      [confirmDelete.otherUid]: (prev[confirmDelete.otherUid] || []).filter(m => m.id !== confirmDelete.id)
    }))
    setConfirmDelete(null)
  }

  // ── Date divider label (same logic as Chat.jsx) ────────────────
  function formatDateDivider(dateString) {
    const d         = new Date(dateString)
    const today     = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString())     return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  function getSenderProfile(uid) {
    return allProfiles.find(p => p.id === uid) || { name: 'Teammate', ini: '??', role: 'member' }
  }

  if (loading) return <Spinner />

  const currentMsgs = selected ? (conversations[selected.id] || []) : []

  return (
    <>
      <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', background: 'var(--bg)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

        {/* ── Left Sidebar: Teammate List ── */}
        <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

          {/* Sidebar header */}
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Direct Messages
          </div>

          {/* Notification enable nudge */}
          {!notifEnabled && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={async () => { const ok = await requestNotificationPermission(); setNotifEnabled(ok) }}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🔔 Enable notifications
              </button>
            </div>
          )}

          {/* Teammate list */}
          <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {profiles.map(p => {
              const isSelected = selected?.id === p.id
              const uCount     = unread[p.id] || 0
              const msgs       = conversations[p.id] || []
              const last       = msgs[msgs.length - 1]
              const isAdm      = p.role === 'admin'

              return (
                <button
                  key={p.id}
                  onClick={() => selectConversation(p)}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8, background: isSelected ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                >
                  {/* Avatar with unread badge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: isAdm ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: isAdm ? '#fff' : '#1e40af', boxShadow: 'var(--shadow-sm)' }}>
                      {p.ini}
                    </div>
                    {uCount > 0 && (
                      <div style={{ position: 'absolute', top: -4, right: -4, background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '2px 5px', minWidth: 16, textAlign: 'center', lineHeight: 1.4 }}>
                        {uCount > 9 ? '9+' : uCount}
                      </div>
                    )}
                  </div>

                  {/* Name + preview */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: uCount > 0 ? 800 : 600, color: isSelected ? 'var(--primary)' : 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    {last && (
                      <div style={{ fontSize: 11, color: uCount > 0 ? 'var(--text-2)' : 'var(--text-4)', fontWeight: uCount > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {last.image_url && !last.text ? '📷 Image' : last.text}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right: Conversation Area ── */}
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>Select a teammate to message</div>
            <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Your conversations are private</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

            {/* Header bar (matches Chat.jsx header exactly) */}
            <div style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, boxShadow: 'var(--shadow-xs)', zIndex: 10, gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: selected.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: selected.role === 'admin' ? '#fff' : '#1e40af', boxShadow: 'var(--shadow-sm)' }}>
                {selected.ini}
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>
                {selected.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>Private message</span>
            </div>

            {/* Message Timeline (identical rendering pattern to Chat.jsx) */}
            <div
              ref={scrollRef}
              style={{ flex: 1, overflowY: 'auto', padding: '10px 24px 24px', display: 'flex', flexDirection: 'column' }}
              onClick={() => setShowGifPicker(false)}
            >
              {currentMsgs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginTop: 60 }}>
                  Start a conversation with {selected.name} 👋
                </div>
              )}

              {currentMsgs.map((m, index) => {
                const isMe        = m.from_uid === user.id
                const sender      = getSenderProfile(m.from_uid)
                const prevMessage = currentMsgs[index - 1]

                // Date divider: show when day changes
                const showDateDivider = !prevMessage ||
                  new Date(m.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString()

                // Message grouping: same sender within 5 minutes
                const isGrouped = !showDateDivider && prevMessage &&
                  prevMessage.from_uid === m.from_uid &&
                  (new Date(m.created_at) - new Date(prevMessage.created_at) < 300000)

                const activeHover = hoveredMsgId === m.id
                const canDelete   = isMe || user.role === 'admin'

                // Read receipt: only on the last message I sent
                const isLastFromMe = isMe && (
                  index === currentMsgs.length - 1 ||
                  currentMsgs.slice(index + 1).every(x => x.from_uid !== user.id)
                )

                return (
                  <div key={m.id || index} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

                    {/* Slack-style date divider pill */}
                    {showDateDivider && (
                      <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0 16px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                        <span style={{ padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, fontSize: 12, fontWeight: 700, color: 'var(--text-1)', margin: '0 16px', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)' }}>
                          {formatDateDivider(m.created_at)}
                        </span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                      </div>
                    )}

                    {/* Message row */}
                    <div
                      onMouseEnter={() => setHoveredMsgId(m.id)}
                      onMouseLeave={() => setHoveredMsgId(null)}
                      style={{ display: 'flex', gap: 14, width: '100%', position: 'relative', marginTop: isGrouped ? 2 : 16, padding: '4px 8px', borderRadius: 8, background: activeHover ? 'var(--surface-2)' : 'transparent', alignItems: 'flex-start', transition: 'background 0.1s' }}
                    >

                      {/* Left column: avatar or compact timestamp */}
                      <div style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginTop: isGrouped ? 0 : 2 }}>
                        {isGrouped ? (
                          activeHover && (
                            <span style={{ fontSize: 10, color: 'var(--text-4)', width: '100%', textAlign: 'center', marginTop: 8, fontWeight: 600 }}>
                              {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}
                            </span>
                          )
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: sender.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: sender.role === 'admin' ? '#fff' : '#1e40af', boxShadow: 'var(--shadow-sm)' }}>
                            {sender.ini}
                          </div>
                        )}
                      </div>

                      {/* Content block */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

                        {/* Name + timestamp (only on first in group) */}
                        {!isGrouped && (
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>
                              {isMe ? 'You' : sender.name}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }}>
                              {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        <div style={{ display: 'flex', width: '100%', position: 'relative', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%' }}>

                            {/* Message body (flat text, no bubble — matches Chat.jsx) */}
                            <div style={{ color: 'var(--text-1)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {m.image_url && (
                                <img
                                  src={m.image_url}
                                  alt="Shared"
                                  onClick={() => setLightbox(m.image_url)}
                                  style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12, display: 'block', cursor: 'zoom-in', objectFit: 'cover', marginBottom: m.text ? 8 : 0, boxShadow: 'var(--shadow-sm)' }}
                                />
                              )}
                              {m.text && <span>{m.text}</span>}
                            </div>

                            {/* Read receipt under last outgoing message */}
                            {isLastFromMe && (
                              <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 4, fontWeight: 500 }}>
                                {m.read ? '✓✓ Read' : '✓ Sent'}
                              </div>
                            )}
                          </div>

                          {/* Hover action toolbar (matches Chat.jsx position and style exactly) */}
                          {activeHover && canDelete && (
                            <div style={{ position: 'absolute', right: 12, top: -20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', padding: '2px', gap: 2, zIndex: 10 }}>
                              <button
                                onClick={() => setConfirmDelete({ id: m.id, otherUid: selected.id })}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#dc2626', padding: '6px 8px', borderRadius: 4 }}
                                title="Delete message"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input dock (identical structure to Chat.jsx) */}
            <div style={{ position: 'relative', padding: '16px 24px 24px', background: 'var(--bg)', flexShrink: 0 }}>

              {/* GIF Gallery overlay (matches Chat.jsx exactly) */}
              {showGifPicker && (
                <div style={{ position: 'absolute', bottom: '100%', left: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 -10px 40px rgba(0,0,0,0.1)', zIndex: 50 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Select a GIF</span>
                    <button onClick={() => setShowGifPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-4)' }}>×</button>
                  </div>
                  <input
                    value={gifSearch}
                    autoFocus
                    onChange={e => { setGifSearch(e.target.value); loadGifs(e.target.value) }}
                    placeholder="Search GIPHY..."
                    style={{ width: '100%', padding: '10px 16px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 14, background: 'var(--surface-2)', color: 'var(--text-1)', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                    {gifsLoading
                      ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20 }}><Spinner /></div>
                      : gifs.map(g => (
                          <img
                            key={g.id}
                            src={g.images?.fixed_height_small?.url}
                            alt="gif"
                            onClick={() => sendGif(g.images?.original?.url)}
                            style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '2px solid transparent', transition: 'border 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.border = '2px solid var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.border = '2px solid transparent'}
                          />
                        ))
                    }
                  </div>
                </div>
              )}

              {/* Input bar (pixel-matched to Chat.jsx) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>

                {/* Image upload button */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  title="Upload image"
                  style={{ width: 40, height: 40, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>

                {/* GIF button */}
                <button
                  onClick={() => { setShowGifPicker(!showGifPicker); if (!showGifPicker) loadGifs('') }}
                  style={{ height: 40, padding: '0 12px', borderRadius: 8, border: 'none', background: showGifPicker ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: showGifPicker ? 'var(--primary)' : 'var(--text-3)', transition: 'background 0.2s' }}
                  onMouseEnter={e => { if (!showGifPicker) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!showGifPicker) e.currentTarget.style.background = 'transparent' }}
                >
                  GIF
                </button>

                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />

                {/* Text input */}
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
                  onPaste={handlePaste}
                  placeholder={`Message ${selected.name}...`}
                  disabled={uploading}
                  style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', color: 'var(--text-1)', fontSize: 15, outline: 'none' }}
                />

                {/* Send button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={uploading || !text.trim()}
                  style={{ background: text.trim() ? 'var(--primary)' : 'var(--surface-3)', color: text.trim() ? '#fff' : 'var(--text-4)', border: 'none', borderRadius: 8, padding: '0 20px', height: 40, fontSize: 14, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox (matches Chat.jsx exactly) */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Preview" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Message"
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
