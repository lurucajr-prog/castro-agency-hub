import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R } from './shared'

const LIVE_LEAD_USERS = ['Luis', 'Jr', 'Juana', 'Destiny']

const NAV_ALL = [
  { id: 'dashboard',     label: 'Dashboard',      icon: '◉' },
  { id: 'tasks',         label: 'Tasks',           icon: '☑' },
  { id: 'referrals',     label: 'Referrals',       icon: '↗' },
  { id: 'reviews',       label: 'Reviews',         icon: '★' },
  { id: 'sales',         label: 'Sales',           icon: '$' },
  { id: 'live-leads',    label: 'Live Lead Recap', icon: '⚡', restricted: true },
  { id: 'cancellations', label: 'Cancellations',   icon: '⚠' },
  { id: 'renewals',      label: 'Renewals',        icon: '↻' },
  { id: 'learning',      label: 'Learning',        icon: '📚' },
  { id: 'chat',          label: 'Team chat',       icon: '◎' },
  { id: 'dms',           label: 'Messages',        icon: '💬' },
]

export default function Sidebar({ user, page, setPage, onLogout }) {
  const [dmUnread, setDmUnread] = useState(0)
  const canSeeLiveLeads = LIVE_LEAD_USERS.includes(user.name)
  const NAV = NAV_ALL.filter(n => !n.restricted || canSeeLiveLeads)

  useEffect(() => {
    fetchUnread()
    const channel = supabase
      .channel('sidebar_dm_badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        if (payload.new.to_uid === user.id) setDmUnread(c => c + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { if (page === 'dms') setDmUnread(0) }, [page])

  async function fetchUnread() {
    const { count } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_uid', user.id)
      .eq('read', false)
    setDmUnread(count || 0)
  }

  return (
    <div style={{ width: 170, background: N, display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh' }}>
      <div style={{ padding: '14px 13px 11px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Castro Agency</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>Office hub</div>
      </div>

      <nav style={{ flex: 1, padding: '7px 5px', overflowY: 'auto' }}>
        {NAV.map(n => {
          const active = page === n.id
          const showBadge = n.id === 'dms' && dmUnread > 0 && page !== 'dms'
          const showDivider = n.id === 'live-leads'
          return (
            <div key={n.id}>
              {showDivider && <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '5px 4px' }} />}
              <div
                onClick={() => setPage(n.id)}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 1,
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize: 11.5, fontWeight: active ? 500 : 400,
                  justifyContent: 'space-between',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 12 }}>{n.icon}</span>
                  {n.label}
                </div>
                {showBadge && (
                  <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>{dmUnread}</span>
                )}
              </div>
            </div>
          )
        })}
      </nav>

      <div style={{ padding: '9px 7px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: user.role === 'admin' ? R : 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 600, color: '#fff', flexShrink: 0,
          }}>{user.ini}</div>
          <div>
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>{user.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{user.title}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.45)', fontSize: 11, padding: '4px 0', cursor: 'pointer' }}>Sign out</button>
      </div>
    </div>
  )
}
