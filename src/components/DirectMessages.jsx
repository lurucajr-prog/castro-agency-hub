import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R, Spinner, ConfirmModal, IS, Modal, Field, Btn } from './shared'

const GIPHY_KEY      = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '😮']
const TYPING_TIMEOUT  = 2500

// ── Helpers ───────────────────────────────────────────────────
async function fetchGifs(query) {
  const url = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`
  const res  = await fetch(url)
  const data = await res.json()
  return data.data || []
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve(false)
  if (Notification.permission === 'granted') return Promise.resolve(true)
  if (Notification.permission === 'denied') return Promise.resolve(false)
  return Notification.requestPermission().then(r => r === 'granted')
}

function showPushNotification(title, body, onClick) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'castro-dm' })
  n.onclick = () => { window.focus(); n.close(); onClick?.() }
  setTimeout(() => n.close(), 6000)
}

function formatTime(ts) {
  const d = new Date(ts)
  const isToday = d.toDateString() === new Date().toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function DirectMessages({ user, setPage, darkMode, dmTarget, onDmTargetConsumed }) {

  // ── Core state ────────────────────────────────────────────────
  const [profiles,      setProfiles]      = useState([])
  const [conversations, setConversations] = useState({})      // { [uid]: DM[] }
  const [groupConvos,   setGroupConvos]   = useState([])      // group_conversations
  const [groupMessages, setGroupMessages] = useState({})      // { [convoId]: msg[] }
  const [selected,      setSelected]      = useState(null)    // profile or group convo
  const [selectedType,  setSelectedType]  = useState('dm')    // 'dm' | 'group'
  const [text,          setText]          = useState('')
  const [uploading,     setUploading]     = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [lightbox,      setLightbox]      = useState(null)
  const [unread,        setUnread]        = useState({})      // { [uid]: count }
  const [groupUnread,   setGroupUnread]   = useState({})      // { [convoId]: count }
  const [notifEnabled,  setNotifEnabled]  = useState(Notification?.permission === 'granted')
  const [confirmDelete, setConfirmDelete] = useState(null)

  // ── New features state ────────────────────────────────────────
  const [reactions,     setReactions]     = useState({})      // { [msgId]: { emoji: uid[] } }
  const [hoveredMsg,    setHoveredMsg]    = useState(null)    // msgId for reaction picker
  const [typingUsers,   setTypingUsers]   = useState([])      // who's typing in current conv
  const [dmSearch,      setDmSearch]      = useState('')
  const [showSearch,    setShowSearch]    = useState(false)
  const [showNewGroup,  setShowNewGroup]  = useState(false)
  const [newGroupMembers, setNewGroupMembers] = useState([])
  const [newGroupName,  setNewGroupName]  = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  // ── GIF picker ────────────────────────────────────────────────
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch,     setGifSearch]     = useState('')
  const [gifs,          setGifs]          = useState([])
  const [gifsLoading,   setGifsLoading]   = useState(false)

  // ── Refs ──────────────────────────────────────────────────────
  const endRef        = useRef(null)
  const fileRef       = useRef(null)
  const selectedRef   = useRef(null)
  const isTypingRef   = useRef(false)
  const typingTimer   = useRef(null)
  const typingCh      = useRef(null)

  // ── Typing channel key ────────────────────────────────────────
  function typingChannel(type, id) {
    if (type === 'dm' && id)    return `dm_${[user.id, id].sort().join('_')}`
    if (type === 'group' && id) return `group_${id}`
    return null
  }

  // ── Track selected in ref (for realtime callbacks) ────────────
  useEffect(() => { selectedRef.current = { selected, selectedType } }, [selected, selectedType])

  // ── Auto-select from Profiles DM button ───────────────────────
  useEffect(() => {
    if (dmTarget && profiles.length > 0) {
      const target = profiles.find(p => p.id === dmTarget)
      if (target) { selectDm(target); onDmTargetConsumed?.() }
    }
  }, [dmTarget, profiles])

  // ── Initial load + realtime subscriptions ─────────────────────
  useEffect(() => {
    fetchData()

    // 1-on-1 DMs
    const dmSub = supabase.channel('dm_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, p => {
        const msg = p.new
        if (msg.from_uid !== user.id && msg.to_uid !== user.id) return
        const otherUid = msg.from_uid === user.id ? msg.to_uid : msg.from_uid
        setConversations(prev => ({ ...prev, [otherUid]: [...(prev[otherUid] || []), msg] }))
        if (msg.from_uid !== user.id) {
          const cur = selectedRef.current
          if (cur?.selectedType !== 'dm' || cur?.selected?.id !== otherUid) {
            setUnread(u => ({ ...u, [otherUid]: (u[otherUid] || 0) + 1 }))
            setProfiles(profs => {
              const sender = profs.find(x => x.id === msg.from_uid)
              if (sender) showPushNotification(`${sender.name}`, msg.image_url && !msg.text ? '📷 Sent an image' : msg.text, () => setPage?.('dms'))
              return profs
            })
          }
        }
      })
      .subscribe()

    // Group messages
    const grpSub = supabase.channel('group_msg_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, p => {
        const msg = p.new
        // Only care if user is in this conversation
        setGroupConvos(convos => {
          const convo = convos.find(c => c.id === msg.conversation_id)
          if (!convo || !convo.member_uids?.includes(user.id)) return convos
          setGroupMessages(prev => ({ ...prev, [msg.conversation_id]: [...(prev[msg.conversation_id] || []), msg] }))
          if (msg.from_uid !== user.id) {
            const cur = selectedRef.current
            if (cur?.selectedType !== 'group' || cur?.selected?.id !== msg.conversation_id) {
              setGroupUnread(u => ({ ...u, [msg.conversation_id]: (u[msg.conversation_id] || 0) + 1 }))
            }
          }
          return convos
        })
      })
      .subscribe()

    // Reactions
    const rxSub = supabase.channel('dm_reactions_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_reactions' }, p => {
        const r = p.new
        setReactions(prev => {
          const msgRx = { ...(prev[r.message_id] || {}) }
          msgRx[r.emoji] = [...(msgRx[r.emoji] || []), r.uid]
          return { ...prev, [r.message_id]: msgRx }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'dm_reactions' }, p => {
        const r = p.old
        setReactions(prev => {
          const msgRx = { ...(prev[r.message_id] || {}) }
          msgRx[r.emoji] = (msgRx[r.emoji] || []).filter(uid => uid !== r.uid)
          if (!msgRx[r.emoji]?.length) delete msgRx[r.emoji]
          return { ...prev, [r.message_id]: msgRx }
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(dmSub)
      supabase.removeChannel(grpSub)
      supabase.removeChannel(rxSub)
    }
  }, [])

  // ── Typing subscription (changes when conversation changes) ───
  useEffect(() => {
    if (typingCh.current) { supabase.removeChannel(typingCh.current); typingCh.current = null }
    const ch = typingChannel(selectedType, selected?.id)
    if (!ch) return

    typingCh.current = supabase.channel(`typing_watch_${ch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators', filter: `channel=eq.${ch}` }, () => {
        supabase.from('typing_indicators').select('uid, updated_at').eq('channel', ch).then(({ data }) => {
          const recent = (data || []).filter(t =>
            t.uid !== user.id && Date.now() - new Date(t.updated_at).getTime() < 4000
          )
          setTypingUsers(recent.map(t => profiles.find(p => p.id === t.uid)?.name || '...').filter(Boolean))
        })
      })
      .subscribe()

    return () => { if (typingCh.current) supabase.removeChannel(typingCh.current) }
  }, [selected, selectedType])

  // ── Scroll to bottom ──────────────────────────────────────────
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conversations, groupMessages, selected])

  // ── Load trending GIFs ────────────────────────────────────────
  useEffect(() => { if (showGifPicker && gifs.length === 0) loadGifs('') }, [showGifPicker])

  // ── Data fetch ────────────────────────────────────────────────
  async function fetchData() {
    const [profRes, dmRes, grpRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('direct_messages').select('*').or(`from_uid.eq.${user.id},to_uid.eq.${user.id}`).order('created_at', { ascending: true }),
      supabase.from('group_conversations').select('*, group_messages(id, from_uid, text, image_url, created_at)').order('created_at', { ascending: false }),
    ])

    setProfiles(profRes.data || [])

    // Group DMs by other user
    const grouped = {}
    ;(dmRes.data || []).forEach(m => {
      const other = m.from_uid === user.id ? m.to_uid : m.from_uid
      if (!grouped[other]) grouped[other] = []
      grouped[other].push(m)
    })
    setConversations(grouped)

    const unreadCounts = {}
    ;(dmRes.data || []).forEach(m => {
      if (m.to_uid === user.id && !m.read) unreadCounts[m.from_uid] = (unreadCounts[m.from_uid] || 0) + 1
    })
    setUnread(unreadCounts)

    // Filter group convos where user is a member
    const myGroups = (grpRes.data || []).filter(g => g.member_uids?.includes(user.id))
    setGroupConvos(myGroups)

    // Pre-populate group messages from the join
    const gMsgs = {}
    myGroups.forEach(g => { gMsgs[g.id] = (g.group_messages || []).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)) })
    setGroupMessages(gMsgs)

    // Fetch reactions for all messages in view
    const allMsgIds = [
      ...(dmRes.data || []).map(m => m.id),
      ...myGroups.flatMap(g => (g.group_messages || []).map(m => m.id)),
    ]
    if (allMsgIds.length > 0) {
      const { data: rxData } = await supabase.from('dm_reactions').select('*').in('message_id', allMsgIds)
      const rxMap = {}
      ;(rxData || []).forEach(r => {
        if (!rxMap[r.message_id]) rxMap[r.message_id] = {}
        if (!rxMap[r.message_id][r.emoji]) rxMap[r.message_id][r.emoji] = []
        rxMap[r.message_id][r.emoji].push(r.uid)
      })
      setReactions(rxMap)
    }

    setLoading(false)
  }

  // ── Select conversations ──────────────────────────────────────
  async function selectDm(profile) {
    setSelected(profile); setSelectedType('dm')
    setText(''); setShowGifPicker(false); setShowSearch(false); setDmSearch('')
    await supabase.from('direct_messages').update({ read: true }).eq('from_uid', profile.id).eq('to_uid', user.id).eq('read', false)
    setUnread(u => ({ ...u, [profile.id]: 0 }))
  }

  function selectGroup(convo) {
    setSelected(convo); setSelectedType('group')
    setText(''); setShowGifPicker(false); setShowSearch(false); setDmSearch('')
    setGroupUnread(u => ({ ...u, [convo.id]: 0 }))
  }

  // ── Send message ──────────────────────────────────────────────
  async function sendMessage(imageUrl = null) {
    const trimmed = text.trim()
    if (!trimmed && !imageUrl) return
    setText('')
    setShowGifPicker(false)
    await clearTypingIndicator()
    if (selectedType === 'dm' && selected) {
      await supabase.from('direct_messages').insert({ from_uid: user.id, to_uid: selected.id, text: trimmed || '', image_url: imageUrl || null, read: false })
    } else if (selectedType === 'group' && selected) {
      await supabase.from('group_messages').insert({ conversation_id: selected.id, from_uid: user.id, text: trimmed || '', image_url: imageUrl || null })
    }
  }

  async function sendGif(gifUrl) {
    setShowGifPicker(false)
    if (selectedType === 'dm' && selected) {
      await supabase.from('direct_messages').insert({ from_uid: user.id, to_uid: selected.id, text: '', image_url: gifUrl, read: false })
    } else if (selectedType === 'group' && selected) {
      await supabase.from('group_messages').insert({ conversation_id: selected.id, from_uid: user.id, text: '', image_url: gifUrl })
    }
  }

  // ── Delete message ────────────────────────────────────────────
  async function confirmDeleteMessage() {
    if (!confirmDelete) return
    if (confirmDelete.type === 'dm') {
      await supabase.from('direct_messages').delete().eq('id', confirmDelete.id)
      setConversations(prev => ({ ...prev, [confirmDelete.otherUid]: (prev[confirmDelete.otherUid] || []).filter(m => m.id !== confirmDelete.id) }))
    } else {
      await supabase.from('group_messages').delete().eq('id', confirmDelete.id)
      setGroupMessages(prev => ({ ...prev, [confirmDelete.convoId]: (prev[confirmDelete.convoId] || []).filter(m => m.id !== confirmDelete.id) }))
    }
    setConfirmDelete(null)
  }

  // ── Reactions ─────────────────────────────────────────────────
  async function toggleReaction(msgId, emoji) {
    const current = reactions[msgId]?.[emoji] || []
    const hasIt   = current.includes(user.id)
    if (hasIt) {
      await supabase.from('dm_reactions').delete().eq('message_id', msgId).eq('uid', user.id).eq('emoji', emoji)
    } else {
      await supabase.from('dm_reactions').insert({ message_id: msgId, uid: user.id, emoji })
    }
    setHoveredMsg(null)
  }

  // ── Typing indicator ──────────────────────────────────────────
  async function handleTyping() {
    const ch = typingChannel(selectedType, selected?.id)
    if (!ch) return
    if (!isTypingRef.current) {
      isTypingRef.current = true
      await supabase.from('typing_indicators').upsert({ uid: user.id, channel: ch, updated_at: new Date().toISOString() }, { onConflict: 'uid,channel' })
    }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => clearTypingIndicator(), TYPING_TIMEOUT)
  }

  async function clearTypingIndicator() {
    clearTimeout(typingTimer.current)
    if (!isTypingRef.current) return
    isTypingRef.current = false
    const ch = typingChannel(selectedType, selected?.id)
    if (ch) await supabase.from('typing_indicators').delete().eq('uid', user.id).eq('channel', ch)
  }

  // ── Image upload ──────────────────────────────────────────────
  async function uploadAndSend(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }
    setUploading(true)
    const ext      = file.name?.split('.').pop() || 'png'
    const fileName = `dm-${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: file.type })
    if (error) { alert('Upload failed.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    await sendMessage(publicUrl)
    setUploading(false)
  }

  async function handleFileUpload(e) { const f = e.target.files[0]; if (f) await uploadAndSend(f); e.target.value = '' }
  async function handlePaste(e) {
    const img = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
    if (!img) return
    e.preventDefault()
    const file = img.getAsFile()
    if (file) await uploadAndSend(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
  }

  // ── GIFs ──────────────────────────────────────────────────────
  async function loadGifs(q) { setGifsLoading(true); setGifs(await fetchGifs(q)); setGifsLoading(false) }

  // ── Create group conversation ─────────────────────────────────
  async function createGroup() {
    if (newGroupMembers.length === 0) return
    setCreatingGroup(true)
    const memberUids = [...newGroupMembers, user.id]
    const { data } = await supabase.from('group_conversations').insert({ name: newGroupName.trim() || null, member_uids: memberUids, created_by: user.id }).select().single()
    if (data) {
      setGroupConvos(prev => [{ ...data, group_messages: [] }, ...prev])
      setGroupMessages(prev => ({ ...prev, [data.id]: [] }))
      setShowNewGroup(false)
      setNewGroupMembers([])
      setNewGroupName('')
      selectGroup(data)
    }
    setCreatingGroup(false)
  }

  // ── Enable notifications ──────────────────────────────────────
  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setNotifEnabled(granted)
    if (!granted) alert('Notification permission denied. Enable it in your browser settings.')
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (loading) return <Spinner />

  // ── Computed values ───────────────────────────────────────────
  const teammates = profiles.filter(p => p.id !== user.id)

  // Build unified conversation list sorted by most recent message
  const allConvs = [
    ...teammates.map(p => ({
      type:    'dm',
      id:      p.id,
      data:    p,
      lastMsg: (conversations[p.id] || []).at(-1),
      unread:  unread[p.id] || 0,
    })),
    ...groupConvos.map(g => {
      const msgs = groupMessages[g.id] || []
      return {
        type:    'group',
        id:      g.id,
        data:    g,
        lastMsg: msgs.at(-1),
        unread:  groupUnread[g.id] || 0,
      }
    }),
  ].sort((a, b) => {
    const aT = a.lastMsg?.created_at || a.data?.created_at || '0'
    const bT = b.lastMsg?.created_at || b.data?.created_at || '0'
    return bT.localeCompare(aT)
  })

  // Current messages
  const rawMsgs = selectedType === 'dm'
    ? (selected ? (conversations[selected.id] || []) : [])
    : (selected ? (groupMessages[selected.id] || []) : [])

  const currentMsgs = dmSearch.trim()
    ? rawMsgs.filter(m => m.text?.toLowerCase().includes(dmSearch.toLowerCase()))
    : rawMsgs

  // Group header label
  function groupLabel(g) {
    if (g.name) return g.name
    const names = (g.member_uids || [])
      .filter(uid => uid !== user.id)
      .map(uid => profiles.find(p => p.id === uid)?.name?.split(' ')[0] || '?')
    return names.join(', ')
  }

  return (
    <>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 250, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Messages</div>
            <button
              onClick={() => setShowNewGroup(true)}
              title="New group chat"
              style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 7, padding: '4px 9px', cursor: 'pointer', fontSize: 12, color: N, fontFamily: 'inherit', fontWeight: 500 }}
            >
              👥 New group
            </button>
          </div>

          {/* Notification toggle */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            {!notifEnabled ? (
              <button onClick={enableNotifications} style={{ width: '100%', padding: '6px 10px', background: 'var(--primary-light)', border: '1px solid var(--primary-mid)', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: N, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                🔔 Enable notifications
              </button>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />
                Notifications on
              </div>
            )}
          </div>

          {/* Conversations list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {allConvs.map(conv => {
              const isDm      = conv.type === 'dm'
              const isGrp     = conv.type === 'group'
              const isSelected = selectedType === conv.type && selected?.id === conv.id
              const label     = isDm ? conv.data.name : groupLabel(conv.data)
              const lastText  = conv.lastMsg ? (conv.lastMsg.image_url && !conv.lastMsg.text ? '📷 Image' : conv.lastMsg.text) : 'No messages yet'

              return (
                <div key={conv.type + conv.id}
                  onClick={() => isDm ? selectDm(conv.data) : selectGroup(conv.data)}
                  style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isSelected ? 'var(--primary-light)' : 'var(--surface)', borderLeft: isSelected ? `3px solid ${N}` : '3px solid transparent', transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Avatar */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {isDm ? (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: conv.data.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: conv.data.role === 'admin' ? '#fff' : '#1e40af' }}>
                          {conv.data.ini}
                        </div>
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          👥
                        </div>
                      )}
                      {isDm && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 8, height: 8, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)' }} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: conv.unread > 0 ? 700 : 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{label}</span>
                        {conv.unread > 0 && <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}>{conv.unread}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: conv.unread > 0 ? 'var(--text-2)' : 'var(--text-4)', fontWeight: conv.unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lastText || 'No messages yet'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Conversation area ── */}
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-2)' }}>Select a conversation</div>
            <div style={{ fontSize: 13, color: 'var(--text-4)' }}>Your messages are private</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {selectedType === 'dm' ? (
                <>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: selected.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: selected.role === 'admin' ? '#fff' : '#1e40af' }}>{selected.ini}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{selected.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{selected.title} · Private message</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 22 }}>👥</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{groupLabel(selected)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {(selected.member_uids || []).map(uid => profiles.find(p => p.id === uid)?.name?.split(' ')[0] || '?').join(', ')}
                    </div>
                  </div>
                </>
              )}
              {/* Search toggle */}
              <button onClick={() => { setShowSearch(s => !s); setDmSearch('') }} style={{ background: showSearch ? 'var(--primary-light)' : 'none', border: showSearch ? `1px solid ${N}` : '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: showSearch ? N : 'var(--text-3)', fontSize: 13 }} title="Search messages">🔍</button>
            </div>

            {/* Search bar */}
            {showSearch && (
              <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <input
                  value={dmSearch}
                  onChange={e => setDmSearch(e.target.value)}
                  placeholder="Search messages…"
                  autoFocus
                  style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 7, padding: '6px 12px', fontSize: 12, outline: 'none', background: 'var(--surface)', color: 'var(--text-1)', fontFamily: 'inherit' }}
                />
                {dmSearch && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{currentMsgs.length} result{currentMsgs.length !== 1 ? 's' : ''}</div>}
              </div>
            )}

            {/* Messages */}
            <div
              style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}
              onClick={() => setShowGifPicker(false)}
            >
              {currentMsgs.length === 0 && !dmSearch && (
                <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 13, marginTop: 40 }}>
                  {selectedType === 'dm' ? `Start a conversation with ${selected.name} 👋` : 'Start the group conversation 👋'}
                </div>
              )}

              {currentMsgs.map((m, idx) => {
                const isMe    = m.from_uid === user.id
                const sender  = profiles.find(p => p.id === m.from_uid)
                const canDel  = isMe || user.role === 'admin'
                const isLast  = idx === currentMsgs.length - 1
                const showRead = selectedType === 'dm' && isMe && isLast && m.read
                const msgRx   = reactions[m.id] || {}
                const hasRx   = Object.values(msgRx).some(uids => uids.length > 0)

                return (
                  <div key={m.id || idx}
                    style={{ display: 'flex', gap: 8, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start', position: 'relative' }}
                    onMouseEnter={() => setHoveredMsg(m.id)}
                    onMouseLeave={() => setHoveredMsg(null)}
                  >
                    {/* Avatar */}
                    <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: sender?.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: sender?.role === 'admin' ? '#fff' : '#1e40af' }}>
                      {sender?.ini}
                    </div>

                    <div style={{ maxWidth: '68%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{isMe ? 'You' : sender?.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{formatTime(m.created_at)}</span>
                        {canDel && hoveredMsg === m.id && (
                          <button
                            onClick={() => setConfirmDelete({ id: m.id, type: selectedType, otherUid: selected?.id, convoId: selected?.id })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 12, padding: '0 2px', opacity: 0.7 }}
                          >🗑</button>
                        )}
                      </div>

                      {/* Bubble */}
                      {m.image_url ? (
                        <img
                          src={m.image_url}
                          alt="image"
                          onClick={() => setLightbox(m.image_url)}
                          style={{ maxWidth: 220, borderRadius: 10, cursor: 'zoom-in', display: 'block' }}
                        />
                      ) : (
                        <div style={{ background: isMe ? N : 'var(--surface)', border: isMe ? 'none' : '1px solid var(--border)', color: isMe ? '#fff' : 'var(--text-1)', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '9px 13px', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {m.text}
                        </div>
                      )}

                      {/* Reactions display */}
                      {hasRx && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          {Object.entries(msgRx).filter(([, uids]) => uids.length > 0).map(([emoji, uids]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(m.id, emoji)}
                              style={{ background: uids.includes(user.id) ? 'var(--primary-light)' : 'var(--surface-2)', border: `1px solid ${uids.includes(user.id) ? N : 'var(--border)'}`, borderRadius: 99, padding: '2px 7px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'inherit' }}
                            >
                              {emoji} <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)' }}>{uids.length}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Read receipt */}
                      {showRead && <div style={{ fontSize: 10, color: 'var(--text-4)', textAlign: 'right', marginTop: 2 }}>✓ Read</div>}
                    </div>

                    {/* Reaction picker on hover */}
                    {hoveredMsg === m.id && (
                      <div style={{ position: 'absolute', top: -28, [isMe ? 'left' : 'right']: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 8px', display: 'flex', gap: 4, boxShadow: 'var(--shadow-md)', zIndex: 10 }}>
                        {REACTION_EMOJIS.map(emoji => (
                          <button key={emoji} onClick={() => toggleReaction(m.id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                          >{emoji}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-4)', animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic' }}>
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
                  </span>
                  <style>{`@keyframes typingDot{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* GIF picker */}
            {showGifPicker && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0, maxHeight: 220, overflowY: 'auto' }}>
                <input value={gifSearch} onChange={e => { setGifSearch(e.target.value); loadGifs(e.target.value) }} placeholder="Search GIFs…" style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none', background: 'var(--surface)', color: 'var(--text-1)', fontFamily: 'inherit', marginBottom: 8 }} />
                {gifsLoading ? <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>Loading…</div> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {gifs.map(g => (
                      <img key={g.id} src={g.images?.fixed_height_small?.url} alt={g.title} onClick={() => sendGif(g.images?.downsized?.url || g.images?.fixed_height?.url)} style={{ width: '100%', borderRadius: 7, cursor: 'pointer', height: 80, objectFit: 'cover' }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setShowGifPicker(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, padding: '4px', flexShrink: 0 }} title="GIF">GIF</button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, padding: '4px', flexShrink: 0 }} title="Image">📷</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); handleTyping() }}
                onKeyDown={onKey}
                onPaste={handlePaste}
                placeholder={selectedType === 'group' ? `Message ${groupLabel(selected)}…` : `Message ${selected.name}…`}
                rows={1}
                style={{ flex: 1, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 13px', fontSize: 13, resize: 'none', outline: 'none', background: 'var(--surface)', color: 'var(--text-1)', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!text.trim() && !uploading}
                style={{ background: text.trim() ? N : 'var(--surface-3)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: text.trim() ? 'pointer' : 'default', color: text.trim() ? '#fff' : 'var(--text-4)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
              >↑</button>
            </div>
          </div>
        )}
      </div>

      {/* New group modal */}
      {showNewGroup && (
        <Modal title="New group chat" onClose={() => { setShowNewGroup(false); setNewGroupMembers([]); setNewGroupName('') }} width={420}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
            Select up to 3 teammates to add to a group chat with you (4 total).
          </div>
          <Field label="Group name (optional)">
            <input style={IS} value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Sales team" />
          </Field>
          <Field label="Add members">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {teammates.map(p => {
                const checked = newGroupMembers.includes(p.id)
                return (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: checked ? 'var(--primary-light)' : 'var(--surface-2)', borderRadius: 8, cursor: 'pointer', border: `1px solid ${checked ? N : 'var(--border)'}` }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setNewGroupMembers(prev =>
                          checked ? prev.filter(id => id !== p.id)
                                  : prev.length < 3 ? [...prev, p.id] : prev
                        )
                      }}
                      style={{ accentColor: N }}
                    />
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af' }}>{p.ini}</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{p.name}</span>
                  </label>
                )
              })}
            </div>
          </Field>
          {newGroupMembers.length === 3 && (
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8, fontStyle: 'italic' }}>Maximum of 3 members selected (4 total including you)</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => { setShowNewGroup(false); setNewGroupMembers([]); setNewGroupName('') }}>Cancel</Btn>
            <Btn onClick={createGroup} disabled={creatingGroup || newGroupMembers.length === 0}>
              {creatingGroup ? 'Creating…' : `Create group (${newGroupMembers.length + 1})`}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, cursor: 'zoom-out', padding: 24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this message?"
          message="This message will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteMessage}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
