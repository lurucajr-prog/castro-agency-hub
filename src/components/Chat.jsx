import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner } from './shared'

export default function Chat({ user }) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const endRef = useRef(null)

  useEffect(() => {
    fetchMessages()

    // Real-time subscription
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

  async function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    await supabase.from('messages').insert({ uid: user.id, text: trimmed })
    // Real-time will pick it up automatically
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

  // Group messages by date
  const grouped = []
  let lastDate = null
  messages.forEach(m => {
    const date = new Date(m.created_at).toDateString()
    if (date !== lastDate) { grouped.push({ type: 'date', label: formatDate(m.created_at) }); lastDate = date }
    grouped.push({ type: 'msg', ...m })
  })

  if (loading) return <Spinner />

  return (
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
                <div style={{
                  background: isMe ? N : '#f3f4f6',
                  color: isMe ? '#fff' : '#111',
                  padding: '9px 13px',
                  borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                  fontSize: 13, lineHeight: 1.55,
                }}>{item.text}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 9, background: '#fff', flexShrink: 0 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Message the team…"
          style={{
            flex: 1, fontSize: 13, padding: '9px 15px',
            border: '1px solid #e5e7eb', borderRadius: 22,
            background: '#f9fafb', color: '#111', outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            background: N, color: '#fff', border: 'none',
            borderRadius: 22, padding: '9px 20px', fontSize: 13,
            fontWeight: 500, cursor: 'pointer',
          }}
        >Send</button>
      </div>
    </div>
  )
}
