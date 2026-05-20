// ============================================================
// Castro Agency Hub — Enterprise Team Chat Engine (Full Media Enabled)
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner, ConfirmModal, Btn } from './shared'

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
  const isAdmin = user.role === 'admin'
  const [channel, setChannel] = useState(() => CHANNELS.filter(c => canSee(user.name, c.id))[0]?.id || 'main')
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [reactions, setReactions] = useState({})
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState([])
  const [gifsLoading, setGifsLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  const [activeEmojiPicker, setActiveEmojiPicker] = useState(null)
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const [showPinned, setShowPinned] = useState(false)

  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const isTypingRef = useRef(false)
  const typingTimerRef = useRef(null)

  const forceScrollToBottom = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }

  useEffect(() => {
    fetchStaticContext().then(() => fetchChannelMessages())
    const typingRt = supabase.channel('typing_global').on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators' }, () => syncTypingIndicators()).subscribe()
    return () => supabase.removeChannel(typingRt)
  }, [])

  useEffect(() => {
    fetchChannelMessages()
    setShowPinned(false)
    supabase.from('channel_reads').upsert({ uid: user.id, channel, last_read_at: new Date().toISOString() }, { onConflict: 'uid,channel' })
  }, [channel])

  useEffect(() => { forceScrollToBottom() }, [messages])

  async function fetchStaticContext() { const { data } = await supabase.from('profiles').select('*'); setProfiles(data || []) }

  async function fetchChannelMessages() {
    setLoading(true)
    const [msgRes, rxRes] = await Promise.all([
      supabase.from('messages').select('*').eq('channel', channel).order('created_at', { ascending: true }),
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

  // Real-time bindings
  useEffect(() => {
    const rc = supabase.channel(`chat_engine_${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` }, p => setMessages(prev => [...prev, p.new]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` }, p => setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` }, p => setMessages(prev => prev.filter(m => m.id !== p.old.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, p => {
        setReactions(prev => { const b = { ...(prev[p.new.message_id] || {}) }; b[p.new.emoji] = [...(b[p.new.emoji] || []), p.new.uid]; return { ...prev, [p.new.message_id]: b } })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, p => {
        setReactions(prev => {
          if (!prev[p.old.message_id]) return prev
          const b = { ...prev[p.old.message_id] }
          if (b[p.old.emoji]) { b[p.old.emoji] = b[p.old.emoji].filter(id => id !== p.old.uid); if (b[p.old.emoji].length === 0) delete b[p.old.emoji] }
          return { ...prev, [p.old.message_id]: b }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(rc)
  }, [channel])

  async function broadcastMessage(imageUrl = null) {
    const payloadText = text.trim()
    if (!payloadText && !imageUrl) return
    setText(''); isTypingRef.current = false;
    await supabase.from('typing_indicators').delete().eq('uid', user.id).eq('channel', channel)
    await supabase.from('messages').insert({ uid: user.id, text: payloadText || null, image_url: imageUrl || null, channel })
    const alertList = profiles.filter(p => p.id !== user.id && canSee(p.name, channel)).map(p => ({ to_uid: p.id, type: 'chat_alert', title: `New in #${CHANNELS.find(c=>c.id===channel)?.label}`, body: payloadText || '📷 Media', nav_target: 'chat', read: false }))
    if (alertList.length > 0) await supabase.from('notifications').insert(alertList)
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
    } catch (err) { alert('Upload failed') } finally { setUploading(false); e.target.value = '' }
  }

  async function loadGiphySearch(q) {
    setGifsLoading(true)
    try {
      const res = await fetch(q ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g` : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=g`)
      const out = await res.json()
      setGifs(out.data || [])
    } finally { setGifsLoading(false) }
  }

  async function toggleQuickReaction(msgId, emoji) {
    setActiveEmojiPicker(null)
    const existing = reactions[msgId]?.[emoji] || []
    if (existing.includes(user.id)) await supabase.from('message_reactions').delete().eq('message_id', msgId).eq('uid', user.id).eq('emoji', emoji)
    else await supabase.from('message_reactions').insert({ message_id: msgId, uid: user.id, emoji })
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', background: 'var(--bg)', fontFamily: 'sans-serif' }}>
      <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', fontSize: 13, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>Channels</div>
        <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CHANNELS.filter(c => canSee(user.name, c.id)).map(ch => (
            <button key={ch.id} onClick={() => setChannel(ch.id)} style={{ padding: '12px', border: 'none', borderRadius: 8, background: channel===ch.id ? 'var(--primary-light)' : 'transparent', textAlign:'left', fontWeight:channel===ch.id?700:500, cursor:'pointer' }}># {ch.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 56, borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', fontWeight: 800 }}>#{CHANNELS.find(c=>c.id===channel)?.label}</div>
        
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {messages.map((m, i) => {
            const isMe = m.uid === user.id
            const sender = profiles.find(p=>p.id===m.uid) || {name:'User', ini:'??'}
            const showDate = !messages[i-1] || new Date(m.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString()
            return (
              <div key={m.id}>
                {showDate && <div style={{ textAlign: 'center', margin: '20px 0', fontSize: 11, color: 'var(--text-4)' }}>{new Date(m.created_at).toDateString()}</div>}
                <div onMouseEnter={() => setHoveredMsgId(m.id)} onMouseLeave={() => setHoveredMsgId(null)} style={{ display: 'flex', gap: 12, marginTop: 16, padding: '4px 8px', borderRadius: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{sender.ini}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'baseline' }}>
                      <span style={{ fontWeight:800, fontSize:15 }}>{sender.name}</span>
                      <span style={{ fontSize:11, color:'var(--text-4)' }}>{new Date(m.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                    </div>
                    <div style={{ fontSize:14, marginTop:4 }}>
                      {m.image_url && <img src={m.image_url} style={{ maxWidth: 320, borderRadius: 12, display: 'block', marginBottom: 8 }} />}
                      {m.text}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {showGifPicker && (
            <div style={{ position:'absolute', bottom:80, left:260, right:20, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:16, boxShadow:'0 10px 30px rgba(0,0,0,0.2)', height:300, display:'flex', flexDirection:'column' }}>
              <input onChange={e => {setGifSearch(e.target.value); loadGiphySearch(e.target.value)}} placeholder="Search GIFS..." style={{ padding:8, borderRadius:6, border:'1px solid var(--border)' }} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:8, overflowY:'auto', marginTop:10 }}>
                {gifs.map(g => <img key={g.id} src={g.images.fixed_height_small.url} onClick={() => {sendGif(g.images.original.url); setShowGifPicker(false)}} style={{ cursor:'pointer', borderRadius:4 }} />)}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 12px' }}>📷</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={triggerImageUpload} />
            <Btn onClick={() => setShowGifPicker(!showGifPicker)}>GIF</Btn>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => {if(e.key==='Enter') broadcastMessage()}} placeholder="Message..." style={{ flex: 1, padding: 10, borderRadius: 20, border: '1px solid var(--border)' }} />
            <Btn onClick={() => broadcastMessage()}>Send</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
