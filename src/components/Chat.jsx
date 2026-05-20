// ============================================================
// Castro Agency Hub — Enterprise Team Chat Engine
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

export default function Chat({ user, chatChannel, onChatChannelConsumed }) {
  const isAdmin = user.role === 'admin'

  // ── Core State ────────────────────────────────────────────────
  const [channel,            setChannel]            = useState(() => CHANNELS.filter(c => canSee(user.name, c.id))[0]?.id || 'main')
  const [messages,           setMessages]           = useState([])
  const [profiles,           setProfiles]           = useState([])
  const [reactions,          setReactions]          = useState({})
  const [loading,            setLoading]            = useState(true)
  const [text,               setText]               = useState('')
  const [uploading,          setUploading]          = useState(false)
  
  // UI Panels & Picker Controls
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
  const [showPinned,         setShowPinned]         = useState(false)

  const scrollRef       = useRef(null)
  const fileInputRef    = useRef(null)
  const isTypingRef     = useRef(false)
  const typingTimerRef  = useRef(null)
  const channelRef      = useRef(channel)

  useEffect(() => { channelRef.current = channel }, [channel])

  // ── Handle external channel navigation (from notification click) ──
  useEffect(() => {
    if (chatChannel && canSee(user.name, chatChannel)) {
      setChannel(chatChannel)
      onChatChannelConsumed?.()
    }
  }, [chatChannel])

  const forceScrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    fetchStaticContext().then(() => fetchChannelMessages())

    const typingRt = supabase.channel('typing_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators' }, () => {
        syncTypingIndicators()
      }).subscribe()

    return () => supabase.removeChannel(typingRt)
  }, [])

  useEffect(() => {
    fetchChannelMessages()
    setShowPinned(false)
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
    setShowGifPicker(false)
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
    setTimeout(forceScrollToBottom, 60)
  }

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

    return () => supabase.removeChannel(realTimeChannel)
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
    setShowGifPicker(false)
    isTypingRef.current = false
    await supabase.from('typing_indicators').delete().eq('uid', user.id).eq('channel', channel)

    const { error } = await supabase.from('messages').insert({
      uid: user.id,
      text: payloadText || '',
      image_url: imageUrl || null,
      channel
    })

    if (error) return

    const alertList = profiles
      .filter(p => p.id !== user.id && canSee(p.name, channel))
      .map(p => ({
        to_uid: p.id,
        type: 'chat_alert',
        title: `New post in #${CHANNELS.find(c => c.id === channel)?.label}`,
        body: payloadText || '📷 Shared media',
        nav_target: 'chat',
        nav_channel: channel,
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
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=g`
      const res = await fetch(targetUrl)
      const out = await res.json()
      setGifs(out.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setGifsLoading(false)
    }
  }

  async function sendGif(gifUrl) {
    await broadcastMessage(gifUrl)
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

  async function togglePin(m) {
    await supabase.from('messages').update({ is_pinned: !m.is_pinned }).eq('id', m.id)
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

  function formatDateDivider(dateString) {
    const d = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  if (loading && messages.length === 0) return <Spinner />

  const pinnedMessages = messages.filter(m => m.is_pinned)

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', background: 'var(--bg)', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      
      {/* Channels Sidebar */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Office Channels
        </div>
        <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CHANNELS.filter(c => canSee(user.name, c.id)).map(ch => {
            const isTarget = channel === ch.id
            return (
              <button key={ch.id} onClick={() => setChannel(ch.id)} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '12px 14px', border: 'none', borderRadius: 8, background: isTarget ? 'var(--primary-light)' : 'transparent', color: isTarget ? 'var(--primary)' : 'var(--text-2)', fontSize: 14, fontWeight: isTarget ? 700 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <span style={{ marginRight: 10, opacity: 0.7, fontSize: 16 }}>#</span>
                {ch.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, boxShadow: 'var(--shadow-xs)', zIndex: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>
            #{CHANNELS.find(c => c.id === channel)?.label}
          </span>
        </div>

        {/* Pinned Messages Banner */}
        {pinnedMessages.length > 0 && (
          <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow-sm)', zIndex: 5, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowPinned(!showPinned)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 13, fontWeight: 700 }}>
                <span>📌</span> {pinnedMessages.length} Pinned Message{pinnedMessages.length > 1 ? 's' : ''}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>{showPinned ? 'HIDE' : 'VIEW'}</span>
            </div>
            {showPinned && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                {pinnedMessages.map(pm => {
                  const pSender = getSenderProfile(pm.uid)
                  return (
                    <div key={pm.id} style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{pSender.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{new Date(pm.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 60, overflow: 'hidden' }}>
                        {pm.text || '📷 Shared media'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => togglePin(pm)} style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', cursor: 'pointer' }}>Unpin</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Message Timeline */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 24px 24px', display: 'flex', flexDirection: 'column' }} onClick={() => { setActiveEmojiPicker(null); setShowGifPicker(false) }}>
          {messages.map((m, index) => {
            const isMe = m.uid === user.id
            const sender = getSenderProfile(m.uid)
            const prevMessage = messages[index - 1]
            
            const showDateDivider = !prevMessage || new Date(m.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString()
            const isGrouped = !showDateDivider && prevMessage && 
                              prevMessage.uid === m.uid && 
                              (new Date(m.created_at) - new Date(prevMessage.created_at) < 300000)

            const activeHover = hoveredMsgId === m.id
            const activeEdit = editingMsgId === m.id
            const itemRx = reactions[m.id] || {}

            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                
                {/* Date Divider */}
                {showDateDivider && (
                  <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0 16px 0', position: 'relative' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{ padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, fontSize: 12, fontWeight: 700, color: 'var(--text-1)', margin: '0 16px', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)' }}>
                      {formatDateDivider(m.created_at)}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>
                )}

                {/* Message Row */}
                <div onMouseEnter={() => setHoveredMsgId(m.id)} onMouseLeave={() => setHoveredMsgId(null)} style={{ display: 'flex', gap: 14, width: '100%', position: 'relative', marginTop: isGrouped ? 2 : 16, padding: '4px 8px', borderRadius: 8, background: activeHover ? 'var(--surface-2)' : 'transparent', alignItems: 'flex-start', transition: 'background 0.1s' }}>
                  
                  {/* Avatar or compact time */}
                  <div style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginTop: isGrouped ? 0 : 2 }}>
                    {isGrouped ? (
                      activeHover && (
                        <span style={{ fontSize: 10, color: 'var(--text-4)', width: '100%', textAlign: 'center', marginTop: 8, fontWeight: 600 }}>
                          {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}
                        </span>
                      )
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#1e40af', boxShadow: 'var(--shadow-sm)' }}>
                        {sender.ini}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    {!isGrouped && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{sender.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }}>
                          {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        {m.is_pinned && <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginLeft: 4 }}>📌 Pinned</span>}
                      </div>
                    )}

                    <div style={{ display: 'flex', width: '100%', position: 'relative', alignItems: 'flex-start', gap: 8 }}>
                      {activeEdit ? (
                        <div style={{ width: '100%', maxWidth: '85%', background: 'var(--surface)', padding: 12, borderRadius: 12, border: '2px solid var(--primary-mid)', boxShadow: 'var(--shadow-sm)' }}>
                          <textarea value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); executeMessageUpdate() } }} style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', resize: 'none', color: 'var(--text-1)', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5 }} />
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button onClick={() => setEditingMsgId(null)} style={{ background: 'var(--surface-3)', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={executeMessageUpdate} style={{ background: N, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%' }}>
                          <div style={{ color: 'var(--text-1)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingTop: m.text ? 2 : 0 }}>
                            {m.image_url && (
                              <img src={m.image_url} alt="Shared" onClick={() => setLightbox(m.image_url)} style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12, display: 'block', cursor: 'zoom-in', objectFit: 'cover', marginBottom: m.text ? 8 : 0, boxShadow: 'var(--shadow-sm)' }} />
                            )}
                            {m.text && <span>{m.text}</span>}
                            {m.edited && <span style={{ fontSize: 10, color: 'var(--text-4)', marginLeft: 6 }}>(edited)</span>}
                          </div>

                          {/* Reactions */}
                          {Object.keys(itemRx).length > 0 && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                              {Object.entries(itemRx).map(([emoji, uids]) => {
                                const typedByMe = uids.includes(user.id)
                                return (
                                  <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleQuickReaction(m.id, emoji) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: typedByMe ? 'var(--primary-light)' : 'var(--surface)', border: `1px solid ${typedByMe ? 'var(--primary-mid)' : 'var(--border)'}`, padding: '4px 8px', borderRadius: 16, cursor: 'pointer', fontSize: 13, boxShadow: 'var(--shadow-xs)', transition: 'all 0.1s' }}>
                                    <span>{emoji}</span>
                                    <span style={{ fontWeight: 700, color: typedByMe ? 'var(--primary)' : 'var(--text-3)', fontSize: 12 }}>{uids.length}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Hover Toolbar */}
                      {activeHover && !activeEdit && (
                        <div style={{ position: 'absolute', right: 12, top: -20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', padding: '2px', gap: 2, zIndex: 10 }}>
                          <button onClick={(e) => { e.stopPropagation(); togglePin(m) }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 8px', borderRadius: 4 }} title={m.is_pinned ? 'Unpin message' : 'Pin message'}>📌</button>
                          <button onClick={(e) => { e.stopPropagation(); setActiveEmojiPicker(activeEmojiPicker === m.id ? null : m.id) }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 8px', borderRadius: 4 }} title="Add reaction">😊</button>
                          {isMe && m.text && <button onClick={() => { setEditingMsgId(m.id); setEditText(m.text) }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 8px', borderRadius: 4 }} title="Edit post">✏️</button>}
                          {(isMe || isAdmin) && <button onClick={() => setConfirmDeleteMsg(m)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#dc2626', padding: '6px 8px', borderRadius: 4 }} title="Delete post">🗑️</button>}
                          
                          {/* Emoji picker dropdown */}
                          {activeEmojiPicker === m.id && (
                            <div style={{ position: 'absolute', bottom: '120%', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, display: 'flex', gap: 4, boxShadow: 'var(--shadow-lg)', zIndex: 99 }}>
                              {REACTION_EMOJIS.map(emoji => (
                                <button key={emoji} onClick={() => toggleQuickReaction(m.id, emoji)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'transform 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.transform = 'scale(1.1)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'scale(1)' }}>
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
              </div>
            )
          })}
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div style={{ position: 'absolute', bottom: 76, left: 24, fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 3 }}><div className="dot" /><div className="dot" /><div className="dot" /></div>
            <span style={{ fontWeight: 500 }}>{typingUsers.length === 1 ? 'Someone is' : 'Multiple agents are'} typing...</span>
            <style>{`.dot{width:5px;height:5px;background:#9ca3af;border-radius:50%;animation:bounce 1.4s infinite alternate}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-5px)}}`}</style>
          </div>
        )}

        {/* Input Dock */}
        <div style={{ position: 'relative', padding: '16px 24px 24px', background: 'var(--bg)', flexShrink: 0 }}>
          
          {/* GIF Gallery */}
          {showGifPicker && (
            <div style={{ position: 'absolute', bottom: '100%', left: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 -10px 40px rgba(0,0,0,0.1)', zIndex: 50 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Select a GIF</span>
                <button onClick={() => setShowGifPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-4)' }}>×</button>
              </div>
              <input value={gifSearch} autoFocus onChange={e => { setGifSearch(e.target.value); loadGiphySearch(e.target.value) }} placeholder="Search GIPHY..." style={{ width: '100%', padding: '10px 16px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 14, background: 'var(--surface-2)', color: 'var(--text-1)', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {gifsLoading ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20 }}><Spinner /></div> : gifs.map(g => (
                  <img key={g.id} src={g.images?.fixed_height_small?.url} alt="gif" onClick={() => { sendGif(g.images?.original?.url); setShowGifPicker(false) }} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '2px solid transparent', transition: 'border 0.2s' }} onMouseEnter={e => e.currentTarget.style.border = '2px solid var(--primary)'} onMouseLeave={e => e.currentTarget.style.border = '2px solid transparent'} />
                ))}
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: 40, height: 40, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-3)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Upload image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </button>
            <button onClick={() => { setShowGifPicker(!showGifPicker); if (!showGifPicker) loadGiphySearch('') }} style={{ height: 40, padding: '0 12px', borderRadius: 8, border: 'none', background: showGifPicker ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: showGifPicker ? 'var(--primary)' : 'var(--text-3)', transition: 'background 0.2s' }} onMouseEnter={e => { if (!showGifPicker) e.currentTarget.style.background = 'var(--surface-2)' }} onMouseLeave={e => { if (!showGifPicker) e.currentTarget.style.background = 'transparent' }}>
              GIF
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={triggerImageUpload} />
            <input value={text} onChange={e => { setText(e.target.value); handleTypingSignal() }} onKeyDown={e => { if (e.key === 'Enter') broadcastMessage() }} placeholder={`Message #${CHANNELS.find(c => c.id === channel)?.label}...`} disabled={uploading} style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', color: 'var(--text-1)', fontSize: 15, outline: 'none' }} />
            <button onClick={() => broadcastMessage()} disabled={uploading || !text.trim()} style={{ background: text.trim() ? 'var(--primary)' : 'var(--surface-3)', color: text.trim() ? '#fff' : 'var(--text-4)', border: 'none', borderRadius: 8, padding: '0 20px', height: 40, fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Preview" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
        </div>
      )}

      {/* Confirm delete */}
      {confirmDeleteMsg && (
        <ConfirmModal title="Delete Message" message="Are you sure you want to delete this message? This action cannot be undone for the team." confirmLabel="Delete" danger onConfirm={executeMessageRemoval} onCancel={() => setConfirmDeleteMsg(null)} />
      )}
    </div>
  )
}
