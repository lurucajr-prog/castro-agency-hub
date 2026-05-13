import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R, Spinner, ConfirmModal } from './shared'

const GIPHY_KEY = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'

async function fetchGifs(query) {
  const url = query
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`
  const res  = await fetch(url)
  const data = await res.json()
  return data.data || []
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showNotification(title, body, onClick) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico', tag: 'castro-dm' })
  n.onclick = () => { window.focus(); n.close(); onClick?.() }
  setTimeout(() => n.close(), 6000)
}

export default function DirectMessages({ user, setPage, darkMode, dmTarget, onDmTargetConsumed }) {
  const [profiles,       setProfiles]       = useState([])
  const [selected,       setSelected]       = useState(null)
  const [conversations,  setConversations]  = useState({})
  const [text,           setText]           = useState('')
  const [uploading,      setUploading]      = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [lightbox,       setLightbox]       = useState(null)
  const [unread,         setUnread]         = useState({})
  const [notifEnabled,   setNotifEnabled]   = useState(Notification?.permission === 'granted')
  const [confirmDelete,  setConfirmDelete]  = useState(null)  // { id, otherUid }

  // GIF picker
  const [showGifPicker,  setShowGifPicker]  = useState(false)
  const [gifSearch,      setGifSearch]      = useState('')
  const [gifs,           setGifs]           = useState([])
  const [gifsLoading,    setGifsLoading]    = useState(false)

  const endRef      = useRef(null)
  const fileRef     = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => { selectedRef.current = selected }, [selected])

  // Auto-select a conversation when arriving from a profile DM button
  useEffect(() => {
    if (dmTarget && profiles.length > 0) {
      const target = profiles.find(p => p.id === dmTarget)
      if (target) {
        selectConversation(target)
        onDmTargetConsumed?.()
      }
    }
  }, [dmTarget, profiles])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('direct_messages_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        const msg = payload.new
        if (msg.from_uid === user.id || msg.to_uid === user.id) {
          const otherUid = msg.from_uid === user.id ? msg.to_uid : msg.from_uid
          setConversations(prev => ({ ...prev, [otherUid]: [...(prev[otherUid] || []), msg] }))
          if (msg.from_uid !== user.id) {
            const currentSel = selectedRef.current
            if (currentSel?.id !== otherUid) {
              setUnread(u => ({ ...u, [otherUid]: (u[otherUid] || 0) + 1 }))
              setProfiles(profs => {
                const sender = profs.find(p => p.id === msg.from_uid)
                if (sender) showNotification(`New message from ${sender.name}`, msg.image_url && !msg.text ? '📷 Sent an image' : msg.text, () => setPage?.('dms'))
                return profs
              })
            }
          }
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conversations, selected])

  // Load trending GIFs when picker first opens
  useEffect(() => {
    if (showGifPicker && gifs.length === 0) loadGifs('')
  }, [showGifPicker])

  async function loadGifs(q) {
    setGifsLoading(true)
    const results = await fetchGifs(q)
    setGifs(results)
    setGifsLoading(false)
  }

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
    setShowGifPicker(false)
    await supabase.from('direct_messages').update({ read: true }).eq('from_uid', profile.id).eq('to_uid', user.id).eq('read', false)
    setUnread(u => ({ ...u, [profile.id]: 0 }))
  }

  async function sendMessage(imageUrl = null) {
    const trimmed = text.trim()
    if (!trimmed && !imageUrl) return
    setText('')
    setShowGifPicker(false)
    await supabase.from('direct_messages').insert({
      from_uid:  user.id,
      to_uid:    selected.id,
      text:      trimmed || '',
      image_url: imageUrl || null,
      read:      false,
    })
  }

  async function sendGif(gifUrl) {
    setShowGifPicker(false)
    await supabase.from('direct_messages').insert({
      from_uid:  user.id,
      to_uid:    selected.id,
      text:      '',
      image_url: gifUrl,
      read:      false,
    })
  }

  async function uploadAndSend(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return }
    setUploading(true)
    const ext      = file.name ? file.name.split('.').pop() : 'png'
    const fileName = `dm-${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: file.type })
    if (error) { alert('Upload failed.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    await sendMessage(publicUrl)
    setUploading(false)
  }

  async function handleFileUpload(e) { const f = e.target.files[0]; if (f) await uploadAndSend(f); e.target.value = '' }

  async function handlePaste(e) {
    const items     = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (file) await uploadAndSend(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
  }

  async function confirmDeleteMessage() {
    if (!confirmDelete) return
    await supabase.from('direct_messages').delete().eq('id', confirmDelete.id)
    setConversations(prev => ({ ...prev, [confirmDelete.otherUid]: (prev[confirmDelete.otherUid] || []).filter(m => m.id !== confirmDelete.id) }))
    setConfirmDelete(null)
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
    const d     = new Date(ts)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (loading) return <Spinner />

  const teammates   = profiles.filter(p => p.id !== user.id)
  const currentMsgs = selected ? (conversations[selected.id] || []) : []

  return (
    <>
      <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{ width:250, borderRight:'1px solid var(--border)', background:'var(--surface)', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', marginBottom:8 }}>Direct messages</div>
            {!notifEnabled ? (
              <button onClick={enableNotifications} style={{ width:'100%', padding:'7px 10px', background:'var(--primary-light)', border:'1px solid var(--primary-mid)', borderRadius:7, cursor:'pointer', fontSize:11, color:'var(--primary)', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
                🔔 Enable notifications
              </button>
            ) : (
              <div style={{ fontSize:11, color:'var(--success)', display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--success)' }} />
                Notifications on
              </div>
            )}
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
            {teammates.map(p => {
              const msgs       = conversations[p.id] || []
              const last       = msgs[msgs.length - 1]
              const uCount     = unread[p.id] || 0
              const isSelected = selected?.id === p.id
              return (
                <div key={p.id} onClick={() => selectConversation(p)} style={{ padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid var(--border)', background: isSelected ? 'var(--primary-light)' : 'var(--surface)', borderLeft: isSelected ? `3px solid ${N}` : '3px solid transparent', transition:'background 0.12s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='var(--surface-2)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='var(--surface)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', background: p.role==='admin' ? R : 'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color: p.role==='admin' ? '#fff' : '#1e40af' }}>{p.ini}</div>
                      <div style={{ position:'absolute', bottom:1, right:1, width:9, height:9, borderRadius:'50%', background:'#16a34a', border:'2px solid var(--surface)' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:13, fontWeight: uCount > 0 ? 700 : 500, color:'var(--text-1)' }}>{p.name}</span>
                        {uCount > 0 && <span style={{ background:R, color:'#fff', borderRadius:99, fontSize:9, fontWeight:700, padding:'2px 6px', flexShrink:0 }}>{uCount}</span>}
                      </div>
                      <div style={{ fontSize:11, color: uCount > 0 ? 'var(--text-2)' : 'var(--text-4)', fontWeight: uCount > 0 ? 500 : 400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {last ? (last.image_url && !last.text ? '📷 Image' : last.text) : 'No messages yet'}
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
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:40 }}>💬</div>
            <div style={{ fontSize:15, fontWeight:500, color:'var(--text-2)' }}>Select a teammate to message</div>
            <div style={{ fontSize:13, color:'var(--text-4)' }}>Your conversations are private</div>
          </div>
        ) : (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

            {/* Header */}
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', background:'var(--surface)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background: selected.role==='admin' ? R : 'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color: selected.role==='admin' ? '#fff' : '#1e40af' }}>{selected.ini}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-1)' }}>{selected.name}</div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>{selected.title} · Private message</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:10, background:'var(--bg)' }}
              onClick={() => setShowGifPicker(false)}>
              {currentMsgs.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--text-4)', fontSize:13, marginTop:40 }}>
                  Start a conversation with {selected.name} 👋
                </div>
              )}
              {currentMsgs.map((m, idx) => {
                const isMe    = m.from_uid === user.id
                const sender  = profiles.find(p => p.id === m.from_uid)
                const canDel  = isMe || user.role === 'admin'
                // Show read receipt under last message sent by me
                const isLast  = idx === currentMsgs.length - 1
                const showRead = isMe && isLast && m.read

                return (
                  <div key={m.id || idx} style={{ display:'flex', gap:9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems:'flex-start' }}
                    onMouseEnter={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity='1' }}
                    onMouseLeave={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity='0' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, background: sender?.role==='admin' ? R : 'var(--primary-mid)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, color: sender?.role==='admin' ? '#fff' : '#1e40af' }}>{sender?.ini}</div>
                    <div style={{ maxWidth:'70%' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, flexDirection: isMe ? 'row-reverse' : 'row', marginBottom:3 }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-2)' }}>{isMe ? 'You' : sender?.name}</span>
                        <span style={{ fontSize:10, color:'var(--text-4)' }}>{formatTime(m.created_at)}</span>
                        {canDel && (
                          <button className="del-btn" onClick={() => setConfirmDelete({ id: m.id, otherUid: selected.id })} style={{ border:'none', background:'none', cursor:'pointer', fontSize:11, color:'#ef4444', opacity:0, padding:0, transition:'opacity 0.1s' }}>🗑</button>
                        )}
                      </div>
                      {m.image_url && (
                        <div style={{ marginBottom: m.text ? 6 : 0 }}>
                          <img src={m.image_url} alt="shared" onClick={() => setLightbox(m.image_url)} style={{ maxWidth:280, maxHeight:240, borderRadius:12, cursor:'zoom-in', display:'block', border:'1px solid var(--border)', objectFit:'cover' }} />
                        </div>
                      )}
                      {m.text && (
                        <div style={{ background: isMe ? N : 'var(--surface)', color: isMe ? '#fff' : 'var(--text-1)', padding:'9px 13px', borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px', fontSize:13, lineHeight:1.55, border: isMe ? 'none' : '1px solid var(--border)' }}>
                          {m.text}
                        </div>
                      )}
                      {/* Read receipt under last sent message */}
                      {showRead && (
                        <div style={{ fontSize:10, color:'var(--text-4)', marginTop:3, textAlign: isMe ? 'right' : 'left' }}>
                          ✓ Read
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {/* GIF picker */}
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
                        <img src={g.images.fixed_height_small.url} alt={g.title} style={{ width:'100%', height:130, objectFit:'cover', display:'block' }} />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:9, color:'var(--text-4)', textAlign:'right', marginTop:4 }}>Powered by GIPHY</div>
              </div>
            )}

            {/* Input */}
            <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>
              {uploading && <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:5 }}>⏳ Uploading image…</div>}
              <div style={{ display:'flex', gap:9, alignItems:'center' }}>
                <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Send image" style={{ width:38, height:38, borderRadius:'50%', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, color:'var(--text-3)', flexShrink:0 }}>📎</button>
                <button onClick={() => setShowGifPicker(s => !s)} title="Send a GIF" style={{ width:38, height:38, borderRadius:'50%', border:`1px solid ${showGifPicker ? N : 'var(--border)'}`, background: showGifPicker ? 'var(--primary-light)' : 'var(--surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color: showGifPicker ? N : 'var(--text-3)', flexShrink:0 }}>GIF</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileUpload} />
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} onPaste={handlePaste}
                  placeholder={`Message ${selected.name}… (or paste image)`}
                  disabled={uploading}
                  style={{ flex:1, fontSize:13, padding:'9px 15px', border:'1px solid var(--border)', borderRadius:22, background:'var(--surface-2)', color:'var(--text-1)', outline:'none', fontFamily:'inherit' }} />
                <button onClick={() => sendMessage()} disabled={uploading} style={{ background:N, color:'#fff', border:'none', borderRadius:22, padding:'9px 20px', fontSize:13, fontWeight:500, cursor:'pointer', flexShrink:0 }}>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, cursor:'zoom-out', padding:24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:10, objectFit:'contain' }} />
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this message?"
          message="This permanently removes the message for both people."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteMessage}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
