import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R } from './shared'

const LIVE_LEAD_USERS = ['Luis', 'Jr', 'Juana', 'Destiny']

// ── Grouped navigation ────────────────────────────────────────
// Each group has an optional label and a list of nav items.
// Items with restricted:true only show for LIVE_LEAD_USERS.
// Items with adminOnly:true only show for admins.
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '◉' },
    ],
  },
  {
    label: 'SALES',
    items: [
      { id: 'sales',      label: 'Sales',           icon: '$' },
      { id: 'referrals',  label: 'Referrals',       icon: '↗' },
      { id: 'live-leads', label: 'Live Lead Recap', icon: '⚡', restricted: true },
    ],
  },
  {
    label: 'SERVICE',
    items: [
      { id: 'tasks',         label: 'Tasks',         icon: '☑' },
      { id: 'reviews',       label: 'Reviews',       icon: '★' },
      { id: 'cancellations', label: 'Cancellations', icon: '⚠' },
      { id: 'renewals',      label: 'Renewals',      icon: '↻' },
    ],
  },
  {
    label: 'CONNECT',
    items: [
      { id: 'chat', label: 'Team Chat', icon: '◎' },
      { id: 'dms',  label: 'Messages',  icon: '💬' },
    ],
  },
  {
    label: 'RESOURCES',
    items: [
      { id: 'learning',    label: 'Learning',    icon: '📚' },
      { id: 'profiles',    label: 'Profiles',    icon: '👤' },
      { id: 'suggestions', label: 'Suggestions', icon: '💡' },
    ],
  },
  {
    label: 'ADMIN',
    adminOnly: true,
    items: [
      { id: 'settings',   label: 'Settings',   icon: '⚙',  adminOnly: true },
      { id: 'audit-log',  label: 'Audit Log',  icon: '📋', adminOnly: true },
    ],
  },
]

export default function Sidebar({ user, page, setPage, onLogout, darkMode, toggleDarkMode }) {
  const [dmUnread, setDmUnread] = useState(0)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

  const isAdmin         = user.role === 'admin'
  const canSeeLiveLeads = LIVE_LEAD_USERS.includes(user.name)

  // Filter groups and items based on permissions
  const visibleGroups = NAV_GROUPS
    .filter(g => !g.adminOnly || isAdmin)
    .map(g => ({
      ...g,
      items: g.items.filter(n =>
        (!n.restricted || canSeeLiveLeads) &&
        (!n.adminOnly  || isAdmin)
      ),
    }))
    .filter(g => g.items.length > 0)

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

  const w = collapsed ? 56 : 220

  return (
    <div style={{
      width:          w,
      minWidth:       w,
      background:     N,
      display:        'flex',
      flexDirection:  'column',
      height:         '100vh',
      transition:     'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
      position:       'relative',
      flexShrink:     0,
      overflow:       'hidden',
      boxShadow:      '4px 0 24px rgba(0,0,0,0.22)',
    }}>

      {/* ── Logo + collapse button (inside header, always visible) ── */}
      <div style={{ padding: collapsed ? '13px 8px' : '13px 15px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        {collapsed ? (
          <div style={{ fontSize: 18, color: '#fff', fontWeight: 800, letterSpacing: -0.5, margin: '0 auto' }}>C</div>
        ) : (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>Castro Agency</div>
            <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 1 }}>Office hub</div>
          </div>
        )}
        {/* Collapse toggle — inside the header so it is always visible */}
        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background:   'rgba(255,255,255,0.13)',
            border:       '1px solid rgba(255,255,255,0.2)',
            borderRadius: 7,
            width:        28,
            height:       28,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            color:        'rgba(255,255,255,0.75)',
            fontSize:     15,
            fontWeight:   700,
            flexShrink:   0,
            transition:   'background 0.15s, color 0.15s',
            lineHeight:   1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.24)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* ── Nav groups ── */}
      <nav style={{ flex: 1, padding: '6px 5px', overflowY: 'auto', overflowX: 'hidden' }}>
        {visibleGroups.map((group, gi) => (
          <div key={gi}>
            {/* Group divider / label */}
            {gi > 0 && (
              collapsed ? (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '7px 8px' }} />
              ) : group.label ? (
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: 1.2, padding: '12px 10px 4px' }}>
                  {group.label}
                </div>
              ) : (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '7px 8px 6px' }} />
              )
            )}

            {/* Items */}
            {group.items.map(n => {
              const active    = page === n.id
              const isDms     = n.id === 'dms'
              const showBadge = isDms && dmUnread > 0 && page !== 'dms'

              return (
                <div
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  title={collapsed ? n.label : ''}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    padding:        collapsed ? '8px 0' : '7px 10px',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    borderRadius:   8,
                    cursor:         'pointer',
                    marginBottom:   1,
                    background:     active ? 'rgba(255,255,255,0.14)' : 'transparent',
                    color:          active ? '#fff' : 'rgba(255,255,255,0.58)',
                    fontSize:       12,
                    fontWeight:     active ? 600 : 400,
                    transition:     'background 0.12s, color 0.12s',
                    position:       'relative',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.58)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9 }}>
                    <span style={{ fontSize: 13, flexShrink: 0, width: 16, textAlign: 'center' }}>{n.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</span>}
                  </div>

                  {/* Unread badge */}
                  {showBadge && !collapsed && (
                    <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>
                      {dmUnread}
                    </span>
                  )}
                  {showBadge && collapsed && (
                    <span style={{ position: 'absolute', top: 5, right: 6, width: 8, height: 8, borderRadius: '50%', background: R, border: '2px solid #1B3A6B' }} />
                  )}

                  {/* Active indicator bar */}
                  {active && !collapsed && (
                    <span style={{ width: 3, height: 16, borderRadius: 99, background: '#fff', opacity: 0.7, flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom: user + sign out ── */}
      <div style={{ padding: collapsed ? '8px 5px' : '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>

        {/* User info */}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6, padding: '2px 2px' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: user.role === 'admin' ? R : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {user.ini}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.title}</div>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={onLogout}
          title={collapsed ? 'Sign out' : ''}
          style={{
            width:          '100%',
            background:     'rgba(255,255,255,0.05)',
            border:         '1px solid rgba(255,255,255,0.09)',
            borderRadius:   7,
            color:          'rgba(255,255,255,0.4)',
            fontSize:       collapsed ? 15 : 11,
            padding:        collapsed ? '6px 0' : '5px 0',
            cursor:         'pointer',
            fontFamily:     'inherit',
            transition:     'background 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
        >
          {collapsed ? '↩' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
