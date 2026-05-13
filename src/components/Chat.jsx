import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Spinner, ConfirmModal } from './shared'

const GIPHY_KEY       = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '👏', '💪', '🙌']
const TYPING_TIMEOUT  = 4000   // ms before typing indicator clears
const STALE_TYPING    = 8000   // ms before we ignore a typing record

const CHANNELS = [
  { id: 'main',   label: 'Main Chat',   exclude: [] },
  { id: 'sales',  label: 'Sales Chat',  exclude: ['Tania', 'Evelyn'] },
  { id: 'office', label: 'Office Chat', exclude: ['Destiny', 'Aisha'] },
]

function canSee(userName, channelId) {
  const ch = CHANNELS.find(c => c.id === channelId)
  return ch ? !ch.exclude.includes(userName) : false
}

async function fetchGifs(query) {
  const url = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=15&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=15&rating=g`
  const res  = await fetch(url)
  const data = await res.json()
  return data.data || []
}

function showBrowserNotif(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, { body, icon: '/favicon.ico' })
  setTimeout(() => n.close(), 5000)
}

function isPollExpired(poll) {
  if (!poll.expires_at) return false
  return new Date(poll.expires_at) < new Date()
}

function formatExpiry(poll) {
  if (!poll.expires_at) return null
  const diff = new Date(poll.expires_at) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `Closes in ${Math.floor(h / 24)}d`
  if (h > 0)  return `Closes in ${h}h ${m}m`
  return `Closes in ${m}m`
}

export default function Chat({ user }) {
  const [channel,            setChannel]            = useState(() => CHANNELS.filter(c => canSee(user.name, c.id))[0]?.id || 'main')
  const [messages,           setMessages]           = useState({})
  const [profiles,           setProfiles]           = useState([])
  const [reactions,          setReactions]          = useState({})
  const [polls,              setPolls]              = useState({})
  const [pollVotes,          setPollVotes]          = useState({})
  const [text,               setText]               = useState('')
  const [loading,            setLoading]            = useState(true)
  const [uploading,          setUploading]          = useState(false)
  const [lightbox,           setLightbox]           = useState(null)
  const [hoveredMsg,         setHoveredMsg]         = useState(null)
  const [showEmojiPicker,    setShowEmojiPicker]    = useState(null)
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [showPollForm,       setShowPollForm]       = useState(false)
  const [pollQuestion,       setPollQuestion]       = useState('')
  const [pollOptions,        setPollOptions]        = useState(['', ''])
  const [pollExpiry,         setPollExpiry]         = useState('')   // hours string
  const [showGifPicker,      setShowGifPicker]      = useState(false)
  const [gifSearch,          setGifSearch]          = useState('')
  const [gifs,               setGifs]               = useState([])
  const [gifsLoading,        setGifsLoading]        = useState(false)

  // Search
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchResults,setSearchResults]= useState([])

  // Pinned messages
  const [pinnedMsgs,     setPinnedMsgs]     = useState({})   // { channelId: [msg, ...] }
  const [showPinned,     setShowPinned]     = useState(false)

  // Edit message
  const [editingMsg,     setEditingMsg]     = useState(null)  // message object
  const [editText,       setEditText]       = useState('')

  // Delete confirm
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState(null)

  // Typing indicators
  const [typingUsers,    setTypingUsers]    = useState({})   // { channelId: [{ uid, name }] }
  const typingTimerRef   = useRef(null)
  const isTypingRef      = useRef(false)

  // Read receipts
  const [channelReads,   setChannelReads]   = useState({})   // { uid: { channel: last_read_at } }

  // Unread tracking
  const [unreadByChannel, setUnreadByChannel] = useState({})
  const lastSeenRef       = useRef({})         // { channelId: lastSeenTimestamp }

  const endRef        = useRef(null)
  const fileRef       = useRef(null)
  const textareaRef   = useRef(null)
  const searchRef     = useRef(null)
  const channelRef    = useRef(channel)

  const accessibleChannels = CHANNELS.filter(c => canSee(user.name, c.id))
  const isAdmin = user.role === 'admin'

  // Keep channelRef in sync
  useEffect(() => { channelRef.current = channel }, [channel])

  useEffect(() => { fetchAll() }, [])

  // Scroll to bottom when messages change in current channel
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages[channel]])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [text])

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGifPicker && gifs.length === 0) loadGifs('')
  }, [showGifPicker])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50)
  }, [searchOpen])

  // Mark channel as seen when switching to it
  useEffect(() => {
    lastSeenRef.current[channel] = Date.now()
    setUnreadByChannel(prev => ({ ...prev, [channel]: 0 }))
    // Upsert read receipt
    supabase.from('channel_reads').upsert(
      { uid: user.id, channel, last_read_at: new Date().toISOString() },
      { onConflict: 'uid,channel' }
    )
  }, [channel])

  // Keyboard shortcut: Ctrl+F or Cmd+F opens search
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function loadGifs(q) {
    setGifsLoading(true)
    const results = await fetchGifs(q)
    setGifs(results)
    setGifsLoading(false)
  }

  async function fetchAll() {
    const [msgs, p, r, pls, pvs, pinned, reads] = await Promise.all([
      supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(500),
      supabase.from('profiles').select('*'),
      supabase.from('message_reactions').select('*'),
      supabase.from('polls').select('*'),
      supabase.from('poll_votes').select('*'),
      supabase.from('messages').select('*').eq('pinned', true).order('pinned_at', { ascending: false }),
      supabase.from('channel_reads').select('*'),
    ])

    // Group messages by channel
    const grouped = {}
    ;(msgs.data || []).forEach(m => {
      const ch = m.channel || 'main'
      if (!grouped[ch]) grouped[ch] = []
      grouped[ch].push(m)
    })
    setMessages(grouped)
    setProfiles(p.data || [])

    const rx = {}
    ;(r.data || []).forEach(x => {
      if (!rx[x.message_id]) rx[x.message_id] = {}
      if (!rx[x.message_id][x.emoji]) rx[x.message_id][x.emoji] = []
      rx[x.message_id][x.emoji].push(x.uid)
    })
    setReactions(rx)

    const pm = {}; (pls.data || []).forEach(pl => { pm[pl.id] = pl }); setPolls(pm)
    const pv = {}
    ;(pvs.data || []).forEach(v => {
      if (!pv[v.poll_id]) pv[v.poll_id] = {}
      if (!pv[v.poll_id][v.option_index]) pv[v.poll_id][v.option_index] = []
      pv[v.poll_id][v.option_index].push(v.uid)
    })
    setPollVotes(pv)

    // Group pinned by channel
    const pinnedGrouped = {}
    ;(pinned.data || []).forEach(m => {
      const ch = m.channel || 'main'
      if (!pinnedGrouped[ch]) pinnedGrouped[ch] = []
      pinnedGrouped[ch].push(m)
    })
    setPinnedMsgs(pinnedGrouped)

    // Initialize last seen to now for all channels
    accessibleChannels.forEach(c => { lastSeenRef.current[c.id] = Date.now() })

    // Group channel reads: { uid: { channelId: last_read_at } }
    const readsMap = {}
    ;(reads.data || []).forEach(r => {
      if (!readsMap[r.uid]) readsMap[r.uid] = {}
      readsMap[r.uid][r.channel] = r.last_read_at
    })
    setChannelReads(readsMap)

    setLoading(false)

    // ── Real-time subscriptions ──
    const msgCh = supabase.channel('chat_messages_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        const ch  = msg.channel || 'main'
        if (!canSee(user.name, ch)) return

        setMessages(prev => {
          const updated = { ...prev }
          updated[ch]   = [...(updated[ch] || []), msg]
          return updated
        })

        // Track unread if not in this channel right now
        if (ch !== channelRef.current) {
          setUnreadByChannel(prev => ({ ...prev, [ch]: (prev[ch] || 0) + 1 }))
        }

        // @mention notification
        if (msg.uid !== user.id && msg.text?.includes(`@${user.name}`)) {
          const sender   = p.data?.find(x => x.id === msg.uid)
          const chLabel  = CHANNELS.find(c => c.id === ch)?.label || 'Team Chat'
          showBrowserNotif(`${sender?.name || 'Someone'} mentioned you`, `In ${chLabel}: ${msg.text}`)
          supabase.from('notifications').insert({
            to_uid: user.id, type: 'mention',
            title: `${sender?.name || 'Someone'} mentioned you in ${chLabel}`,
            body: msg.text, nav_target: 'chat', nav_channel: ch,
          })
        }

        // Admin post notification
        if (msg.uid !== user.id && user.role !== 'admin') {
          const sender = p.data?.find(x => x.id === msg.uid)
          if (sender?.role === 'admin') {
            const chLabel = CHANNELS.find(c => c.id === ch)?.label || 'Team Chat'
            showBrowserNotif(`${sender.name} posted in ${chLabel}`, msg.text?.slice(0, 80) || '(image)')
            supabase.from('notifications').insert({
              to_uid: user.id, type: 'announcement',
              title: `${sender.name} posted in ${chLabel}`,
              body: msg.text?.slice(0, 120) || '(shared an image)', nav_target: 'chat', nav_channel: ch,
            })
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        const ch  = msg.channel || 'main'
        setMessages(prev => {
          const updated = { ...prev }
          updated[ch]   = (updated[ch] || []).map(m => m.id === msg.id ? msg : m)
          return updated
        })
        // Update pinned state
        if (msg.pinned) {
          setPinnedMsgs(prev => {
            const updated = { ...prev }
            const list    = updated[ch] || []
            const exists  = list.find(m => m.id === msg.id)
            updated[ch]   = exists ? list.map(m => m.id === msg.id ? msg : m) : [msg, ...list]
            return updated
          })
        } else {
          setPinnedMsgs(prev => {
            const updated = { ...prev }
            updated[ch]   = (updated[ch] || []).filter(m => m.id !== msg.id)
            return updated
          })
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => {
          const updated = { ...prev }
          Object.keys(updated).forEach(ch => { updated[ch] = updated[ch].filter(m => m.id !== payload.old.id) })
          return updated
        })
        setPinnedMsgs(prev => {
          const updated = { ...prev }
          Object.keys(updated).forEach(ch => { updated[ch] = (updated[ch] || []).filter(m => m.id !== payload.old.id) })
          return updated
        })
      })
      .subscribe()

    const rxCh = supabase.channel('chat_reactions_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const rv = payload.new
        setReactions(prev => {
          const m = { ...(prev[rv.message_id] || {}) }
          m[rv.emoji] = [...(m[rv.emoji] || []), rv.uid]
          return { ...prev, [rv.message_id]: m }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, payload => {
        const rv = payload.old
        setReactions(prev => {
          const m = { ...(prev[rv.message_id] || {}) }
          m[rv.emoji] = (m[rv.emoji] || []).filter(u => u !== rv.uid)
          if (!m[rv.emoji]?.length) delete m[rv.emoji]
          return { ...prev, [rv.message_id]: m }
        })
      })
      .subscribe()

    const voteCh = supabase.channel('poll_votes_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' }, payload => {
        const v = payload.new
        setPollVotes(prev => {
          const pv = { ...(prev[v.poll_id] || {}) }
          pv[v.option_index] = [...(pv[v.option_index] || []), v.uid]
          return { ...prev, [v.poll_id]: pv }
        })
      })
      .subscribe()

    // Typing indicators subscription
    const typingCh = supabase.channel('typing_indicators_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators' }, () => {
        fetchTypingUsers()
      })
      .subscribe()

    // Read receipts subscription
    const readsCh = supabase.channel('channel_reads_v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_reads' }, payload => {
        const r = payload.new
        if (r) {
          setChannelReads(prev => ({
            ...prev,
            [r.uid]: { ...(prev[r.uid] || {}), [r.channel]: r.last_read_at }
          }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(msgCh)
      supabase.removeChannel(rxCh)
      supabase.removeChannel(voteCh)
      supabase.removeChannel(typingCh)
      supabase.removeChannel(readsCh)
    }
  }

  async function fetchTypingUsers() {
    const cutoff = new Date(Date.now() - STALE_TYPING).toISOString()
    const { data } = await supabase
      .from('typing_indicators')
      .select('uid, channel, updated_at')
      .neq('uid', user.id)
      .gte('updated_at', cutoff)
    if (!data) return
    const grouped = {}
    data.forEach(t => {
      if (!grouped[t.channel]) grouped[t.channel] = []
      const profile = profiles.find ? profiles.find(p => p.id === t.uid) : null
      grouped[t.channel].push({ uid: t.uid, name: profile?.name || '...' })
    })
    setTypingUsers(grouped)
  }

  // ── Typing indicator ──────────────────────────────────────────
  async function setTyping() {
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

  async function clearTyping() {
    clearTimeout(typingTimerRef.current)
    isTypingRef.current = false
    await supabase.from('typing_indicators').delete().eq('uid', user.id).eq('channel', channel)
  }

  // ── Search ────────────────────────────────────────────────────
  function runSearch(q) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    const all = Object.values(messages).flat()
    const results = all.filter(m =>
      m.text?.toLowerCase().includes(q.toLowerCase()) && canSee(user.name, m.channel || 'main')
    ).slice(0, 30)
    setSearchResults(results)
  }

  function jumpToMessage(msg) {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setChannel(msg.channel || 'main')
    setTimeout(() => {
      const el = document.getElementById(`msg-${msg.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.background = 'var(--warning-light)'
        setTimeout(() => { el.style.background = '' }, 1800)
      }
    }, 120)
  }

  // ── Pin / unpin ───────────────────────────────────────────────
  async function togglePin(msg) {
    const next      = !msg.pinned
    const update    = next
      ? { pinned: true,  pinned_at: new Date().toISOString(), pinned_by: user.id }
      : { pinned: false, pinned_at: null, pinned_by: null }
    await supabase.from('messages').update(update).eq('id', msg.id)
  }

  // ── Edit message ──────────────────────────────────────────────
  function openEdit(msg) {
    setEditingMsg(msg)
    setEditText(msg.text || '')
  }

  async function saveEdit() {
    if (!editText.trim() || !editingMsg) return
    await supabase.from('messages').update({ text: editText.trim(), edited: true, edited_at: new Date().toISOString() }).eq('id', editingMsg.id)
    setEditingMsg(null)
    setEditText('')
  }

  // ── Delete message ────────────────────────────────────────────
  async function deleteMessage(msg) {
    await supabase.from('messages').delete().eq('id', msg.id)
    setConfirmDeleteMsg(null)
  }

  // ── Text input ────────────────────────────────────────────────
  function handleTextChange(e) {
    const val = e.target.value
    setText(val)
    setTyping()
    const match = val.match(/@(\w*)$/)
    if (match) {
      const q              = match[1].toLowerCase()
      const channelExclude = CHANNELS.find(c => c.id === channel)?.exclude || []
      setMentionSuggestions(
        profiles.filter(p => p.id !== user.id && !channelExclude.includes(p.name) && p.name.toLowerCase().startsWith(q)).slice(0, 5)
      )
    } else {
      setMentionSuggestions([])
    }
  }

  function insertMention(profile) {
    setText(text.replace(/@(\w*)$/, `@${profile.name} `))
    setMentionSuggestions([])
    textareaRef.current?.focus()
  }

  async function sendMessage(overrideText) {
    const trimmed = (overrideText ?? text).trim()
    if (!trimmed) return
    setText('')
    setMentionSuggestions([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await clearTyping()
    await supabase.from('messages').insert({ uid: user.id, text: trimmed, channel })
    // Mark as read up to now
    supabase.from('channel_reads').upsert(
      { uid: user.id, channel, last_read_at: new Date().toISOString() },
      { onConflict: 'uid,channel' }
    )
  }

  async function sendGif(gifUrl) {
    setShowGifPicker(false)
    await supabase.from('messages').insert({ uid: user.id, text: '', image_url: gifUrl, channel })
  }

  async function sendPoll() {
    const q    = pollQuestion.trim()
    const opts = pollOptions.map(o => o.trim()).filter(Boolean)
    if (!q || opts.length < 2) return
    const expiresAt = pollExpiry ? new Date(Date.now() + Number(pollExpiry) * 3600000).toISOString() : null
    const { data: poll } = await supabase.from('polls').insert({ question: q, options: opts, created_by: user.id, expires_at: expiresAt }).select().single()
    if (poll) {
      setPolls(prev => ({ ...prev, [poll.id]: poll }))
      await supabase.from('messages').insert({ uid: user.id, text: '', poll_id: poll.id, channel })
    }
    setShowPollForm(false); setPollQuestion(''); setPollOptions(['', '']); setPollExpiry('')
  }

  async function vote(pollId, optionIndex) {
    if (Object.values(pollVotes[pollId] || {}).flat().includes(user.id)) return
    await supabase.from('poll_votes').insert({ poll_id: pollId, uid: user.id, option_index: optionIndex })
  }

  async function toggleReaction(messageId, emoji) {
    setShowEmojiPicker(null)
    const users = reactions[messageId]?.[emoji] || []
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
    const ext      = file.name?.split('.').pop() || 'png'
    const fileName = `${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: file.type })
    if (error) { alert('Upload failed.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    await supabase.from('messages').insert({ uid: user.id, text: text.trim() || '', image_url: publicUrl, channel })
    setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setUploading(false)
  }

  async function handleImageUpload(e) { const f = e.target.files[0]; if (f) await uploadAndSend(f); e.target.value = '' }

  async function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    const f = item.getAsFile()
    if (f) await uploadAndSend(new File([f], 'paste.png', { type: f.type }))
  }

  function onKey(e) {
    if (mentionSuggestions.length > 0 && e.key === 'Escape') { setMentionSuggestions([]); return }
    if (editingMsg && e.key === 'Escape') { setEditingMsg(null); setEditText(''); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function getProfile(uid) { return profiles.find(p => p.id === uid) || { ini: '?', role: 'member', name: 'Unknown' } }
  function formatTime(ts)  { return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
  function formatDate(ts) {
    const d = new Date(ts); const t = new Date(); const y = new Date(t); y.setDate(t.getDate() - 1)
    if (d.toDateString() === t.toDateString()) return 'Today'
    if (d.toDateString() === y.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function renderText(txt) {
    if (!txt) return null
    return txt.split(/(@\w[\w ]*)/g).map((part, i) => {
      const isMention = profiles.some(p => part === `@${p.name}`)
      const isMe      = part === `@${user.name}`
      if (isMention) return (
        <span key={i} style={{ background: isMe ? '#fef9c3' : 'rgba(255,255,255,0.18)', color: isMe ? '#92400e' : 'inherit', borderRadius: 3, padding: '0 2px', fontWeight: 600 }}>{part}</span>
      )
      return part
    })
  }

  const currentMsgs    = messages[channel] || []
  const currentPinned  = pinnedMsgs[channel] || []
  const currentTyping  = (typingUsers[channel] || []).filter(t => t.uid !== user.id)

  const grouped = []
  let lastDate  = null
  currentMsgs.forEach(m => {
    const date = new Date(m.created_at).toDateString()
    if (date !== lastDate) { grouped.push({ type: 'date', label: formatDate(m.created_at) }); lastDate = date }
    grouped.push({ type: 'msg', ...m })
  })

  const activeChannel  = CHANNELS.find(c => c.id === channel)

  if (loading) return <Spinner />

  return (
    <>
      <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

        {/* ── Channel tabs + search + pin toggle ── */}
        <div style={{ borderBottom:'1px solid var(--topbar-border)', background:'var(--topbar-bg)', padding:'0 16px', display:'flex', gap:0, alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', flex:1 }}>
            {accessibleChannels.map(ch => {
              const unread = unreadByChannel[ch.id] || 0
              return (
                <button key={ch.id} onClick={() => setChannel(ch.id)} style={{ padding:'11px 14px', border:'none', borderBottom: channel===ch.id ? `2px solid ${N}` : '2px solid transparent', background:'none', cursor:'pointer', fontSize:13, fontWeight: channel===ch.id ? 600 : 400, color: channel===ch.id ? N : 'var(--text-3)', marginBottom:-1, position:'relative', display:'flex', alignItems:'center', gap:6 }}>
                  {ch.label}
                  {unread > 0 && channel !== ch.id && (
                    <span style={{ background:R, color:'#fff', borderRadius:99, fontSize:9, fontWeight:700, padding:'1px 5px', minWidth:16, textAlign:'center' }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Right controls */}
          <div style={{ display:'flex', alignItems:'center', gap:6, paddingLeft:10 }}>
            {currentPinned.length > 0 && (
              <button onClick={() => setShowPinned(o => !o)} title="Pinned messages" style={{ fontSize:11, color: showPinned ? N : 'var(--text-3)', background: showPinned ? 'var(--primary-light)' : 'none', border:`1px solid ${showPinned ? N : 'var(--border)'}`, borderRadius:7, padding:'4px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                📌 {currentPinned.length}
              </button>
            )}
            <button onClick={() => setSearchOpen(o => !o)} title="Search messages (Ctrl+F)" style={{ fontSize:13, color: searchOpen ? N : 'var(--text-3)', background: searchOpen ? 'var(--primary-light)' : 'none', border:`1px solid ${searchOpen ? N : 'var(--border)'}`, borderRadius:7, padding:'4px 10px', cursor:'pointer' }}>
              🔍
            </button>
          </div>
        </div>

        {/* ── Search bar ── */}
        {searchOpen && (
          <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'10px 16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => runSearch(e.target.value)}
                placeholder="Search messages across all channels…"
                style={{ flex:1, border:'1px solid var(--border-2)', borderRadius:8, padding:'7px 12px', fontSize:13, outline:'none', background:'var(--surface)', color:'var(--text-1)', fontFamily:'inherit' }}
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]) }} style={{ fontSize:11, color:'var(--text-3)', background:'none', border:'1px solid var(--border)', borderRadius:7, padding:'6px 11px', cursor:'pointer' }}>Close</button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop:8, maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                {searchResults.map(msg => {
                  const p   = getProfile(msg.uid)
                  const chL = CHANNELS.find(c => c.id === (msg.channel || 'main'))?.label
                  return (
                    <div key={msg.id} onClick={() => jumpToMessage(msg)} style={{ padding:'8px 12px', borderRadius:8, cursor:'pointer', background:'var(--surface-2)', border:'1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--surface-3)'}
                      onMouseLeave={e => e.currentTarget.style.background='var(--surface-2)'}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background: p.role==='admin' ? R : 'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:600, color: p.role==='admin' ? '#fff' : '#1e40af', flexShrink:0 }}>{p.ini}</div>
                        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-2)' }}>{p.name}</span>
                        <span style={{ fontSize:10, color:'var(--text-4)' }}>{chL} · {formatTime(msg.created_at)}</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-1)', paddingLeft:28, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{msg.text}</div>
                    </div>
                  )
                })}
              </div>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <div style={{ marginTop:8, fontSize:12, color:'var(--text-4)', textAlign:'center', padding:'10px 0' }}>No messages found for "{searchQuery}"</div>
            )}
          </div>
        )}

        {/* ── Pinned messages panel ── */}
        {showPinned && currentPinned.length > 0 && (
          <div style={{ background:'var(--warning-light)', borderBottom:'1px solid #fcd34d', padding:'8px 16px', maxHeight:140, overflowY:'auto' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#92400e', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>📌 Pinned messages</div>
            {currentPinned.map(msg => {
              const p = getProfile(msg.uid)
              return (
                <div key={msg.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5, cursor:'pointer' }} onClick={() => jumpToMessage(msg)}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'#92400e' }}>{p.name}: </span>
                    <span style={{ fontSize:11, color:'#78350f', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'inline-block', maxWidth:'85%' }}>
                      {msg.text || '(image)'}
                    </span>
                  </div>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); togglePin(msg) }} style={{ fontSize:10, color:'#92400e', background:'none', border:'none', cursor:'pointer', flexShrink:0, marginLeft:8 }}>Unpin</button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Messages ── */}
        <div
          style={{ flex:1, overflowY:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}
          onClick={() => { setShowEmojiPicker(null); setMentionSuggestions([]); setShowGifPicker(false) }}
        >
          {grouped.length === 0 && (
            <div style={{ textAlign:'center', color:'var(--text-4)', fontSize:13, marginTop:40 }}>
              No messages yet in {activeChannel?.label}. Say something! 👋
            </div>
          )}

          {grouped.map((item, idx) => {
            if (item.type === 'date') return (
              <div key={'d'+idx} style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0' }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
                <span style={{ fontSize:10, color:'var(--text-4)', fontWeight:500, whiteSpace:'nowrap' }}>{item.label}</span>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
              </div>
            )

            // ── Poll message ──
            if (item.poll_id && polls[item.poll_id]) {
              const poll       = polls[item.poll_id]
              const votes      = pollVotes[poll.id] || {}
              const totalVotes = Object.values(votes).flat().length
              const myVote     = Object.entries(votes).find(([, uids]) => uids.includes(user.id))?.[0]
              const creator    = getProfile(item.uid)
              const expired    = isPollExpired(poll)
              const expLabel   = formatExpiry(poll)

              return (
                <div key={item.id} id={`msg-${item.id}`} style={{ maxWidth:360, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', transition:'background 0.4s' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:600, color:'#1e40af' }}>{creator.ini}</div>
                      <span style={{ fontSize:11, color:'var(--text-3)' }}>{creator.name} · 📊 Poll</span>
                    </div>
                    {expLabel && (
                      <span style={{ fontSize:10, fontWeight:500, color: expired ? 'var(--danger)' : '#92400e', background: expired ? 'var(--danger-light)' : 'var(--warning-light)', padding:'2px 7px', borderRadius:99 }}>
                        {expLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:10 }}>{poll.question}</div>
                  {poll.options.map((opt, i) => {
                    const count    = (votes[i] || []).length
                    const pct      = totalVotes ? Math.round(count / totalVotes * 100) : 0
                    const isMyVote = myVote !== undefined && Number(myVote) === i
                    const canVote  = !myVote && !expired
                    return (
                      <div key={i} onClick={() => canVote && vote(poll.id, i)} style={{ marginBottom:7, cursor: canVote ? 'pointer' : 'default', opacity: expired && !isMyVote ? 0.6 : 1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:12, fontWeight: isMyVote ? 600 : 400, color: isMyVote ? N : 'var(--text-2)' }}>{isMyVote ? '✓ ' : ''}{opt}</span>
                          <span style={{ fontSize:11, color:'var(--text-4)' }}>{count} · {pct}%</span>
                        </div>
                        <div style={{ height:5, background:'var(--surface-3)', borderRadius:99 }}>
                          <div style={{ width:pct+'%', height:'100%', background: isMyVote ? N : 'var(--border-2)', borderRadius:99, transition:'width .3s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ fontSize:10, color:'var(--text-4)', marginTop:6 }}>
                    {expired ? `Closed · ${totalVotes} vote${totalVotes!==1?'s':''}` : myVote !== undefined ? `${totalVotes} vote${totalVotes!==1?'s':''} total` : 'Tap an option to vote'}
                  </div>
                </div>
              )
            }

            // ── Regular message ──
            const isMe      = item.uid === user.id
            const p         = getProfile(item.uid)
            const canDelete = isMe || isAdmin
            const canEdit   = isMe
            const canPin    = isAdmin
            const isHovered = hoveredMsg === item.id
            const msgR      = reactions[item.id] || {}
            const hasR      = Object.keys(msgR).length > 0
            const isEditing = editingMsg?.id === item.id

            return (
              <div
                key={item.id}
                id={`msg-${item.id}`}
                onMouseEnter={() => setHoveredMsg(item.id)}
                onMouseLeave={() => setHoveredMsg(null)}
                style={{ display:'flex', gap:9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems:'flex-start', position:'relative', transition:'background 0.4s', borderRadius:8, padding:'2px 4px', margin:'0 -4px' }}
              >
                <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, background: p.role==='admin' ? R : 'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, color: p.role==='admin' ? '#fff' : '#1e40af' }}>{p.ini}</div>

                <div style={{ maxWidth:'72%' }}>
                  {/* Name + time + actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text-2)' }}>{isMe ? 'You' : p.name}</span>
                    <span style={{ fontSize:10, color:'var(--text-4)' }}>{formatTime(item.created_at)}</span>
                    {item.edited && <span style={{ fontSize:9, color:'var(--text-4)', fontStyle:'italic' }}>(edited)</span>}
                    {item.pinned && <span style={{ fontSize:10 }} title="Pinned">📌</span>}

                    {/* Hover action buttons */}
                    {isHovered && (
                      <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                        {canEdit && item.text && (
                          <button onClick={() => openEdit(item)} style={{ border:'none', background:'none', cursor:'pointer', fontSize:11, color:'var(--text-4)', padding:'1px 3px', borderRadius:4 }} title="Edit">✏️</button>
                        )}
                        {canPin && (
                          <button onClick={() => togglePin(item)} style={{ border:'none', background:'none', cursor:'pointer', fontSize:11, color: item.pinned ? '#d97706' : 'var(--text-4)', padding:'1px 3px', borderRadius:4 }} title={item.pinned ? 'Unpin' : 'Pin'}>📌</button>
                        )}
                        {canDelete && (
                          <button onClick={() => setConfirmDeleteMsg(item)} style={{ border:'none', background:'none', cursor:'pointer', fontSize:11, color:'#ef4444', padding:'1px 3px', borderRadius:4 }} title="Delete">🗑</button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Image */}
                  {item.image_url && (
                    <div style={{ marginBottom: item.text ? 6 : 0 }}>
                      <img src={item.image_url} alt="shared" onClick={() => setLightbox(item.image_url)} style={{ maxWidth:260, maxHeight:200, borderRadius:10, cursor:'zoom-in', display:'block', border:'1px solid var(--border)', objectFit:'cover' }} />
                    </div>
                  )}

                  {/* Text or edit box */}
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
                          if (e.key === 'Escape') { setEditingMsg(null); setEditText('') }
                        }}
                        autoFocus
                        rows={2}
                        style={{ width:'100%', fontSize:13, padding:'8px 12px', border:'1px solid var(--primary)', borderRadius:10, outline:'none', resize:'none', lineHeight:1.5, fontFamily:'inherit', background:'var(--surface)', color:'var(--text-1)' }}
                      />
                      <div style={{ display:'flex', gap:6, marginTop:5 }}>
                        <button onClick={saveEdit} style={{ fontSize:11, fontWeight:600, color:'#fff', background:N, border:'none', borderRadius:6, padding:'4px 12px', cursor:'pointer' }}>Save</button>
                        <button onClick={() => { setEditingMsg(null); setEditText('') }} style={{ fontSize:11, color:'var(--text-3)', background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>Cancel</button>
                        <span style={{ fontSize:10, color:'var(--text-4)', alignSelf:'center' }}>Enter to save · Esc to cancel</span>
                      </div>
                    </div>
                  ) : item.text ? (
                    <div style={{ background: isMe ? N : 'var(--surface-3)', color: isMe ? '#fff' : 'var(--text-1)', padding:'9px 13px', borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px', fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                      {renderText(item.text)}
                    </div>
                  ) : null}

                  {/* Reactions */}
                  {hasR && (
                    <div style={{ display:'flex', gap:4, marginTop:5, flexWrap:'wrap', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      {Object.entries(msgR).map(([emoji, uids]) => {
                        const iMine = uids.includes(user.id)
                        return (
                          <button key={emoji} onClick={e => { e.stopPropagation(); toggleReaction(item.id, emoji) }} title={uids.map(u => profiles.find(p => p.id===u)?.name || '?').join(', ')}
                            style={{ padding:'2px 8px', borderRadius:99, border:`1px solid ${iMine ? N : 'var(--border)'}`, background: iMine ? 'var(--primary-light)' : 'var(--surface)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:3 }}>
                            {emoji}<span style={{ fontSize:11, fontWeight:600, color: iMine ? N : 'var(--text-3)' }}>{uids.length}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Emoji picker trigger */}
                  {isHovered && !isEditing && (
                    <div style={{ position:'relative', marginTop:4, display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <button onClick={e => { e.stopPropagation(); setShowEmojiPicker(showEmojiPicker===item.id ? null : item.id) }} style={{ border:'1px solid var(--border)', background:'var(--surface)', borderRadius:99, padding:'2px 8px', cursor:'pointer', fontSize:12, color:'var(--text-3)' }}>😊 +</button>
                      {showEmojiPicker === item.id && (
                        <div onClick={e => e.stopPropagation()} style={{ position:'absolute', bottom:'110%', [isMe ? 'right' : 'left']:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'8px 10px', display:'flex', gap:6, boxShadow:'var(--shadow-md)', zIndex:100, flexWrap:'wrap', maxWidth:200 }}>
                          {REACTION_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(item.id, emoji)} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, padding:'2px 4px', borderRadius:6 }}
                              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.3)'; e.currentTarget.style.background='var(--surface-3)' }}
                              onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.background='none' }}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Seen by — shows under the last real message */}
          {(() => {
            const lastMsg = currentMsgs[currentMsgs.length - 1]
            if (!lastMsg) return null
            const seenBy = profiles.filter(p =>
              p.id !== user.id &&
              canSee(p.name, channel) &&
              channelReads[p.id]?.[channel] &&
              new Date(channelReads[p.id][channel]) >= new Date(lastMsg.created_at)
            )
            if (seenBy.length === 0) return null
            return (
              <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end', padding:'2px 4px' }}>
                <span style={{ fontSize:10, color:'var(--text-4)' }}>Seen by</span>
                {seenBy.map(p => (
                  <div key={p.id} title={p.name} style={{ width:16, height:16, borderRadius:'50%', background: p.role==='admin' ? R : 'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:700, color: p.role==='admin' ? '#fff' : '#1e40af' }}>{p.ini}</div>
                ))}
              </div>
            )
          })()}

          {/* Typing indicator */}
          {currentTyping.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
              <div style={{ display:'flex', gap:3 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--text-4)', animation:`typingDot 1.2s ${i*0.2}s ease-in-out infinite` }} />
                ))}
              </div>
              <span style={{ fontSize:11, color:'var(--text-4)', fontStyle:'italic' }}>
                {currentTyping.map(t => t.name).join(', ')} {currentTyping.length === 1 ? 'is' : 'are'} typing…
              </span>
              <style>{`@keyframes typingDot{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* ── Poll form ── */}
        {showPollForm && (
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', background:'var(--surface-2)' }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--text-1)', marginBottom:8 }}>Create a poll</div>
            <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question…" style={{ width:'100%', border:'1px solid var(--border-2)', borderRadius:7, padding:'7px 10px', fontSize:13, marginBottom:7, outline:'none', background:'var(--surface)', color:'var(--text-1)', fontFamily:'inherit' }} />
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display:'flex', gap:6, marginBottom:5 }}>
                <input value={opt} onChange={e => { const o=[...pollOptions]; o[i]=e.target.value; setPollOptions(o) }} placeholder={`Option ${i+1}`} style={{ flex:1, border:'1px solid var(--border-2)', borderRadius:7, padding:'6px 10px', fontSize:12, outline:'none', background:'var(--surface)', color:'var(--text-1)', fontFamily:'inherit' }} />
                {pollOptions.length > 2 && <button onClick={() => setPollOptions(o => o.filter((_,j) => j!==i))} style={{ border:'none', background:'none', color:'var(--danger)', cursor:'pointer', fontSize:16 }}>×</button>}
              </div>
            ))}
            {/* Expiry option */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, marginTop:4 }}>
              <span style={{ fontSize:11, color:'var(--text-3)' }}>Closes in:</span>
              <select value={pollExpiry} onChange={e => setPollExpiry(e.target.value)} style={{ border:'1px solid var(--border-2)', borderRadius:6, padding:'4px 8px', fontSize:11, background:'var(--surface)', color:'var(--text-1)', outline:'none' }}>
                <option value="">No expiry</option>
                <option value="1">1 hour</option>
                <option value="4">4 hours</option>
                <option value="24">24 hours</option>
                <option value="48">2 days</option>
                <option value="168">1 week</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:7, marginTop:6 }}>
              {pollOptions.length < 4 && <button onClick={() => setPollOptions(o => [...o,''])} style={{ fontSize:11, color:'var(--text-3)', background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>+ Option</button>}
              <div style={{ flex:1 }} />
              <button onClick={() => { setShowPollForm(false); setPollQuestion(''); setPollOptions(['','']); setPollExpiry('') }} style={{ fontSize:12, color:'var(--text-3)', background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'5px 12px', cursor:'pointer' }}>Cancel</button>
              <button onClick={sendPoll} style={{ fontSize:12, fontWeight:500, color:'#fff', background:N, border:'none', borderRadius:6, padding:'5px 14px', cursor:'pointer' }}>Post poll</button>
            </div>
          </div>
        )}

        {/* ── GIF picker ── */}
        {showGifPicker && (
          <div style={{ borderTop:'1px solid var(--border)', background:'var(--surface)', padding:'10px 14px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input value={gifSearch} onChange={e => setGifSearch(e.target.value)} onKeyDown={e => { if (e.key==='Enter') loadGifs(gifSearch) }} placeholder="Search GIFs… (press Enter)" style={{ flex:1, border:'1px solid var(--border-2)', borderRadius:7, padding:'6px 10px', fontSize:12, outline:'none', background:'var(--surface)', color:'var(--text-1)', fontFamily:'inherit' }} />
              <button onClick={() => loadGifs(gifSearch)} style={{ background:N, color:'#fff', border:'none', borderRadius:7, padding:'6px 12px', cursor:'pointer', fontSize:12 }}>Search</button>
              <button onClick={() => setShowGifPicker(false)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:7, padding:'6px 10px', cursor:'pointer', fontSize:12, color:'var(--text-3)' }}>Cancel</button>
            </div>
            {gifsLoading ? (
              <div style={{ textAlign:'center', color:'var(--text-4)', padding:'20px 0', fontSize:12 }}>Loading GIFs…</div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, maxHeight:300, overflowY:'auto' }}>
                {gifs.map(g => (
                  <div key={g.id} onClick={() => sendGif(g.images.original.url)} style={{ position:'relative', borderRadius:10, overflow:'hidden', cursor:'pointer', border:'2px solid transparent', transition:'border-color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=N}
                    onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
                    <img src={g.images.fixed_height_small.url} alt={g.title}
                      style={{ width:'100%', height:130, objectFit:'cover', display:'block' }} />
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize:9, color:'var(--text-4)', textAlign:'right', marginTop:4 }}>Powered by GIPHY</div>
          </div>
        )}

        {/* ── Input area ── */}
        <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', background:'var(--topbar-bg)', flexShrink:0 }}>
          {uploading && <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>⏳ Uploading…</div>}
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', position:'relative' }}>
            <button onClick={() => fileRef.current?.click()} style={{ width:34, height:34, borderRadius:'50%', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, color:'var(--text-3)', flexShrink:0 }}>📎</button>
            <button onClick={() => { setShowGifPicker(s=>!s); setShowPollForm(false) }} style={{ width:34, height:34, borderRadius:'50%', border:`1px solid ${showGifPicker ? N : 'var(--border)'}`, background: showGifPicker ? 'var(--primary-light)' : 'var(--surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color: showGifPicker ? N : 'var(--text-3)', flexShrink:0 }}>GIF</button>
            <button onClick={() => { setShowPollForm(s=>!s); setShowGifPicker(false) }} style={{ width:34, height:34, borderRadius:'50%', border:`1px solid ${showPollForm ? N : 'var(--border)'}`, background: showPollForm ? 'var(--primary-light)' : 'var(--surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>📊</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageUpload} />

            {mentionSuggestions.length > 0 && (
              <div style={{ position:'absolute', bottom:'110%', left:120, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:9, boxShadow:'var(--shadow-md)', zIndex:200, minWidth:160, overflow:'hidden' }}>
                {mentionSuggestions.map(p => (
                  <div key={p.id} onClick={() => insertMention(p)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', fontSize:13, color:'var(--text-1)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--surface-3)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background: p.role==='admin'?R:'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:600, color: p.role==='admin'?'#fff':'#1e40af' }}>{p.ini}</div>
                    {p.name}
                  </div>
                ))}
              </div>
            )}

            <textarea ref={textareaRef} value={text} onChange={handleTextChange} onKeyDown={onKey} onPaste={handlePaste}
              placeholder={`Message ${activeChannel?.label}… (@ to mention)`}
              disabled={uploading} rows={1}
              style={{ flex:1, fontSize:13, padding:'9px 15px', border:'1px solid var(--border)', borderRadius:18, background:'var(--surface-2)', color:'var(--text-1)', outline:'none', resize:'none', overflow:'auto', lineHeight:1.5, fontFamily:'inherit', minHeight:38, maxHeight:160 }} />
            <button onClick={() => sendMessage()} disabled={uploading} style={{ background:N, color:'#fff', border:'none', borderRadius:18, padding:'9px 20px', fontSize:13, fontWeight:500, cursor:'pointer', flexShrink:0, height:38 }}>Send</button>
          </div>
          <div style={{ fontSize:10, color:'var(--text-4)', marginTop:5, paddingLeft:118 }}>Enter to send · Shift+Enter for new line · @ to mention · Ctrl+F to search</div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, cursor:'zoom-out', padding:24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:10, objectFit:'contain' }} />
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDeleteMsg && (
        <ConfirmModal
          title="Delete this message?"
          message="This permanently removes the message for everyone."
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteMessage(confirmDeleteMsg)}
          onCancel={() => setConfirmDeleteMsg(null)}
        />
      )}
    </>
  )
}
