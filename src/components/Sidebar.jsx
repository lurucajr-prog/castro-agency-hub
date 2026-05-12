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
  { id: 'chat',          label: 'Team Chat',       icon: '◎' },
  { id: 'live-leads',    label: 'Live Lead Recap', icon: '⚡', restricted: true },
  { id: 'cancellations', label: 'Cancellations',   icon: '⚠' },
  { id: 'renewals',      label: 'Renewals',        icon: '↻' },
  { id: 'learning',      label: 'Learning',        icon: '📚' },
  { id: 'dms',           label: 'Messages',        icon: '💬' },
  { id: 'profiles',      label: 'Profiles',        icon: '👤' },
  { id: 'suggestions',   label: 'Suggestions',     icon: '💡' },
]

const DIVIDERS_BEFORE = new Set(['live-leads', 'profiles'])

export default function Sidebar({ user, page, setPage, onLogout }) {
  const [dmUnread, setDmUnread] = useState(0)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

  const canSeeLiveLeads = LIVE_LEAD_USERS.includes(user.name)
  const NAV = NAV_ALL.filter(n => !n.restricted || canSeeLiveLeads)

  function toggleCollapse() {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
      return next
    })
  }

  useEffect(() => {
    fetchUnread()
    const channel = supabase.channel('sidebar_dm_badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        if (payload.new.to_uid === user.id) setDmUnread(c => c + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { if (page === 'dms') setDmUnread(0) }, [page])

  async function fetchUnread() {
    const { count } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false)
    setDmUnread(count || 0)
  }

  const w = collapsed ? 52 : 170

  return (
    <div style={{ width: w, minWidth: w, background: N, display: 'flex', flexDirection: 'column', height: '100vh', transition: 'width 0.2s ease, min-width 0.2s ease', position: 'relative', flexShrink: 0 }}>

      {/* Logo / header */}
      <div style={{ padding: collapsed ? '14px 0' : '14px 13px 11px', borderBottom: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', textAlign: collapsed ? 'center' : 'left' }}>
        {collapsed
          ? <div style={{ fontSize: 16, color: '#fff', fontWeight: 700 }}>C</div>
          : <>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Castro Agency</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>Office hub</div>
            </>
        }
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={toggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute', top: 46, right: -11,
          width: 22, height: 22, borderRadius: '50%',
          background: '#fff', border: `1.5px solid ${N}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: N, fontWeight: 700, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >{collapsed ? '›' : '‹'}</button>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '7px 5px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV.map(n => {
          const active = page === n.id
          const showBadge = n.id === 'dms' && dmUnread > 0 && page !== 'dms'
          const showDivider = DIVIDERS_BEFORE.has(n.id)
          return (
            <div key={n.id}>
              {showDivider && <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '5px 4px' }} />}
              <div
                onClick={() => setPage(n.id)}
                title={collapsed ? n.label : ''}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: collapsed ? '8px 0' : '7px 9px',
                  justifyContent: collapsed ? 'center' : 'space-between',
                  borderRadius: 7, cursor: 'pointer', marginBottom: 1,
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize: 11.5, fontWeight: active ? 500 : 400,
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 7 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{n.icon}</span>
                  {!collapsed && n.label}
                </div>
                {showBadge && !collapsed && (
                  <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>{dmUnread}</span>
                )}
                {showBadge && collapsed && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: R, border: '1.5px solid #1B3A6B' }} />
                )}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User / sign out */}
      <div style={{ padding: collapsed ? '9px 4px' : '9px 7px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.role === 'admin' ? R : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{user.ini}</div>
            <div>
              <div style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>{user.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{user.title}</div>
            </div>
          </div>
        )}
        <button onClick={onLogout} title="Sign out" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.45)', fontSize: collapsed ? 16 : 11, padding: collapsed ? '6px 0' : '4px 0', cursor: 'pointer' }}>
          {collapsed ? '↩' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
