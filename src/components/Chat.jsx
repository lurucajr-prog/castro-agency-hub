import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner } from './shared'

export default function Chat({ user }) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const endRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages() {
    const [m, p] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(200),
      supabase.from('profiles').select('*'),
    ])
    setMessages(m.data || [])
    setProfiles(p.data || [])
    setLoading(false)
  }

  async function uploadAndSend(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }

    setUploading(true)
    const ext = file.name ? file.name.split('.').pop() : 'png'
    const fileName = `${user.id}-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file, { contentType: file.type })

    if (error) { alert('Upload failed. Please try again.'); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName)

    await supabase.from('messages').insert({
      uid: user.id,
      text: text.trim() || '',
      image_url: publicUrl,
    })
    setText('')
    setUploading(false)
  }

  async function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    await supabase.from('messages').insert({ uid: user.id, text: trimmed, image_url: null })
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
    if (file) {
      const namedFile = new File([file], `paste-${Date.now()}.png`, { type: file.type })
      await uploadAndSend(namedFile)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
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

  if (loading) return <Spinner />

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <div style={{ padding: '13px 18px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Team chat</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{profiles.length} members · Castro Agency</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>
              No messages yet. Say hello to the team! 👋
            </div>
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
            return (
              <div key={item.id} style={{ display: 'flex', gap: 9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: p.role === 'admin' ? R : '#dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af',
                }}>{p.ini}</div>
                <div style={{ maxWidth: '68%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{isMe ? 'You' : p.name}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{formatTime(item.created_at)}</span>
                  </div>
                  {item.image_url && (
                    <div style={{ marginBottom: item.text ? 6 : 0 }}>
                      <img
                        src={item.image_url}
                        alt="shared"
                        onClick={() => setLightbox(item.image_url)}
                        style={{
                          maxWidth: 260, maxHeight: 200, borderRadius: 10,
                          cursor: 'zoom-in', display: 'block',
                          border: '1px solid #e5e7eb', objectFit: 'cover',
                        }}
                      />
                    </div>
                  )}
                  {item.text && (
                    <div style={{
                      background: isMe ? N : '#f3f4f6',
                      color: isMe ? '#fff' : '#111',
                      padding: '9px 13px',
                      borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                      fontSize: 13, lineHeight: 1.55,
                    }}>{item.text}</div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          {uploading && (
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, paddingLeft: 4 }}>⏳ Uploading image…</div>
          )}
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Send an image"
              style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                border: '1px solid #e5e7eb', background: '#fff',
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, color: uploading ? '#d1d5db' : '#6b7280',
              }}
            >📎</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={onKey}
              onPaste={handlePaste}
              placeholder={uploading ? 'Uploading…' : 'Message the team… (or paste an image with Ctrl+V / ⌘+V)'}
              disabled={uploading}
              style={{
                flex: 1, fontSize: 13, padding: '9px 15px',
                border: '1px solid #e5e7eb', borderRadius: 22,
                background: '#f9fafb', color: '#111', outline: 'none',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={uploading}
              style={{
                background: uploading ? '#9ca3af' : N, color: '#fff', border: 'none',
                borderRadius: 22, padding: '9px 20px', fontSize: 13,
                fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >Send</button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, cursor: 'zoom-out', padding: 24,
          }}
        >
          <img src={lightbox} alt="full size" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}
