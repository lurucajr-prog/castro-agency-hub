import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner } from './shared'

// Request browser notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showNotification(title, body, onClick) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'castro-dm',
  })
  n.onclick = () => { window.focus(); n.close(); onClick?.() }
  setTimeout(() => n.close(), 6000)
}

export default function DirectMessages({ user, setPage }) {
  const [profiles, setProfiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [conversations, setConversations] = useState({})
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [unread, setUnread] = useState({})
  const [notifEnabled, setNotifEnabled] = useState(Notification?.permission === 'granted')
  const endRef = useRef(null)
  const fileRef = useRef(null)
  const selectedRef = useRef(null)

  // Keep selectedRef in sync so real-time handler can access it
  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('direct_messages_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        const msg = payload.new
        if (msg.from_uid === user.id || msg.to_uid === user.id) {
          const otherUid = msg.from_uid === user.id ? msg.to_uid : msg.from_uid
          setConversations(prev => ({
            ...prev,
            [otherUid]: [...(prev[otherUid] || []), msg],
          }))

          // Handle incoming messages (not from self)
          if (msg.from_uid !== user.id) {
            const currentSel = selectedRef.current
            if (currentSel?.id !== otherUid) {
              // Increment unread badge
              setUnread(u => ({ ...u, [otherUid]: (u[otherUid] || 0) + 1 }))

              // Show browser notification
              setProfiles(profs => {
                const sender = profs.find(p => p.id === msg.from_uid)
                if (sender) {
                  showNotification(
                    `New message from ${sender.name}`,
                    msg.image_url && !msg.text ? '📷 Sent an image' : msg.text,
                    () => setPage?.('dms')
                  )
                }
                return profs
              })
            }
          }
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, selected])

  async function fetchData() {
    const [p, msgs] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('direct_messages')
        .select('*')
        .or(`from_uid.eq.${user.id},to_uid.eq.${user.id}`)
        .order('created_at', { ascending: true }),
    ])
    setProfiles(p.data || [])

    const grouped = {}
    ;(msgs.data || []).forEach(m => {
      const otherUid = m.from_uid === user.id ? m.to_uid : m.from_uid
      if (!grouped[otherUid]) grouped[otherUid] = []
      grouped[otherUid].push(m)
    })
    setConversations(grouped)

    const unreadCounts = {}
    ;(msgs.data || []).forEach(m => {
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
    await supabase.from('direct_messages')
      .update({ read: true })
      .eq('from_uid', profile.id)
      .eq('to_uid', user.id)
      .eq('read', false)
    setUnread(u => ({ ...u, [profile.id]: 0 }))
  }

  async function sendMessage(imageUrl = null) {
    const trimmed = text.trim()
    if (!trimmed && !imageUrl) return
    setText('')
    await supabase.from('direct_messages').insert({
      from_uid: user.id,
      to_uid: selected.id,
      text: trimmed || '',
      image_url: imageUrl || null,
      read: false,
    })
  }

  async function uploadAndSend(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }
    setUploading(true)
    const ext = file.name ? file.name.split('.').pop() : 'png'
    const fileName = `dm-${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: file.type })
    if (error) { alert('Upload failed.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    await sendMessage(publicUrl)
    setUploading(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (file) await uploadAndSend(file)
    e.target.value = ''
  }

  async function handlePaste(e) {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (file) await uploadAndSend(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
  }

  async function deleteMessage(id, otherUid) {
    if (!window.confirm('Delete this message?')) return
    await supabase.from('direct_messages').delete().eq('id', id)
    setConversations(prev => ({
      ...prev,
      [otherUid]: (prev[otherUid] || []).filter(m => m.id !== id),
    }))
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setNotifEnabled(granted)
    if (!granted) alert('Notification permission was denied. You can enable it in your browser settings.')
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function formatTime(ts) {
    const d = new Date(ts)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (loading) return <Spinner />

  const teammates = profiles.filter(p => p.id !== user.id)
  const currentMsgs = selected ? (conversations[selected.id] || []) : []

  return (
    <>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 250, borderRight: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8 }}>Direct messages</div>
            {/* Notification toggle */}
            {!notifEnabled ? (
              <button
                onClick={enableNotifications}
                style={{ width: '100%', padding: '7px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: '#1e40af', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🔔 Enable notifications
              </button>
            ) : (
              <div style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
                Notifications on
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {teammates.map(p => {
              const msgs = conversations[p.id] || []
              const last = msgs[msgs.length - 1]
              const uCount = unread[p.id] || 0
              const isSelected = selected?.id === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => selectConversation(p)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f9fafb',
                    background: isSelected ? '#eff6ff' : '#fff',
                    borderLeft: isSelected ? `3px solid ${N}` : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: p.role === 'admin' ? R : '#dbeafe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af',
                      }}>{p.ini}</div>
                      <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: '#16a34a', border: '2px solid #fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: uCount > 0 ? 700 : 500, color: '#111' }}>{p.name}</span>
                        {uCount > 0 && (
                          <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}>{uCount}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: uCount > 0 ? '#374151' : '#9ca3af', fontWeight: uCount > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {last ? (last.image_url && !last.text ? '📷 Image' : last.text) : 'No messages yet'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Main conversation area */}
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>Select a teammate to message</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>Your conversations are private</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: selected.role === 'admin' ? R : '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: selected.role === 'admin' ? '#fff' : '#1e40af',
              }}>{selected.ini}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{selected.title} · Private message</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: '#f9fafb' }}>
              {currentMsgs.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>
                  Start a conversation with {selected.name} 👋
                </div>
              )}
              {currentMsgs.map((m, idx) => {
                const isMe = m.from_uid === user.id
                const sender = profiles.find(p => p.id === m.from_uid)
                const canDelete = isMe || user.role === 'admin'
                return (
                  <div
                    key={m.id || idx}
                    style={{ display: 'flex', gap: 9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}
                    onMouseEnter={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity = '1' }}
                    onMouseLeave={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity = '0' }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: sender?.role === 'admin' ? R : '#dbeafe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 600, color: sender?.role === 'admin' ? '#fff' : '#1e40af',
                    }}>{sender?.ini}</div>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{isMe ? 'You' : sender?.name}</span>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{formatTime(m.created_at)}</span>
                        {canDelete && (
                          <button className="del-btn" onClick={() => deleteMessage(m.id, selected.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#ef4444', opacity: 0, padding: 0, transition: 'opacity 0.1s' }}>🗑</button>
                        )}
                      </div>
                      {m.image_url && (
                        <div style={{ marginBottom: m.text ? 6 : 0 }}>
                          <img src={m.image_url} alt="shared" onClick={() => setLightbox(m.image_url)} style={{ maxWidth: 260, maxHeight: 200, borderRadius: 10, cursor: 'zoom-in', display: 'block', border: '1px solid #e5e7eb', objectFit: 'cover' }} />
                        </div>
                      )}
                      {m.text && (
                        <div style={{
                          background: isMe ? N : '#fff', color: isMe ? '#fff' : '#111',
                          padding: '9px 13px', borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                          fontSize: 13, lineHeight: 1.55, border: isMe ? 'none' : '1px solid #e5e7eb',
                        }}>{m.text}</div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
              {uploading && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5 }}>⏳ Uploading image…</div>}
              <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Send image" style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#6b7280', flexShrink: 0 }}>📎</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={onKey}
                  onPaste={handlePaste}
                  placeholder={`Message ${selected.name}… (or paste image with Ctrl+V)`}
                  disabled={uploading}
                  style={{ flex: 1, fontSize: 13, padding: '9px 15px', border: '1px solid #e5e7eb', borderRadius: 22, background: '#f9fafb', color: '#111', outline: 'none' }}
                />
                <button onClick={() => sendMessage()} disabled={uploading} style={{ background: N, color: '#fff', border: 'none', borderRadius: 22, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out', padding: 24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}
