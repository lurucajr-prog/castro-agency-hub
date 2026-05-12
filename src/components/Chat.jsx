import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner } from './shared'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '👏']

function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'castro-chat' })
  setTimeout(() => n.close(), 5000)
}

async function requestNotifPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export default function Chat({ user }) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [reactions, setReactions] = useState({})
  const [polls, setPolls] = useState({})
  const [pollVotes, setPollVotes] = useState({})
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [hoveredMsg, setHoveredMsg] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(null)
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [showPollForm, setShowPollForm] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [notifEnabled, setNotifEnabled] = useState(Notification?.permission === 'granted')
  const endRef = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    fetchAll()

    const msgChannel = supabase.channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        setMessages(prev => [...prev, msg])
        // @mention notification
        if (msg.uid !== user.id && msg.text) {
          const mentioned = profiles.find(p => msg.text.includes(`@${p.name}`) && p.id === user.id)
          if (mentioned) {
            const sender = profiles.find(p => p.id === msg.uid)
            showNotification(`${sender?.name || 'Someone'} mentioned you`, msg.text)
          }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()

    const rxChannel = supabase.channel('chat_reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.new
        setReactions(prev => { const m = { ...(prev[r.message_id] || {}) }; m[r.emoji] = [...(m[r.emoji] || []), r.uid]; return { ...prev, [r.message_id]: m } })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.old
        setReactions(prev => { const m = { ...(prev[r.message_id] || {}) }; m[r.emoji] = (m[r.emoji] || []).filter(u => u !== r.uid); if (!m[r.emoji]?.length) delete m[r.emoji]; return { ...prev, [r.message_id]: m } })
      })
      .subscribe()

    const voteChannel = supabase.channel('poll_votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' }, payload => {
        const v = payload.new
        setPollVotes(prev => { const p = { ...(prev[v.poll_id] || {}) }; p[v.option_index] = [...(p[v.option_index] || []), v.uid]; return { ...prev, [v.poll_id]: p } })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(rxChannel)
      supabase.removeChannel(voteChannel)
    }
  }, [profiles])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [text])

  async function fetchAll() {
    const [m, p, r, pls, pvs] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(200),
      supabase.from('profiles').select('*'),
      supabase.from('message_reactions').select('*'),
      supabase.from('polls').select('*'),
      supabase.from('poll_votes').select('*'),
    ])
    setMessages(m.data || [])
    setProfiles(p.data || [])

    const rx = {}
    ;(r.data || []).forEach(x => { if (!rx[x.message_id]) rx[x.message_id] = {}; if (!rx[x.message_id][x.emoji]) rx[x.message_id][x.emoji] = []; rx[x.message_id][x.emoji].push(x.uid) })
    setReactions(rx)

    const pm = {}
    ;(pls.data || []).forEach(pl => { pm[pl.id] = pl })
    setPolls(pm)

    const pv = {}
    ;(pvs.data || []).forEach(v => { if (!pv[v.poll_id]) pv[v.poll_id] = {}; if (!pv[v.poll_id][v.option_index]) pv[v.poll_id][v.option_index] = []; pv[v.poll_id][v.option_index].push(v.uid) })
    setPollVotes(pv)

    setLoading(false)
  }

  // Detect @mention while typing
  function handleTextChange(e) {
    const val = e.target.value
    setText(val)
    const match = val.match(/@(\w*)$/)
    if (match) {
      const q = match[1].toLowerCase()
      setMentionSuggestions(profiles.filter(p => p.id !== user.id && p.name.toLowerCase().startsWith(q)).slice(0, 5))
    } else {
      setMentionSuggestions([])
    }
  }

  function insertMention(profile) {
    const newText = text.replace(/@(\w*)$/, `@${profile.name} `)
    setText(newText)
    setMentionSuggestions([])
    textareaRef.current?.focus()
  }

  async function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    setMentionSuggestions([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await supabase.from('messages').insert({ uid: user.id, text: trimmed })
  }

  async function sendPoll() {
    const q = pollQuestion.trim()
    const opts = pollOptions.map(o => o.trim()).filter(Boolean)
    if (!q || opts.length < 2) return
    const { data: poll } = await supabase.from('polls').insert({ question: q, options: opts, created_by: user.id }).select().single()
    if (poll) {
      setPolls(prev => ({ ...prev, [poll.id]: poll }))
      await supabase.from('messages').insert({ uid: user.id, text: '', poll_id: poll.id })
    }
    setShowPollForm(false)
    setPollQuestion('')
    setPollOptions(['', ''])
  }

  async function vote(pollId, optionIndex) {
    const existing = Object.values(pollVotes[pollId] || {}).flat().includes(user.id)
    if (existing) return
    await supabase.from('poll_votes').insert({ poll_id: pollId, uid: user.id, option_index: optionIndex })
  }

  async function toggleReaction(messageId, emoji) {
    setShowEmojiPicker(null)
    const users = (reactions[messageId]?.[emoji]) || []
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
    if (error) { alert('Upload failed.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    await supabase.from('messages').insert({ uid: user.id, text: text.trim() || '', image_url: publicUrl })
    setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setUploading(false)
  }

  async function deleteMessage(id) {
    if (!window.confirm('Delete this message?')) return
    await supabase.from('messages').delete().eq('id', id)
  }

  async function handleImageUpload(e) { const f = e.target.files[0]; if (f) await uploadAndSend(f); e.target.value = '' }

  async function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    const f = item.getAsFile()
    if (f) await uploadAndSend(new File([f], `paste-${Date.now()}.png`, { type: f.type }))
  }

  function onKey(e) {
    if (mentionSuggestions.length > 0 && (e.key === 'Escape')) { setMentionSuggestions([]); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function getProfile(uid) { return profiles.find(p => p.id === uid) || { ini: '?', role: 'member', name: 'Unknown' } }
  function formatTime(ts) { return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
  function formatDate(ts) {
    const d = new Date(ts); const t = new Date(); const y = new Date(t); y.setDate(t.getDate() - 1)
    if (d.toDateString() === t.toDateString()) return 'Today'
    if (d.toDateString() === y.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Highlight @mentions in message text
  function renderText(txt) {
    if (!txt) return null
    const parts = txt.split(/(@\w[\w\s]*)/g)
    return parts.map((part, i) => {
      const isMe = part === `@${user.name}`
      const isMention = profiles.some(p => part === `@${p.name}`)
      if (isMention) return <span key={i} style={{ background: isMe ? '#fef9c3' : 'rgba(255,255,255,0.2)', color: isMe ? '#92400e' : 'inherit', borderRadius: 3, padding: '0 2px', fontWeight: 600 }}>{part}</span>
      return part
    })
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
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Team Chat</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{profiles.length} members · Castro Agency</div>
          </div>
          {!notifEnabled && (
            <button onClick={async () => { const ok = await requestNotifPermission(); setNotifEnabled(ok) }} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, color: '#1e40af', fontSize: 11, fontWeight: 500, padding: '5px 12px', cursor: 'pointer' }}>
              🔔 Enable @mention notifications
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
          onClick={() => { setShowEmojiPicker(null); setMentionSuggestions([]) }}>
          {grouped.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>No messages yet. Say hello to the team! 👋</div>}
          {grouped.map((item, idx) => {
            if (item.type === 'date') return (
              <div key={'d'+idx} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
              </div>
            )

            // Poll message
            if (item.poll_id && polls[item.poll_id]) {
              const poll = polls[item.poll_id]
              const votes = pollVotes[poll.id] || {}
              const totalVotes = Object.values(votes).flat().length
              const myVote = Object.entries(votes).find(([, uids]) => uids.includes(user.id))?.[0]
              const creator = getProfile(item.uid)
              return (
                <div key={item.id} style={{ maxWidth: 360, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: '#1e40af' }}>{creator.ini}</div>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{creator.name} · 📊 Poll</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 10 }}>{poll.question}</div>
                  {poll.options.map((opt, i) => {
                    const count = (votes[i] || []).length
                    const pct = totalVotes ? Math.round(count / totalVotes * 100) : 0
                    const isMyVote = myVote !== undefined && Number(myVote) === i
                    return (
                      <div key={i} onClick={() => !myVote && vote(poll.id, i)} style={{ marginBottom: 7, cursor: myVote ? 'default' : 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: isMyVote ? 600 : 400, color: isMyVote ? N : '#374151' }}>{isMyVote ? '✓ ' : ''}{opt}</span>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{count} · {pct}%</span>
                        </div>
                        <div style={{ height: 5, background: '#f3f4f6', borderRadius: 99 }}>
                          <div style={{ width: pct + '%', height: '100%', background: isMyVote ? N : '#d1d5db', borderRadius: 99, transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  {!myVote && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>Click an option to vote</div>}
                  {myVote !== undefined && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''} total</div>}
                </div>
              )
            }

            const isMe = item.uid === user.id
            const p = getProfile(item.uid)
            const canDelete = isMe || isAdmin
            const isHovered = hoveredMsg === item.id
            const msgR = reactions[item.id] || {}
            const hasR = Object.keys(msgR).length > 0

            return (
              <div key={item.id} onMouseEnter={() => setHoveredMsg(item.id)} onMouseLeave={() => setHoveredMsg(null)}
                style={{ display: 'flex', gap: 9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: p.role === 'admin' ? R : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af' }}>{p.ini}</div>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{isMe ? 'You' : p.name}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{formatTime(item.created_at)}</span>
                    {canDelete && isHovered && <button onClick={() => deleteMessage(item.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#ef4444', opacity: 0.7, padding: 0 }}>🗑</button>}
                  </div>
                  {item.image_url && <div style={{ marginBottom: item.text ? 6 : 0 }}><img src={item.image_url} alt="shared" onClick={() => setLightbox(item.image_url)} style={{ maxWidth: 260, maxHeight: 200, borderRadius: 10, cursor: 'zoom-in', display: 'block', border: '1px solid #e5e7eb', objectFit: 'cover' }} /></div>}
                  {item.text && (
                    <div style={{ background: isMe ? N : '#f3f4f6', color: isMe ? '#fff' : '#111', padding: '9px 13px', borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {renderText(item.text)}
                    </div>
                  )}
                  {hasR && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      {Object.entries(msgR).map(([emoji, uids]) => {
                        const iMine = uids.includes(user.id)
                        return (
                          <button key={emoji} onClick={e => { e.stopPropagation(); toggleReaction(item.id, emoji) }} title={uids.map(u => profiles.find(p=>p.id===u)?.name||'?').join(', ')}
                            style={{ padding: '2px 8px', borderRadius: 99, border: `1px solid ${iMine ? N : '#e5e7eb'}`, background: iMine ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 3 }}>
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
                            <button key={emoji} onClick={() => toggleReaction(item.id, emoji)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '2px 4px', borderRadius: 6 }}
                              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.3)'; e.currentTarget.style.background='#f3f4f6' }}
                              onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.background='none' }}>{emoji}</button>
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

        {/* Poll creation form */}
        {showPollForm && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 8 }}>Create a poll</div>
            <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question…" style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 13, marginBottom: 7, outline: 'none', background: '#fff' }} />
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                <input value={opt} onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o) }} placeholder={`Option ${i + 1}`} style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff' }} />
                {pollOptions.length > 2 && <button onClick={() => setPollOptions(o => o.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
              {pollOptions.length < 4 && <button onClick={() => setPollOptions(o => [...o, ''])} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>+ Add option</button>}
              <div style={{ flex: 1 }} />
              <button onClick={() => { setShowPollForm(false); setPollQuestion(''); setPollOptions(['','']) }} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={sendPoll} style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: N, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}>Post poll</button>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          {uploading && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>⏳ Uploading image…</div>}
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', position: 'relative' }}>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', flexShrink: 0 }}>📎</button>
            <button onClick={() => setShowPollForm(s => !s)} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${showPollForm ? N : '#e5e7eb'}`, background: showPollForm ? '#eff6ff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📊</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

            {/* @mention dropdown */}
            {mentionSuggestions.length > 0 && (
              <div style={{ position: 'absolute', bottom: '110%', left: 90, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 200, minWidth: 160, overflow: 'hidden' }}>
                {mentionSuggestions.map(p => (
                  <div key={p.id} onClick={() => insertMention(p)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.role === 'admin' ? R : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af' }}>{p.ini}</div>
                    {p.name}
                  </div>
                ))}
              </div>
            )}

            <textarea ref={textareaRef} value={text} onChange={handleTextChange} onKeyDown={onKey} onPaste={handlePaste}
              placeholder={uploading ? 'Uploading…' : 'Message the team… (type @ to mention someone)'}
              disabled={uploading} rows={1}
              style={{ flex: 1, fontSize: 13, padding: '9px 15px', border: '1px solid #e5e7eb', borderRadius: 18, background: '#f9fafb', color: '#111', outline: 'none', resize: 'none', overflow: 'auto', lineHeight: 1.5, fontFamily: 'inherit', minHeight: 38, maxHeight: 160 }} />
            <button onClick={sendMessage} disabled={uploading} style={{ background: N, color: '#fff', border: 'none', borderRadius: 18, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, height: 38 }}>Send</button>
          </div>
          <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 5, paddingLeft: 90 }}>Enter to send · Shift+Enter for new line · @ to mention</div>
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
