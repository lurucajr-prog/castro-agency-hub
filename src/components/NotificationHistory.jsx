// ============================================================
// Castro Agency Hub — NotificationHistory
// Place this file at: src/components/NotificationHistory.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Spinner, EmptyState } from './shared'

const FILTERS = ['All', 'Mentions', 'Announcements', 'Sales', 'DMs', 'Tasks']

const TYPE_ICON = {
  mention:      '💬',
  announcement: '📢',
  sale:         '🎯',
  dm:           '✉️',
  task:         '☑️',
}

const TYPE_COLOR = {
  mention:      '#3b82f6',
  announcement: N,
  sale:         '#16a34a',
  dm:           '#8b5cf6',
  task:         '#d97706',
}

const FILTER_TYPE_MAP = {
  Mentions:      'mention',
  Announcements: 'announcement',
  Sales:         'sale',
  DMs:           'dm',
  Tasks:         'task',
}

function formatTime(ts) {
  const d    = new Date(ts)
  const now  = new Date()
  const diff = now - d
  const m    = Math.floor(diff / 60000)
  if (m < 1)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationHistory({ user, setPage }) {
  const [notifications, setNotifications] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('All')
  const [markingAll,    setMarkingAll]    = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('to_uid', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setNotifications(data || [])
    setLoading(false)
  }

  async function markAllRead() {
    setMarkingAll(true)
    const ids = notifications.filter(n => !n.read).map(n => n.id)
    if (ids.length > 0) {
      await supabase.from('notifications').update({ read: true }).in('id', ids)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
    setMarkingAll(false)
  }

  async function markOneRead(notif) {
    if (notif.read) return
    await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
  }

  async function handleClick(notif) {
    await markOneRead(notif)
    if (notif.nav_target) setPage(notif.nav_target)
  }

  async function clearAll() {
    if (!window.confirm('Clear all read notifications? This cannot be undone.')) return
    await supabase.from('notifications').delete().eq('to_uid', user.id).eq('read', true)
    setNotifications(prev => prev.filter(n => !n.read))
  }

  const typeFilter = FILTER_TYPE_MAP[filter]
  const visible    = filter === 'All'
    ? notifications
    : notifications.filter(n => n.type === typeFilter)

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) return <Spinner />

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>Notification history</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {notifications.length} total · {unreadCount} unread
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <Btn variant="outline" sm onClick={markAllRead} disabled={markingAll}>
              {markingAll ? 'Marking…' : `Mark all read (${unreadCount})`}
            </Btn>
          )}
          <Btn variant="outline" sm onClick={clearAll}>Clear read</Btn>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = filter === f
          const typeKey = FILTER_TYPE_MAP[f]
          const count = f === 'All'
            ? notifications.length
            : notifications.filter(n => n.type === typeKey).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? N : 'var(--border)'}`,
                background: active ? N : 'var(--surface)',
                color: active ? '#fff' : 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              {f} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          )
        })}
      </div>

      {/* List */}
      <Card p={0}>
        {visible.length === 0 ? (
          <EmptyState text="No notifications here." icon="🔔" />
        ) : (
          visible.map((n, i) => {
            const color = TYPE_COLOR[n.type] || N
            const icon  = TYPE_ICON[n.type]  || '🔔'
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '13px 16px',
                  borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none',
                  background: n.read ? 'transparent' : 'var(--primary-light)',
                  cursor: n.nav_target ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (n.nav_target) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                {/* Icon circle */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: n.read ? 'var(--surface-3)' : color + '22',
                  border: `1px solid ${n.read ? 'var(--border)' : color + '44'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: n.read ? 400 : 600,
                    color: 'var(--text-1)', lineHeight: 1.4, marginBottom: 2,
                  }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 4 }}>
                    {formatTime(n.created_at)}
                    {n.nav_target && <span style={{ marginLeft: 8, color: N }}>Tap to view</span>}
                  </div>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />
                )}
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
