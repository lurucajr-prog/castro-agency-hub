// ============================================================
// Castro Agency Hub — Premium DM Message Center
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R, Spinner, ConfirmModal, Btn } from './shared'

const GIPHY_KEY = 'hVI3D0LSXkqeSmspoXlBxQjC7pl27yLJ'

export default function DirectMessages({ user, dmTarget, onDmTargetConsumed }) {
  const [profiles, setProfiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [conversations, setConversations] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStaffProfiles()
  }, [])

  async function fetchStaffProfiles() {
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id)
    setProfiles((data || []).map(p => ({ ...p, ini: p.ini || p.name?.slice(0, 2).toUpperCase() || '??' })))
    setLoading(false)
  }

  async function initiateConversation(partner) {
    setSelected(partner)
    const { data } = await supabase.from('direct_messages').select('*').or(`and(from_uid.eq.${user.id},to_uid.eq.${partner.id}),and(from_uid.eq.${partner.id},to_uid.eq.${user.id})`).order('created_at', { ascending: true })
    setConversations(data || [])
    
    supabase.channel(`dm_${user.id}_${partner.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        setConversations(prev => [...prev, payload.new])
      }).subscribe()
  }

  async function send() {
    if (!text.trim() || !selected) return
    const msg = text.trim()
    setText('')
    await supabase.from('direct_messages').insert({ from_uid: user.id, to_uid: selected.id, text: msg })
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', background: 'var(--bg)' }}>
      <div style={{ width: 250, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {profiles.map(p => (
          <button key={p.id} onClick={() => initiateConversation(p)} style={{ padding: 16, border: 'none', background: selected?.id === p.id ? 'var(--surface-2)' : 'transparent', textAlign: 'left', cursor: 'pointer' }}>
            {p.name}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {conversations.map(m => (
            <div key={m.id} style={{ margin: '10px 0', textAlign: m.from_uid === user.id ? 'right' : 'left' }}>
              <div style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 12, background: m.from_uid === user.id ? N : 'var(--surface-2)', color: m.from_uid === user.id ? '#fff' : 'var(--text-1)' }}>{m.text}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => {if(e.key==='Enter') send()}} style={{ flex:1, padding:10, borderRadius:20, border:'1px solid var(--border)' }} />
            <Btn onClick={send}>Send</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
