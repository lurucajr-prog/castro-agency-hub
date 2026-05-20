// ============================================================
// Castro Agency Hub — Clean Team Chat Engine (Production Restructure)
// Place this file at: src/components/Chat.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner, ConfirmModal } from './shared'

const GIPHY_KEY       = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '👏', '💪', '🙌']
const TYPING_TIMEOUT  = 3000
const STALE_TYPING    = 6000

const CHANNELS = [
  { id: 'main',   label: 'Main Chat',   exclude: [] },
  { id: 'sales',  label: 'Sales Chat',  exclude: ['Tania', 'Evelyn'] },
  { id: 'office', label: 'Office Chat', exclude: ['Destiny', 'Aisha'] },
]

function canSee(userName, channelId) {
  const ch = CHANNELS.find(c => c.id === channelId)
  return ch ? !ch.exclude.includes(userName) : false
}

export default function Chat({ user }) {
  const [channel,            setChannel]            = useState(() => CHANNELS.filter(c => canSee(user.name, c.id))[0]?.id || 'main')
  const [messages,           setMessages]           = useState([])
  const [profiles,           setProfiles]           = useState([])
  const [reactions,          setReactions]          = useState({})
  const [loading,            setLoading]            = useState(true)
  const [text,               setText]               = useState('')
  const [uploading,          setUploading]          = useState(false)
  
  // UI Controls
  const [showGifPicker,      setShowGifPicker]      = useState(false)
  const [gifSearch,          setGifSearch]          = useState('')
  const [gifs,               setGifs]               = useState([])
  const [gifsLoading,        setGifsLoading]        = useState(false)
  const [lightbox,           setLightbox]           = useState(null)
  const [hoveredMsgId,       setHoveredMsgId]       = useState(null)
  const [activeEmojiPicker,  setActiveEmojiPicker]  = useState(null)
  const [editingMsgId,       setEditingMsgId]       = useState(null)
  const [editText,           setEditText]           = useState('')
  const [confirmDeleteMsg,   setConfirmDeleteMsg]   = useState(null)
  const [typingUsers,        setTypingUsers]        = useState([])

  const scrollRef       = useRef(null)
  const fileInputRef    = useRef(null)
  const isTypingRef     = useRef(false)
  const typingTimerRef  = useRef(null)
  const channelRef      = useRef(channel)

  useEffect(() => { channelRef.current = channel }, [channel])

  // Absolute immediate bottom anchoring on channel switch or message load
  const forceScrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    fetchStaticContext().then(() => {
      fetchChannelMessages()
    })

    // Listen to background typing signals
    const typingRt = supabase.channel('typing_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators' }, () => {
        syncTypingIndicators()
      }).subscribe()

    return () => {
      supabase.removeChannel(typingRt)
    }
  }, [])

  useEffect(() => {
    fetchChannelMessages()
    // Mark channel as read immediately
    supabase.from('channel_reads').upsert(
      { uid: user.id, channel, last_read_at: new Date().toISOString() },
      { onConflict: 'uid,channel' }
    )
  }, [channel])

  useEffect(() => {
    forceScrollToBottom()
  }, [messages])

  async function fetchStaticContext() {
    const { data } = await supabase.from('profiles').select('*')
    setProfiles(data || [])
  }

  async function fetchChannelMessages() {
    setLoading(true)
    const [msgRes, rxRes] = await Promise.all([
      supabase.from('messages').select('*').eq('channel', channel).order('created_at', { ascending: true }).limit(250),
      supabase.from('message_reactions').select('*')
    ])

    setMessages(msgRes.data || [])
    
    const rxMap = {}
    ;(rxRes.data || []).forEach(x => {
      if (!rxMap[x.message_id]) rxMap[x.message_id] = {}
      if (!rxMap[x.message_id][x.emoji]) rxMap[x.message_id][x.emoji] = []
      rxMap[x.message_id][x.emoji].push(x.uid)
    })
    setReactions(rxMap)
    setLoading(false)
    setTimeout(forceScrollToBottom, 50)
  }

  // Real-time listener binding orchestration
  useEffect(() => {
    const realTimeChannel = supabase.channel(`chat_engine_${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const item = payload.new
        setReactions(prev => {
          const base = { ...(prev[item.message_id] || {}) }
          base[item.emoji] = [...(base[item.emoji] || []), item.uid]
          return { ...prev, [item.message_id]: base }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, payload => {
        const item = payload.old
        setReactions(prev => {
          if (!prev[item.message_id]) return prev
          const base = { ...prev[item.message_id] }
          if (base[item.emoji]) {
            base[item.emoji] = base[item.emoji].filter(id => id !== item.uid)
            if (base[item.emoji].length === 0) delete base[item.emoji]
          }
          return { ...prev, [item.message_id]: base }
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(realTimeChannel)
    }
  }, [channel])

  async function syncTypingIndicators() {
    const threshold = new Date(Date.now() - STALE_TYPING).toISOString()
    const { data } = await supabase.from('typing_indicators').select('uid').eq('channel', channel).neq('uid', user.id).gte('updated_at', threshold)
    setTypingUsers(data || [])
  }

  async function handleTypingSignal() {
    if (!isTypingRef.current) {
      isTypingRef.current = true
      await supabase.from('typing_indicators').upsert({ uid: user.id, channel, updated_at: new Date().toISOString() }, { onConflict: 'uid,channel' })
    }
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(async () => {
      isTypingRef.current = false
      await supabase.from('typing_indicators').delete().eq('uid', user.id).eq('channel', channel)
    }, TYPING_TIMEOUT)
  }

  async function broadcastMessage(imageUrl = null) {
    const payloadText = text.trim()
    if (!payloadText && !imageUrl) return
    setText('')
    isTypingRef.current = false
    await supabase.from('typing_indicators').delete().eq('uid', user.id).eq('channel', channel)

    const { data, error } = await supabase.from('messages').insert({
      uid: user.id,
      text: payloadText || null,
      image_url: imageUrl || null,
      channel
    }).select().single()

    if (error) return

    // Inject alert counters instantly for everyone with structural channel clearance
    const alertList = profiles
      .filter(p => p.id !== user.id && canSee(p.name, channel))
      .map(p => ({
        to_uid: p.id,
        type: 'chat_alert',
        title: `New post in #${CHANNELS.find(c=>c.id===channel)?.label}`,
        body: payloadText || '📷 Shared an image',
        nav_target: 'chat',
        read: false
      }))

    if (alertList.length > 0) {
      await supabase.from('notifications').insert(alertList)
    }
  }

  async function triggerImageUpload(e) {
    const file = e.target.files[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const filePath = `chat-${user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('chat-images').upload(filePath, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath)
      await broadcastMessage(publicUrl)
    } catch (err) {
      alert('Upload disruption encountered.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function loadGiphySearch(q) {
    setGifsLoading(true)
    try {
      const targetUrl = q 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=16&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=16&rating=g`
      const res = await fetch(targetUrl)
      const out = await res.json()
      setGifs(out.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setGifsLoading(false)
    }
  }

  async function toggleQuickReaction(msgId, emoji) {
    setActiveEmojiPicker(null)
    const existing = reactions[msgId]?.[emoji] || []
    if (existing.includes(user.id)) {
      await supabase.from('message_reactions').delete().eq('message_id', msgId).eq('uid', user.id).eq('emoji', emoji)
    } else {
      await supabase.from('message_reactions').insert({ message_id: msgId, uid: user.id, emoji })
    }
  }

  async function executeMessageUpdate() {
    if (!editText.trim() || !editingMsgId) return
    await supabase.from('messages').update({ text: editText.trim(), edited: true, edited_at: new Date().toISOString() }).eq('id', editingMsgId)
    setEditingMsgId(null)
    setEditText('')
  }

  async function executeMessageRemoval() {
    if (!confirmDeleteMsg) return
    await supabase.from('messages').delete().eq('id', confirmDeleteMsg.id)
    setConfirmDeleteMsg(null)
  }

  function getSenderProfile(uid) {
    return profiles.find(p => p.id === uid) || { name: 'Teammate', ini: '??', role: 'member' }
  }

  if (loading && messages.length === 0) return <Spinner />

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', background: 'var(--bg)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      
      {/* Channels List Pane */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Office Channels
        </div>
        <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {CHANNELS.filter(c => canSee(user.name, c.id)).map(ch => {
            const isTarget = channel === ch.id
            return (
              <button key={ch.id} onClick={() => setChannel(ch.id)} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8, background: isTarget ? 'var(--primary-light)' : 'transparent', color: isTarget ? 'var(--primary)' : 'var(--text-2)', fontSize: 13, fontWeight: isTarget ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <span style={{ marginRight: 8, opacity: 0.6, fontSize: 14 }}>#</span>
                {ch.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Primary Message Frame */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        
        {/* Channel Header */}
        <div style={{ height: 52, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
            #{CHANNELS.find(c => c.id === channel)?.label}
          </span>
        </div>

        {/* Scrollable Feed Core */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }} onClick={() => { setActiveEmojiPicker(null); setShowGifPicker(false); }}>
          {messages.map((m, index) => {
            const isMe = m.uid === user.id
            const sender = getSenderProfile(m.uid)
            
            // Modern Message Grouping Algorithm (5 min boundary)
            const prevMessage = messages[index - 1]
            const isGrouped = prevMessage && 
                              prevMessage.uid === m.uid && 
                              (new Date(m.created_at) - new Date(prevMessage.created_at) < 300000)

            const activeHover = hoveredMsgId === m.id
            const activeEdit = editingMsgId === m.id
            const itemRx = reactions[m.id] || {}

            return (
              <div key={m.id} onMouseEnter={() => setHoveredMsgId(m.id)} onMouseLeave={() => setHoveredMsgId(null)} style={{ display: 'flex', gap: 12, width: '100%', position: 'relative', marginTop: isGrouped ? 2 : 12, padding: '4px 8px', borderRadius: 6, background: activeHover ? 'rgba(0,0,0,0.015)' : 'transparent', flexDirection: 'row', alignItems: 'flex-start' }}>
                
                {/* Avatar Display Logic */}
                <div style={{ width: 36, height: 36, flexShrink: 0 }}>
                  {!isGrouped && (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: sender.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: sender.role === 'admin' ? '#fff' : '#1e40af' }}>
                      {sender.ini}
                    </div>
                  )}
                </div>

                {/* Content Core Block */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!isGrouped && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{sender.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                        {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', width: '100%', position: 'relative', alignItems: 'flex-end', gap: 8 }}>
                    {activeEdit ? (
                      <div style={{ width: '100%', background: 'var(--surface)', padding: 8, borderRadius: 8, border: '1px solid var(--primary-mid)' }}>
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); executeMessageUpdate() } }} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', resize: 'none', color: 'var(--text-1)', fontSize: 13, fontFamily: 'inherit' }} />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                          <button onClick={() => setEditingMsgId(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--text-3)', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={executeMessageUpdate} style={{ background: N, color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-block', position: 'relative', maxWidth: '85%' }}>
                        
                        {/* Core Message Bubble UI */}
                        <div style={{ background: isMe ? 'var(--primary-light)' : 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: 12, padding: m.text ? '8px 14px' : '4px', boxShadow: 'var(--shadow-xs)' }}>
                          {m.image_url && (
                            <img src={m.image_url} alt="Shared" onClick={() => setLightbox(m.image_url)} style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, display: 'block', cursor: 'zoom-in', objectFit: 'cover' }} />
                          )}
                          {m.text && <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>}
                        </div>

                        {/* Anchored Overlapping Reactions row */}
                        {Object.keys(itemRx).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: -6, marginLeft: 8, position: 'relative', zIndex: 2, flexWrap: 'wrap' }}>
                            {Object.entries(itemRx).map(([emoji, uids]) => {
                              const typedByMe = uids.includes(user.id)
                              return (
                                <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleQuickReaction(m.id, emoji) }} style={{ display: 'flex', alignItems: 'center', gap: 4, background: typedByMe ? 'var(--primary-mid)' : 'var(--surface-2)', border: `1px solid ${typedByMe ? 'var(--primary)' : 'var(--border)'}`, padding: '1px 6px', borderRadius: 99, cursor: 'pointer', fontSize: 11 }}>
                                  <span>{emoji}</span>
                                  <span style={{ fontWeight: 600, color: typedByMe ? 'var(--primary)' : 'var(--text-3)' }}>{uids.length}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Integrated Enterprise Hover Toolbar Card */}
                    {activeHover && !activeEdit && (
                      <div style={{ position: 'absolute', right: 12, top: -24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow-md)', display: 'flex', padding: '2px 6px', gap: 2, zIndex: 10 }}>
                        <button onClick={(e) => { e.stopPropagation(); setActiveEmojiPicker(activeEmojiPicker === m.id ? null : m.id) }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: '4px 6px', borderRadius: '50%' }} title="Add reaction">😊</button>
                        {isMe && m.text && <button onClick={() => { setEditingMsgId(m.id); setEditText(m.text) }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: '4px 6px' }} title="Edit post">✏️</button>}
                        {(isMe || isAdmin) && <button onClick={() => setConfirmDeleteMsg(m)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', padding: '4px 6px' }} title="Delete post">🗑️</button>}
                        
                        {/* Quick Action Picker Dropdown */}
                        {activeEmojiPicker === m.id && (
                          <div style={{ position: 'absolute', bottom: '115%', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, display: 'flex', gap: 4, boxShadow: 'var(--shadow-lg)', zIndex: 99 }}>
                            {REACTION_EMOJIS.map(emoji => (
                              <button key={emoji} onClick={() => toggleQuickReaction(m.id, emoji)} style={{ border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', padding: 4, borderRadius: 6 }} onMouseEnter={e => e.currentTarget.style.background='var(--surface-3)'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Typing Overlay banner */}
        {typingUsers.length > 0 && (
          <div style={{ position: 'absolute', bottom: 64, left: 24, fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', gap: 2 }}><div className="dot" /><div className="dot" /><div className="dot" /></div>
            <span>{typingUsers.length === 1 ? 'Someone is' : 'Multiple agents are'} typing...</span>
            <style>{`.dot{width:4px;height:4px;background:#9ca3af;border-radius:50%;animation:bounce 1.4s infinite alternate}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-4px)}}`}</style>
          </div>
        )}

        {/* Input Dock Module */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          
          {/* Floating dynamic inline GIF gallery */}
          {showGifPicker && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 10, boxShadow: 'var(--shadow-md)' }}>
              <input value={gifSearch} onChange={e => { setGifSearch(e.target.value); loadGiphySearch(e.target.value) }} placeholder="Search dynamic GIPHY stream..." style={{ width: '100%', padding: '6px 12px', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, background: 'var(--bg)', color: 'var(--text-1)', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                {gifsLoading ? <Spinner /> : gifs.map(g => (
                  <img key={g.id} src={g.images?.fixed_height_small?.url} alt="gif" onClick={() => { sendGif(g.images?.original?.url); setShowGifPicker(false); }} style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }} title="Share photograph">📷</button>
            <button onClick={() => { setShowGifPicker(!showGifPicker); if(!showGifPicker) loadGiphySearch('') }} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${showGifPicker ? 'var(--primary)' : 'var(--border)'}`, background: showGifPicker ? 'var(--primary-light)' : 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: showGifPicker ? 'var(--primary)' : 'var(--text-3)', flexShrink: 0 }}>GIF</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={triggerImageUpload} />

            <input value={text} onChange={e => { setText(e.target.value); handleTypingSignal() }} onKeyDown={e => { if (e.key === 'Enter') broadcastMessage() }} placeholder={`Write into #${CHANNELS.find(c=>c.id===channel)?.label}...`} disabled={uploading} style={{ flex: 1, padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 13, outline: 'none' }} />
            <button onClick={() => broadcastMessage()} disabled={uploading || !text.trim()} style={{ background: N, color: '#fff', border: 'none', borderRadius: 20, padding: '0 20px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!text.trim()) ? 0.5 : 1 }}>Send</button>
          </div>
        </div>

      </div>

      {/* Lightbox Overlay */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Preview" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      {/* Confirmation Modals */}
      {confirmDeleteMsg && (
        <ConfirmModal title="Remove post permanently?" message="This transaction will clear this log entry for all office views instantly." confirmLabel="Delete" danger onConfirm={executeMessageRemoval} onCancel={() => setConfirmDeleteMsg(null)} />
      )}
    </div>
  )
}
