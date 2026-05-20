// ============================================================
// Castro Agency Hub — Clean DM Message Center (Production Restructure)
// Place this file at: src/components/DirectMessages.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R, Spinner, ConfirmModal } from './shared'

const GIPHY_KEY = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'

export default function DirectMessages({ user, dmTarget, onDmTargetConsumed }) {
  const [profiles,       setProfiles]       = useState([])
  const [selected,       setSelected]       = useState(null)
  const [conversations,  setConversations]  = useState([])
  const [text,           setText]           = useState('')
  const [uploading,      setUploading]      = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [unreadCounts,   setUnreadCounts]   = useState({})
  
  // UI Panels
  const [showGifPicker,  setShowGifPicker]  = useState(false)
  const [gifSearch,      setGifSearch]      = useState('')
  const [gifs,           setGifs]           = useState([])
  const [gifsLoading,    setGifsLoading]    = useState(false)
  const [lightbox,       setLightbox]       = useState(null)
  const [hoveredMsgId,   setHoveredMsgId]   = useState(null)
  const [confirmDelete,  setConfirmDelete]  = useState(null)

  const scrollRef   = useRef(null)
  const imgInputRef = useRef(null)
  const docInputRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    fetchStaffProfiles()
  }, [])

  useEffect(() => {
    if (dmTarget && profiles.length > 0) {
      const target = profiles.find(p => p.id === dmTarget)
      if (target) {
        initiateConversation(target)
        onDmTargetConsumed?.()
      }
    }
  }, [dmTarget, profiles])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversations])

  async function fetchStaffProfiles() {
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id)
    const normalized = (data || []).map(p => ({
      ...p,
      ini: p.ini || p.name?.slice(0, 2).toUpperCase() || '??'
    }))
    setProfiles(normalized)

    // Sync unread totals
    const countsMap = {}
    for (const item of normalized) {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_uid', item.id)
        .eq('to_uid', user.id)
        .eq('read', false)
      countsMap[item.id] = count || 0
    }
    setUnreadCounts(countsMap)
    setLoading(false)
  }

  async function initiateConversation(partner) {
    setSelected(partner)
    setShowGifPicker(false)

    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(from_uid.eq.${user.id},to_uid.eq.${partner.id}),and(from_uid.eq.${partner.id},to_uid.eq.${user.id})`)
      .order('created_at', { ascending: true })

    setConversations(data || [])

    // Flag rows as cleared
    await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('from_uid', partner.id)
      .eq('to_uid', user.id)
      .eq('read', false)
    
    setUnreadCounts(prev => ({ ...prev, [partner.id]: 0 }))

    // Establish direct secure stream listener
    supabase.channel(`private_dm_${user.id}_${partner.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        const msg = payload.new
        const activePartner = selectedRef.current
        
        if ((msg.from_uid === activePartner?.id && msg.to_uid === user.id) || (msg.from_uid === user.id && msg.to_uid === activePartner?.id)) {
          setConversations(prev => [...prev, msg])
          if (msg.from_uid === activePartner?.id) {
            supabase.from('direct_messages').update({ read: true }).eq('id', msg.id)
          }
        } else if (msg.to_uid === user.id) {
          setUnreadCounts(prev => ({ ...prev, [msg.from_uid]: (prev[msg.from_uid] || 0) + 1 }))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'direct_messages' }, payload => {
        setConversations(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
  }

  async function transmitPrivateMessage(imgUrl = null, fileUrl = null, filename = null) {
    const messageContent = text.trim()
    if (!messageContent && !imgUrl && !fileUrl) return
    const activeTarget = selectedRef.current
    if (!activeTarget) return
    setText('')
    setShowGifPicker(false)

    const { data, error } = await supabase.from('direct_messages').insert({
      from_uid: user.id,
      to_uid: activeTarget.id,
      text: messageContent || null,
      image_url: imgUrl || null,
      file_url: fileUrl || null,
      file_name: filename || null,
      read: false
    }).select().single()

    if (!error && data) {
      setConversations(prev => [...prev, data])
    }
  }

  async function uploadImageAttachment(e) {
    const file = e.target.files[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const filePath = `dm-img-${user.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(filePath, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath)
      await transmitPrivateMessage(publicUrl)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function uploadDocumentAttachment(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const normalizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `dm-doc-${user.id}-${Date.now()}-${normalizedName}`
    const { error } = await supabase.storage.from('dm-files').upload(filePath, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('dm-files').getPublicUrl(filePath)
      await transmitPrivateMessage(null, publicUrl, file.name)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    const file = item.getAsFile()
    if (file) {
      setUploading(true)
      const fileName = `dm-paste-${user.id}-${Date.now()}.png`
      const { error } = await supabase.storage.from('chat-images').upload(fileName, file, { contentType: 'image/png' })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
        await transmitPrivateMessage(publicUrl)
      }
      setUploading(false)
    }
  }

  async function searchGiphyStream(q) {
    setGifsLoading(true)
    try {
      const targetUrl = q 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`
      const res = await fetch(targetUrl)
      const out = await res.json()
      setGifs(out.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setGifsLoading(false)
    }
  }

  async function removeMessageRow() {
    if (!confirmDelete) return
    await supabase.from('direct_messages').delete().eq('id', confirmDelete.id)
    setConversations(prev => prev.filter(m => m.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); transmitPrivateMessage() }
  }

  function formatTime(ts) {
    const d     = new Date(ts)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (loading) return <Spinner />

  return (
    <>
      <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* Sidebar Roster */}
        <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Direct Messages
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {profiles.map(p => {
              const isTarget = selected?.id === p.id
              const unreads = unreadCounts[p.id] || 0
              return (
                <button key={p.id} onClick={() => initiateConversation(p)} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8, background: isTarget ? 'var(--primary-light)' : 'transparent', color: 'var(--text-1)', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: p.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: p.role === 'admin' ? '#fff' : '#1e40af', marginRight: 10 }}>{p.ini}</div>
                  <span style={{ fontSize: 13, fontWeight: unreads > 0 ? 700 : 500, flex: 1, textAlign: 'left' }}>{p.name}</span>
                  {unreads > 0 && (
                    <span style={{ background: R, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '2px 6px' }}>{unreads}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Conversation Stream */}
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 32 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)' }}>Select a teammate to chat securely</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Upper Context Header */}
            <div style={{ height: 52, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: selected.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: selected.role === 'admin' ? '#fff' : '#1e40af' }}>{selected.ini}</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{selected.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-4)' }}>({selected.title})</span>
            </div>

            {/* Scrollable Bubble Box */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }} onClick={() => setShowGifPicker(false)}>
              {conversations.map((m, idx) => {
                const isMe = m.from_uid === user.id
                const activeHover = hoveredMsgId === m.id
                
                const prev = conversations[idx - 1]
                const isGrouped = prev && prev.from_uid === m.from_uid && (new Date(m.created_at) - new Date(prev.created_at) < 300000)

                return (
                  <div key={m.id || idx} onMouseEnter={() => setHoveredMsgId(m.id)} onMouseLeave={() => setHoveredMsgId(null)} style={{ display: 'flex', gap: 12, width: '100%', position: 'relative', marginTop: isGrouped ? 2 : 12, padding: '2px 8px', borderRadius: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    
                    <div style={{ width: 32, height: 32, flexShrink: 0 }}>
                      {!isGrouped && (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: isMe ? (user.role==='admin'?R:'var(--primary-mid)') : (selected.role==='admin'?R:'var(--primary-mid)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: (isMe ? user.role : selected.role) === 'admin' ? '#fff' : '#1e40af' }}>
                          {isMe ? user.name?.slice(0,2).toUpperCase() : selected.ini}
                        </div>
                      )}
                    </div>

                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isGrouped && (
                        <span style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 2 }}>
                          {formatTime(m.created_at)}
                        </span>
                      )}

                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Ironclad High-Contrast Color Theme Logic (Safe across Light & Dark views) */}
                        <div style={{ 
                          background: isMe ? 'var(--primary)' : 'var(--surface-2)', 
                          color: isMe ? '#ffffff' : 'var(--text-1)', 
                          border: isMe ? 'none' : '1px solid var(--border)', 
                          borderRadius: 12, padding: m.text ? '8px 14px' : '4px', 
                          boxShadow: 'var(--shadow-xs)' 
                        }}>
                          {m.file_url && (
                            <a href={m.file_url} target="_blank" rel="noreferrer" download style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: isMe ? '#ffffff' : 'var(--primary)', fontSize: 12, fontWeight: 600 }}>
                              <span>📄</span> {m.file_name || 'Download file'}
                            </a>
                          )}
                          {m.image_url && (
                            <img src={m.image_url} alt="DM asset" onClick={() => setLightbox(m.image_url)} style={{ maxWidth: 240, maxHeight: 200, borderRadius: 8, display: 'block', cursor: 'zoom-in', objectFit: 'cover' }} />
                          )}
                          {m.text && <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>}
                        </div>

                        {activeHover && (
                          <button onClick={() => setConfirmDelete(m)} style={{ border: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#dc2626', boxShadow: 'var(--shadow-sm)' }} title="Delete">🗑️</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input Dock Control */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
              {showGifPicker && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 10, boxShadow: 'var(--shadow-md)' }}>
                  <input value={gifSearch} onChange={e => { setGifSearch(e.target.value); searchGiphyStream(e.target.value) }} placeholder="Search GIPHY streams..." style={{ width: '100%', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, background: 'var(--bg)', color: 'var(--text-1)', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                    {gifsLoading ? <div style={{ gridColumn:'1/-1', textAlign:'center', padding:10 }}><Spinner /></div> : gifs.map(g => (
                      <img key={g.id} src={g.images?.fixed_height_small?.url} alt="gif" onClick={() => transmitPrivateMessage(g.images?.original?.url)} style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => imgInputRef.current?.click()} disabled={uploading} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 14 }} title="Upload Photo">📷</button>
                <button onClick={() => docInputRef.current?.click()} disabled={uploading} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 14 }} title="Attach Document">📎</button>
                <button onClick={() => { setShowGifPicker(!showGifPicker); if(!showGifPicker) searchGiphyStream('') }} style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>GIF</button>

                <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadImageAttachment} />
                <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" style={{ display: 'none' }} onChange={uploadDocumentAttachment} />

                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} onPaste={handlePaste} placeholder={uploading ? 'Uploading…' : `Message ${selected.name}...`} disabled={uploading} style={{ flex: 1, padding: '9px 15px', border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={() => transmitPrivateMessage()} disabled={uploading || (!text.trim())} style={{ background: N, color: '#fff', border: 'none', borderRadius: 22, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>Send</button>
              </div>
            </div>

          </div>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'zoom-out', padding: 24 }}>
          <img src={lightbox} alt="full size" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain' }} />
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal title="Remove private message?" message="This will clear this message from both participants' logs permanently." confirmLabel="Delete" danger onConfirm={removeMessageRow} onCancel={() => setConfirmDelete(null)} />
      )}
    </>
  )
}
