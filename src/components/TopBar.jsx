// ============================================================
// Castro Agency Hub — TopBar
// Place this file at: src/components/TopBar.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase }      from '../lib/supabase'
import { N, R }          from './shared'
import SavingsCalculator from './SavingsCalculator'

const PAGE_LABELS = {
  dashboard:     'Dashboard',
  tasks:         'Tasks',
  referrals:     'Referrals',
  reviews:       'Reviews',
  sales:         'Sales',
  'live-leads':  'Live Lead Recap',
  cancellations: 'Cancellations',
  renewals:      'Renewals',
  learning:      'Learning',
  chat:          'Team Chat',
  dms:           'Messages',
  profiles:      'Profiles',
  suggestions:   'Suggestions',
  settings:      'Admin Settings',
  'audit-log':   'Audit Log',
}

const TYPE_ICON  = { mention: '💬', announcement: '📢', dm: '✉️', task: '☑️' }
const TYPE_COLOR = { mention: '#3b82f6', announcement: N, dm: '#8b5cf6', task: '#d97706' }

export default function TopBar({ user, page, setPage, darkMode, toggleDarkMode }) {
  const [notifications, setNotifications] = useState([])
  const [dmUnread,      setDmUnread]      = useState(0)
  const [panelOpen,     setPanelOpen]     = useState(false)
  const [showCalc,      setShowCalc]      = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    fetchAll()

    // Real-time: new notifications
    const notifCh = supabase.channel('topbar_notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        if (payload.new.to_uid === user.id) {
          setNotifications(prev => [payload.new, ...prev])
          setUnreadNotifs(c => c + 1)
          // Trigger browser push if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            const n = payload.new
            new Notification(n.title || 'Castro Agency Hub', {
              body:  n.body  || '',
              icon:  '/favicon.ico',
              tag:   `notif-${n.id}`,
            })
          }
        }
      })
      .subscribe()

    // Real-time: new/updated DMs
    const dmCh = supabase.channel('topbar_dms')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        if (payload.new.to_uid === user.id) setDmUnread(c => c + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, () => {
        fetchDmCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(notifCh)
      supabase.removeChannel(dmCh)
    }
  }, [])

  // Close panel when clicking outside
  useEffect(() => {
    function onClickOut(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [])

  // Keyboard shortcut: N key opens notifications
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        setPanelOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Clear DM badge when navigating to DMs
  useEffect(() => { if (page === 'dms') setDmUnread(0) }, [page])

  async function fetchAll() {
    const [notifs, dmCount] = await Promise.all([
      supabase.from('notifications').select('*').eq('to_uid', user.id).order('created_at', { ascending: false }).limit(40),
      supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('to_uid', user.id).eq('read', false),
    ])
    setNotifications(notifs.data || [])
    setDmUnread(dmCount.count || 0)
  }

  async function fetchDmCount() {
    const { count } = await supabase
      .from('direct_messages').select('*', { count: 'exact', head: true })
      .eq('to_uid', user.id).eq('read', false)
    setDmUnread(count || 0)
  }

  async function markAllRead() {
    const ids = notifications.filter(n => !n.read).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleNotifClick(notif) {
    await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    setPanelOpen(false)
    if (notif.nav_target) setPage(notif.nav_target)
  }

  function formatTime(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return Math.floor(h / 24) + 'd ago'
  }

  const unreadNotifs = notifications.filter(n => !n.read).length
  const totalBadge   = unreadNotifs + dmUnread

  return (
    <>
      <div style={{
        height:         46,
        background:     'var(--topbar-bg)',
        borderBottom:   '1px solid var(--topbar-border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 20px',
        flexShrink:     0,
        transition:     'background 0.25s',
      }}>

        {/* Page label */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
          {PAGE_LABELS[page] || 'Castro Agency Hub'}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Savings calculator */}
          <button
            onClick={() => setShowCalc(true)}
            title="Quick Savings Calculator"
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         5,
              padding:     '5px 12px',
              background:  '#EAF3DE',
              border:      '1px solid #C0DD97',
              borderRadius: 7,
              cursor:      'pointer',
              fontSize:    12,
              fontWeight:  500,
              color:       '#27500A',
              transition:  'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            💰 Savings calc
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width:        34,
              height:       34,
              borderRadius: '50%',
              border:       '1px solid var(--border)',
              background:   'var(--surface)',
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontSize:     16,
              transition:   'background 0.15s',
              color:        'var(--text-2)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Notification bell */}
          <div ref={panelRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPanelOpen(o => !o)}
              title="Notifications (N)"
              style={{
                position:  'relative',
                width:     34,
                height:    34,
                borderRadius: '50%',
                border:    `1px solid ${panelOpen ? N : 'var(--border)'}`,
                background: panelOpen ? 'var(--primary-light)' : 'var(--surface)',
                cursor:    'pointer',
                display:   'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize:  17,
                transition: 'background 0.15s',
              }}
            >
              🔔
              {totalBadge > 0 && (
                <span style={{
                  position:    'absolute',
                  top:         -2,
                  right:       -2,
                  background:  R,
                  color:       '#fff',
                  borderRadius: 99,
                  fontSize:    9,
                  fontWeight:  700,
                  padding:     '2px 5px',
                  minWidth:    16,
                  textAlign:   'center',
                  border:      '2px solid var(--topbar-bg)',
                }}>
                  {totalBadge > 99 ? '99+' : totalBadge}
                </span>
              )}
            </button>

            {/* Notification panel */}
            {panelOpen && (
              <div style={{
                position:     'absolute',
                top:          '110%',
                right:        0,
                width:        340,
                background:   'var(--surface)',
                border:       '1px solid var(--border)',
                borderRadius: 12,
                boxShadow:    'var(--shadow-lg)',
                zIndex:       500,
                overflow:     'hidden',
              }}>
                {/* Panel header */}
                <div style={{
                  padding:        '12px 16px',
                  borderBottom:   '1px solid var(--border)',
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Notifications</span>
                    {totalBadge > 0 && (
                      <span style={{ background: R, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '2px 6px', marginLeft: 7 }}>
                        {totalBadge} new
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {unreadNotifs > 0 && (
                      <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                {/* Push notification permission nudge */}
                {'Notification' in window && Notification.permission !== 'granted' && (
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--primary-light)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 3 }}>
                      🔔 Get alerts when you're away
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>
                      Enable browser notifications to get alerted for DMs and @mentions even when you're on another tab.
                    </div>
                    {Notification.permission === 'denied' ? (
                      <div style={{ fontSize: 11, color: 'var(--danger)', lineHeight: 1.5 }}>
                        Notifications are blocked. Click the 🔒 lock icon in your browser's address bar to allow them for this site.
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          await Notification.requestPermission()
                          setPanelOpen(false)
                        }}
                        style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'var(--primary)', border: 'none', borderRadius: 6, padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Enable notifications
                      </button>
                    )}
                  </div>
                )}

                {/* DM row */}
                {dmUnread > 0 && (
                  <div
                    onClick={() => { setPage('dms'); setPanelOpen(false); setDmUnread(0) }}
                    style={{
                      padding:    '11px 16px',
                      display:    'flex',
                      gap:        12,
                      alignItems: 'flex-start',
                      cursor:     'pointer',
                      background: 'var(--purple-light)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                      ✉️
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
                        {dmUnread} unread direct message{dmUnread !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Tap to open Messages</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: R, flexShrink: 0, marginTop: 5 }} />
                  </div>
                )}

                {/* Notifications list */}
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {notifications.length === 0 && dmUnread === 0 && (
                    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                      You're all caught up! 🎉
                    </div>
                  )}
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      style={{
                        padding:      '11px 16px',
                        display:      'flex',
                        gap:          11,
                        alignItems:   'flex-start',
                        cursor:       'pointer',
                        background:   n.read ? 'var(--surface)' : 'var(--primary-light)',
                        borderBottom: '1px solid var(--border)',
                        transition:   'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                      onMouseLeave={e => e.currentTarget.style.background = n.read ? 'var(--surface)' : 'var(--primary-light)'}
                    >
                      <div style={{
                        width:          34,
                        height:         34,
                        borderRadius:   '50%',
                        background:     n.read ? 'var(--surface-3)' : 'var(--primary-mid)',
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        fontSize:       15,
                        flexShrink:     0,
                      }}>
                        {TYPE_ICON[n.type] || '🔔'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600, color: 'var(--text-1)', lineHeight: 1.4 }}>
                          {n.title}
                        </div>
                        {n.body && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {n.body}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 3 }}>
                          {formatTime(n.created_at)}
                        </div>
                      </div>
                      {!n.read && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: N, flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div style={{ padding: '9px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      onClick={async () => {
                        await supabase.from('notifications').delete().eq('to_uid', user.id).eq('read', true)
                        setNotifications(prev => prev.filter(n => !n.read))
                      }}
                      style={{ fontSize: 11, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Clear read notifications
                    </button>
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
