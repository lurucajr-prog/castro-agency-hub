import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, SectionHeader, Chip, Avatar, Spinner, pct, pcol } from './shared'

export default function Dashboard({ user, setPage }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [tasks, sales, revs, refs, profiles] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('reviews').select('*'),
      supabase.from('referrals').select('*'),
      supabase.from('profiles').select('*'),
    ])
    setData({
      tasks: tasks.data || [],
      sales: sales.data || [],
      revs: revs.data || [],
      refs: refs.data || [],
      profiles: profiles.data || [],
    })
    setLoading(false)
  }

  if (loading) return <Spinner />

  const { tasks, sales, revs, refs, profiles } = data
  const isAdmin = user.role === 'admin'
  const members = profiles.filter(p => p.role === 'member')

  const myTasks = tasks.filter(t => t.uid === user.id)
  const mySales = sales.filter(s => s.uid === user.id)

  const totalPrem = sales.reduce((s, x) => s + (x.premium || 0), 0)
  const revDone = revs.filter(r => r.result === 'Left a Review').length

  // Top referrers
  const rc = {}
  refs.forEach(r => { rc[r.referred_by] = (rc[r.referred_by] || 0) + 1 })
  const topRefs = Object.entries(rc).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // Sales leaderboard (agents only)
  const saleRank = members
    .map(m => ({ m, n: sales.filter(s => s.uid === m.id).length }))
    .sort((a, b) => b.n - a.n)

  const medals = ['🥇', '🥈', '🥉', '4.', '5.', '6.', '7.']

  const stats = [
    { label: isAdmin ? 'Total tasks' : 'My tasks', val: isAdmin ? tasks.length : myTasks.length, sub: (isAdmin ? tasks.filter(t => t.done).length : myTasks.filter(t => t.done).length) + ' completed', c: '#1e40af' },
    { label: 'Policies sold', val: isAdmin ? sales.length : mySales.length, sub: 'this month', c: '#166534' },
    { label: 'Total premium', val: '$' + totalPrem.toLocaleString(), sub: 'this month', c: '#92400e' },
    { label: 'Review requests', val: revs.length, sub: revDone + ' left a review', c: '#991b1b' },
  ]

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>
          Good morning, {user.name} 👋
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{today} · Here's your overview</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.c, lineHeight: 1, marginBottom: 2 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Lower grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Team progress or my tasks */}
        <Card>
          <SectionHeader title={isAdmin ? 'Team progress' : 'My tasks'} action="View all" onAction={() => setPage('tasks')} />
          {isAdmin
            ? members.map(m => {
                const mt = tasks.filter(t => t.uid === m.id)
                const done = mt.filter(t => t.done).length
                const p = mt.length ? Math.round(done / mt.length * 100) : 0
                const bc = p === 100 ? '#16a34a' : p > 50 ? '#d97706' : '#dc2626'
                return (
                  <div key={m.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Avatar ini={m.ini} isAdmin={false} size={20} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{m.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: bc, fontWeight: 500 }}>{done}/{mt.length}</span>
                    </div>
                    <div style={{ height: 3, background: '#f3f4f6', borderRadius: 99 }}>
                      <div style={{ width: p + '%', height: '100%', background: bc, borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })
            : myTasks.slice(0, 5).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{
                    width: 13, height: 13, borderRadius: 3,
                    border: `1.5px solid ${t.done ? '#16a34a' : '#d1d5db'}`,
                    background: t.done ? '#16a34a' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: '#fff', fontWeight: 700, flexShrink: 0,
                  }}>{t.done ? '✓' : ''}</div>
                  <span style={{ fontSize: 12, flex: 1, color: '#111', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
                  <Chip label={t.pri} />
                </div>
              ))
          }
          {isAdmin && members.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 12 }}>No agents yet.</div>}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Leaderboard */}
          <Card>
            <SectionHeader title="Sales leaderboard" action="View all" onAction={() => setPage('sales')} />
            {saleRank.map(({ m, n }, i) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < saleRank.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, minWidth: 20 }}>{medals[i]}</span>
                  <span style={{ fontSize: 12, color: '#111' }}>{m.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: N }}>{n} sold</span>
              </div>
            ))}
            {saleRank.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 8 }}>No sales yet.</div>}
          </Card>

          {/* Top referrers */}
          <Card>
            <SectionHeader title="Top referrers" action="View all" onAction={() => setPage('referrals')} />
            {topRefs.map(([name, count], i) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < topRefs.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>{['🥇','🥈','🥉'][i]}</span>
                  <span style={{ fontSize: 12, color: '#111' }}>{name.split(',')[0]}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: N }}>{count} ref{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
            {topRefs.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 8 }}>No referrals yet.</div>}
          </Card>
        </div>
      </div>
    </div>
  )
}
