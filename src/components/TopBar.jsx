import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R } from './shared'
import SavingsCalculator from './SavingsCalculator'

const PAGE_LABELS = {
  dashboard: 'Dashboard', tasks: 'Tasks', referrals: 'Referrals',
  reviews: 'Reviews', sales: 'Sales', 'live-leads': 'Live Lead Recap',
  cancellations: 'Cancellations', renewals: 'Renewals', learning: 'Learning',
  chat: 'Team Chat', dms: 'Messages', profiles: 'Profiles', suggestions: 'Suggestions',
}

const TYPE_ICON = { mention: '💬', announcement: '📢', dm: '✉️', task: '☑️' }
const TYPE_COLOR = { mention: '#3b82f6', announcement: N, dm: '#8b5cf6', task: '#d97706' }

export default function TopBar({ user, page, setPage }) {
  const [notifications, setNotifications] = useState([])
  const [dmUnread, setDmUnread] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    fetchAll()

    const notifChannel = supabase.channel('topbar_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        if (payload.new.to_uid === user.id) {
          setNotifications(prev => [payload.new, ...prev])
        }
      })
      .subscribe()

    const dmChannel = supabase.channel('topbar_dms')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        if (payload.new.to_uid === user.id) setDmUnread(c => c + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, () => {
        fetchDmCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(dmChannel)
    }
  }, [])

  // Close panel when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Clear DM badge when navigating to DMs page
  useEffect(() => { if (page === 'dms') { setDmUnread(0) } }, [page])

  async function fetchAll() {
    const [notifs, dmCount] = await Promise.all([
      supabase.from('notifications').select('*').eq('to_uid', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false),
    ])
    setNotifications(notifs.data || [])
    setDmUnread(dmCount.count || 0)
  }

  async function fetchDmCount() {
    const { count } = await supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false)
    setDmUnread(count || 0)
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleNotifClick(notif) {
    // Mark as read
    await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    setPanelOpen(false)

    // Navigate
    if (notif.nav_target) setPage(notif.nav_target)
  }

  function formatTime(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return Math.floor(hrs / 24) + 'd ago'
  }

  const unreadNotifs = notifications.filter(n => !n.read).length
  const totalBadge = unreadNotifs + dmUnread

  return (
    <>
      <div style={{ height: 46, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        {/* Page label */}
        <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{PAGE_LABELS[page] || 'Castro Agency Hub'}</div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Savings calculator button */}
          <button
            onClick={() => setShowCalc(true)}
            title="Quick Savings Calculator"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#27500A' }}
          >
            💰 Savings calc
          </button>

          {/* Bell icon */}
          <div ref={panelRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPanelOpen(o => !o)}
              style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', border: `1px solid ${panelOpen ? N : '#e5e7eb'}`, background: panelOpen ? '#eff6ff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
            >
              🔔
              {totalBadge > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '2px 5px', minWidth: 16, textAlign: 'center', border: '2px solid #fff' }}>{totalBadge > 99 ? '99+' : totalBadge}</span>
              )}
            </button>

            {/* Notification panel */}
            {panelOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, width: 340, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', zIndex: 500, overflow: 'hidden' }}>
                {/* Panel header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Notifications</span>
                    {totalBadge > 0 && <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '2px 6px', marginLeft: 7 }}>{totalBadge} new</span>}
                  </div>
                  {unreadNotifs > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>
                  )}
                </div>

                {/* DM section if unread */}
                {dmUnread > 0 && (
                  <div
                    onClick={() => { setPage('dms'); setPanelOpen(false); setDmUnread(0) }}
                    style={{ padding: '11px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', background: '#faf5ff', borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f3e8ff'}
                    onMouseLeave={e => e.currentTarget.style.background = '#faf5ff'}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✉️</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>
                        {dmUnread} unread direct message{dmUnread !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Tap to open Messages</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: R, flexShrink: 0, marginTop: 4 }} />
                  </div>
                )}

                {/* Notifications list */}
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {notifications.length === 0 && dmUnread === 0 && (
                    <div style={{ padding: 28, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>You're all caught up! 🎉</div>
                  )}
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      style={{ padding: '11px 16px', display: 'flex', gap: 11, alignItems: 'flex-start', cursor: 'pointer', background: n.read ? '#fff' : '#eff6ff', borderBottom: '1px solid #f9fafb' }}
                      onMouseEnter={e => e.currentTarget.style.background = n.read ? '#f9fafb' : '#dbeafe'}
                      onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#eff6ff'}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: n.read ? '#f3f4f6' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                        {TYPE_ICON[n.type] || '🔔'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600, color: '#111', lineHeight: 1.4 }}>{n.title}</div>
                        {n.body && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{n.body}</div>}
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{formatTime(n.created_at)}</div>
                      </div>
                      {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: N, flexShrink: 0, marginTop: 4 }} />}
                    </div>
                  ))}
                </div>

                {notifications.length > 0 && (
                  <div style={{ padding: '9px 16px', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
                    <button onClick={async () => {
                      await supabase.from('notifications').delete().eq('to_uid', user.id).eq('read', true)
                      setNotifications(prev => prev.filter(n => !n.read))
                    }} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Clear read notifications</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCalc && <SavingsCalculator onClose={() => setShowCalc(false)} />}
    </>
  )
}
