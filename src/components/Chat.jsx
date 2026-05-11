import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner } from './shared'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '👏']

export default function Chat({ user }) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [reactions, setReactions] = useState({})
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [hoveredMsg, setHoveredMsg] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(null)
  const endRef = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    fetchMessages()

    const msgChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()

    const rxChannel = supabase
      .channel('public:message_reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.new
        setReactions(prev => {
          const msgR = { ...(prev[r.message_id] || {}) }
          msgR[r.emoji] = [...(msgR[r.emoji] || []), r.uid]
          return { ...prev, [r.message_id]: msgR }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.old
        setReactions(prev => {
          const msgR = { ...(prev[r.message_id] || {}) }
          msgR[r.emoji] = (msgR[r.emoji] || []).filter(uid => uid !== r.uid)
          if (!msgR[r.emoji]?.length) delete msgR[r.emoji]
          return { ...prev, [r.message_id]: msgR }
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(rxChannel)
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [text])

  async function fetchMessages() {
    const [m, p, r] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(200),
      supabase.from('profiles').select('*'),
      supabase.from('message_reactions').select('*'),
    ])
    setMessages(m.data || [])
    setProfiles(p.data || [])
    const grouped = {}
    ;(r.data || []).forEach(rx => {
      if (!grouped[rx.message_id]) grouped[rx.message_id] = {}
      if (!grouped[rx.message_id][rx.emoji]) grouped[rx.message_id][rx.emoji] = []
      grouped[rx.message_id][rx.emoji].push(rx.uid)
    })
    setReactions(grouped)
    setLoading(false)
  }

  async function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await supabase.from('messages').insert({ uid: user.id, text: trimmed, image_url: null })
  }

  async function toggleReaction(messageId, emoji) {
    setShowEmojiPicker(null)
    const msgR = reactions[messageId] || {}
    const users = msgR[emoji] || []
    if (users.includes(user.id)) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('uid', user.id).eq('emoji', emoji)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, uid: user.id, emoji })
    }
  }

  async function uploadAndSend(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }
    setUploading(true)
    const ext = file.name ? file.name.split('.').pop() : 'png'
    const fileName = `${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: file.type })
    if (error) { alert('Upload failed. Please try again.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    await supabase.from('messages').insert({ uid: user.id, text: text.trim() || '', image_url: publicUrl })
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setUploading(false)
  }

  async function deleteMessage(id) {
    if (!window.confirm('Delete this message?')) return
    await supabase.from('messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (file) await uploadAndSend(file)
    e.target.value = ''
  }

  async function handlePaste(e) {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (file) await uploadAndSend(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
    // Shift+Enter naturally inserts a newline in textarea — no extra handling needed
  }

  function getProfile(uid) {
    return profiles.find(p => p.id === uid) || { ini: '?', role: 'member', name: 'Unknown' }
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function formatDate(ts) {
    const d = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const grouped = []
  let lastDate = null
  messages.forEach(m => {
    const date = new Date(m.created_at).toDateString()
    if (date !== lastDate) { grouped.push({ type: 'date', label: formatDate(m.created_at) }); lastDate = date }
    grouped.push({ type: 'msg', ...m })
  })

  const isAdmin = user.role === 'admin'

  if (loading) return <Spinner />

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <div style={{ padding: '13px 18px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Team Chat</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{profiles.length} members · Castro Agency</div>
        </div>

        {/* Messages */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
          onClick={() => setShowEmojiPicker(null)}
        >
          {grouped.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>No messages yet. Say hello to the team! 👋</div>
          )}
          {grouped.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={'d' + idx} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                  <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</span>
                  <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                </div>
              )
            }

            const isMe = item.uid === user.id
            const p = getProfile(item.uid)
            const canDelete = isMe || isAdmin
            const isHovered = hoveredMsg === item.id
            const msgReactions = reactions[item.id] || {}
            const hasReactions = Object.keys(msgReactions).length > 0

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredMsg(item.id)}
                onMouseLeave={() => setHoveredMsg(null)}
                style={{ display: 'flex', gap: 9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start', position: 'relative' }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: p.role === 'admin' ? R : '#dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af',
                }}>{p.ini}</div>

                <div style={{ maxWidth: '70%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{isMe ? 'You' : p.name}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{formatTime(item.created_at)}</span>
                    {canDelete && isHovered && (
                      <button onClick={() => deleteMessage(item.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#ef4444', opacity: 0.7, padding: 0 }}>🗑</button>
                    )}
                  </div>

                  {item.image_url && (
                    <div style={{ marginBottom: item.text ? 6 : 0 }}>
                      <img src={item.image_url} alt="shared" onClick={() => setLightbox(item.image_url)} style={{ maxWidth: 260, maxHeight: 200, borderRadius: 10, cursor: 'zoom-in', display: 'block', border: '1px solid #e5e7eb', objectFit: 'cover' }} />
                    </div>
                  )}

                  {item.text && (
                    <div style={{
                      background: isMe ? N : '#f3f4f6', color: isMe ? '#fff' : '#111',
                      padding: '9px 13px', borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                      fontSize: 13, lineHeight: 1.6,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>{item.text}</div>
                  )}

                  {hasReactions && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      {Object.entries(msgReactions).map(([emoji, uids]) => {
                        const iMine = uids.includes(user.id)
                        const reacters = uids.map(uid => profiles.find(p => p.id === uid)?.name || 'Someone').join(', ')
                        return (
                          <button key={emoji} onClick={e => { e.stopPropagation(); toggleReaction(item.id, emoji) }} title={reacters} style={{ padding: '2px 8px', borderRadius: 99, border: `1px solid ${iMine ? N : '#e5e7eb'}`, background: iMine ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 3 }}>
                            {emoji}<span style={{ fontSize: 11, fontWeight: 600, color: iMine ? N : '#6b7280' }}>{uids.length}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {isHovered && (
                    <div style={{ position: 'relative', marginTop: 4, display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <button onClick={e => { e.stopPropagation(); setShowEmojiPicker(showEmojiPicker === item.id ? null : item.id) }} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 99, padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>😊 +</button>
                      {showEmojiPicker === item.id && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '110%', [isMe ? 'right' : 'left']: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 10px', display: 'flex', gap: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100 }}>
                          {REACTION_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(item.id, emoji)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '2px 4px', borderRadius: 6 }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; e.currentTarget.style.background = '#f3f4f6' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'none' }}>{emoji}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          {uploading && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>⏳ Uploading image…</div>}
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Send an image" style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: uploading ? '#d1d5db' : '#6b7280', flexShrink: 0 }}>📎</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

            {/* Textarea instead of input — auto-resizes, supports Shift+Enter */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={onKey}
              onPaste={handlePaste}
              placeholder={uploading ? 'Uploading…' : 'Message the team… (Shift+Enter for new line)'}
              disabled={uploading}
              rows={1}
              style={{
                flex: 1, fontSize: 13, padding: '9px 15px',
                border: '1px solid #e5e7eb', borderRadius: 18,
                background: '#f9fafb', color: '#111', outline: 'none',
                resize: 'none', overflow: 'hidden', lineHeight: 1.5,
                fontFamily: 'inherit', minHeight: 38, maxHeight: 160,
                transition: 'height 0.1s ease',
              }}
            />

            <button onClick={sendMessage} disabled={uploading} style={{ background: uploading ? '#9ca3af' : N, color: '#fff', border: 'none', borderRadius: 18, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0, height: 38 }}>Send</button>
          </div>
          <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 5, paddingLeft: 47 }}>Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out', padding: 24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}
