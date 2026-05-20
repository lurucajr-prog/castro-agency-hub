// ============================================================
// Castro Agency Hub — Premium DM Message Center (Production Restructure)
// Place this file at: src/components/DirectMessages.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R, Spinner, ConfirmModal, Btn } from './shared'
const GIPHY_KEY = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'

export default function DirectMessages({ user, dmTarget, onDmTargetConsumed }) {
  const [profiles,       setProfiles]       = useState([])
  const [selected,       setSelected]       = useState(null)
  const [conversations,  setConversations]  = useState([])
  const [text,           setText]           = useState('')
  const [uploading,      setUploading]      = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [unreadCounts,   setUnreadCounts]   = useState({})
  const [lastPreviews,   setLastPreviews]   = useState({})
  
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
  useEffect(() => { fetchStaffProfiles() }, [])

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [conversations])

  async function fetchStaffProfiles() {
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id)
    const normalized = (data || []).map(p => ({ ...p, ini: p.ini || p.name?.slice(0, 2).toUpperCase() || '??' }))
    setProfiles(normalized)

    const countsMap = {}
    const previewsMap = {}
    for (const item of normalized) {
      const { count } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('from_uid', item.id).eq('to_uid', user.id).eq('read', false)
      countsMap[item.id] = count || 0
      const { data: lastMsg } = await supabase.from('direct_messages').select('*').or(`and(from_uid.eq.${user.id},to_uid.eq.${item.id}),and(from_uid.eq.${item.id},to_uid.eq.${user.id})`).order('created_at', { ascending: false }).limit(1)
      previewsMap[item.id] = lastMsg?.[0] || null
    }
    setUnreadCounts(countsMap)
    setLastPreviews(previewsMap)
    setLoading(false)
  }

  async function initiateConversation(partner) {
    setSelected(partner)
    setShowGifPicker(false)
    const { data } = await supabase.from('direct_messages').select('*').or(`and(from_uid.eq.${user.id},to_uid.eq.${partner.id}),and(from_uid.eq.${partner.id},to_uid.eq.${user.id})`).order('created_at', { ascending: true })
    setConversations(data || [])
    await supabase.from('direct_messages').update({ read: true }).eq('from_uid', partner.id).eq('to_uid', user.id).eq('read', false)
    setUnreadCounts(prev => ({ ...prev, [partner.id]: 0 }))

    supabase.channel(`private_dm_${user.id}_${partner.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        const msg = payload.new
        if ((msg.from_uid === partner.id && msg.to_uid === user.id) || (msg.from_uid === user.id && msg.to_uid === partner.id)) {
          setConversations(prev => [...prev, msg])
          if (msg.from_uid === partner.id) supabase.from('direct_messages').update({ read: true }).eq('id', msg.id)
        }
      })
      .subscribe()
  }

  async function transmitPrivateMessage(imgUrl = null, fileUrl = null, filename = null) {
    if (!text.trim() && !imgUrl && !fileUrl) return
    const target = selectedRef.current
    if (!target) return
    const content = text.trim()
    setText('')
    const { data } = await supabase.from('direct_messages').insert({ from_uid: user.id, to_uid: target.id, text: content || null, image_url: imgUrl, file_url: fileUrl, file_name: filename, read: false }).select().single()
    if (data) {
      setConversations(prev => [...prev, data])
      setLastPreviews(prev => ({ ...prev, [target.id]: data }))
    }
  }

  function formatDateDivider(dateString) {
    const d = new Date(dateString)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ width: 250, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', fontSize: 13, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>Direct Messages</div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {profiles.map(p => {
            const isTarget = selected?.id === p.id
            const unreads = unreadCounts[p.id] || 0
            const last = lastPreviews[p.id]
            return (
              <button key={p.id} onClick={() => initiateConversation(p)} style={{ display: 'flex', width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border)', background: isTarget ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#1e40af', marginRight: 12 }}>{p.ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: unreads > 0 ? 800 : 600, color: 'var(--text-1)' }}>{p.name}</span>
                    {unreads > 0 && <span style={{ background: R, color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px' }}>{unreads}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: unreads > 0 ? 'var(--text-1)' : 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {last ? (last.text || '📎 File / 📷 Photo') : 'No messages'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {!selected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 350 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>Private Workspace</div>
            <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 8 }}>Select a teammate to start a secure conversation.</div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 24px', fontWeight: 800 }}>{selected.name}</div>
          
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
            {conversations.map((m, idx) => {
              const isMe = m.from_uid === user.id
              const showDate = !conversations[idx-1] || new Date(m.created_at).toDateString() !== new Date(conversations[idx-1].created_at).toDateString()
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  {showDate && (
                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', fontSize: 11, color: 'var(--text-4)', fontWeight: 700 }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span style={{ padding: '0 10px' }}>{formatDateDivider(m.created_at)}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 10, marginTop: 12 }}>
                    <div style={{ background: isMe ? 'var(--primary)' : 'var(--surface-2)', color: isMe ? '#fff' : 'var(--text-1)', padding: '10px 16px', borderRadius: 12, fontSize: 14, maxWidth: '70%' }}>
                      {m.text}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter') transmitPrivateMessage() }} placeholder={`Message ${selected.name}...`} style={{ flex: 1, padding: '10px 16px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface-2)', outline: 'none' }} />
              <Btn onClick={() => transmitPrivateMessage()}>Send</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
