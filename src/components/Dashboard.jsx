import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Spinner } from './shared'

const PODIUM_COLORS = [
  { bg: '#EAF3DE', tx: '#27500A', border: '#C0DD97' },
  { bg: '#E6F1FB', tx: '#0C447C', border: '#B5D4F4' },
  { bg: '#FAEEDA', tx: '#633806', border: '#FAC775' },
]

export default function Dashboard({ user, setPage }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quoteText, setQuoteText] = useState('')
  const [quoteAuthor, setQuoteAuthor] = useState('')
  const [editingQuote, setEditingQuote] = useState(false)
  const [quoteDraft, setQuoteDraft] = useState({ text: '', author: '' })
  const [savingQuote, setSavingQuote] = useState(false)

  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [tasks, sales, revs, refs, profiles, goals, settings] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('reviews').select('*'),
      supabase.from('referrals').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('settings').select('*').in('key', ['quote_text', 'quote_author']),
    ])
    setData({
      tasks: tasks.data || [],
      sales: sales.data || [],
      revs: revs.data || [],
      refs: refs.data || [],
      profiles: profiles.data || [],
      goals: goals.data || [],
    })
    const s = settings.data || []
    const qt = s.find(x => x.key === 'quote_text')?.value || 'Make today count.'
    const qa = s.find(x => x.key === 'quote_author')?.value || ''
    setQuoteText(qt)
    setQuoteAuthor(qa)
    setLoading(false)
  }

  async function saveQuote() {
    if (!quoteDraft.text.trim()) return
    setSavingQuote(true)
    await Promise.all([
      supabase.from('settings').upsert({ key: 'quote_text', value: quoteDraft.text.trim() }),
      supabase.from('settings').upsert({ key: 'quote_author', value: quoteDraft.author.trim() }),
    ])
    setQuoteText(quoteDraft.text.trim())
    setQuoteAuthor(quoteDraft.author.trim())
    setEditingQuote(false)
    setSavingQuote(false)
  }

  if (loading) return <Spinner />

  const { tasks, sales, revs, refs, profiles, goals } = data
  const members = profiles.filter(p => p.role === 'member')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthSales = sales.filter(s => s.created_at >= monthStart)
  const totalPrem = monthSales.reduce((s, x) => s + (x.premium || 0), 0)

  const goalsMap = {}
  goals.forEach(g => { goalsMap[g.uid] = g })
  const totalPremGoal = members.reduce((sum, m) => sum + (goalsMap[m.id]?.premium || 10000), 0)
  const premPct = totalPremGoal ? Math.min(100, Math.round(totalPrem / totalPremGoal * 100)) : 0

  const myTasks = tasks.filter(t => t.uid === user.id)
  const myTasksDone = myTasks.filter(t => t.done).length
  const myMonthSales = monthSales.filter(s => s.uid === user.id)
  const myPrem = myMonthSales.reduce((s, x) => s + (x.premium || 0), 0)
  const revDone = revs.filter(r => r.result === 'Left a Review').length

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - now.getDate()

  const stats = [
    { label: 'Premium this month', val: '$' + totalPrem.toLocaleString(), sub: premPct + '% of goal', pct: premPct, bg: '#EAF3DE', tx: '#27500A', bar: '#639922' },
    { label: isAdmin ? 'Items sold' : 'My items sold', val: isAdmin ? monthSales.length : myMonthSales.length, sub: isAdmin ? members.length + ' agents' : '$' + myPrem.toLocaleString() + ' premium', pct: null, bg: '#E6F1FB', tx: '#0C447C', bar: '#378ADD' },
    { label: isAdmin ? 'Total tasks' : 'My tasks', val: isAdmin ? tasks.length : myTasks.length, sub: isAdmin ? tasks.filter(t => t.done).length + ' completed' : myTasksDone + '/' + myTasks.length + ' done', pct: null, bg: '#EEEDFE', tx: '#3C3489', bar: '#7F77DD' },
    { label: 'Review requests', val: revs.length, sub: revDone + ' left a review', pct: revs.length ? Math.round(revDone / revs.length * 100) : 0, bg: '#FAEEDA', tx: '#633806', bar: '#BA7517' },
  ]

  // Leaderboard sorted by premium
  const lbData = members
    .map(m => ({
      m,
      prem: monthSales.filter(s => s.uid === m.id).reduce((s, x) => s + (x.premium || 0), 0),
      items: monthSales.filter(s => s.uid === m.id).length,
    }))
    .sort((a, b) => b.prem - a.prem)

  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#111', marginBottom: 2 }}>Good morning, {user.name} 👋</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{today} · Castro Agency</div>
        </div>
        <div style={{ background: '#dbeafe', color: '#1e40af', fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 8 }}>
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {daysLeft} days left
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: s.tx, fontWeight: 500, opacity: 0.7, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.tx, lineHeight: 1, marginBottom: 2 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: s.tx, opacity: 0.65, marginBottom: s.pct !== null ? 5 : 0 }}>{s.sub}</div>
            {s.pct !== null && (
              <div style={{ height: 3, background: 'rgba(0,0,0,0.1)', borderRadius: 99 }}>
                <div style={{ width: s.pct + '%', height: '100%', background: s.bar, borderRadius: 99 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lower grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12 }}>

        {/* Leaderboard */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Sales leaderboard</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>by premium</span>
              <button onClick={() => setPage('sales')} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
          </div>

          {/* Podium top 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
            {lbData.slice(0, 3).map((item, i) => {
              const c = PODIUM_COLORS[i]
              return (
                <div key={item.m.id} style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 9, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{['🥇','🥈','🥉'][i]}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', margin: '0 auto 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: c.tx }}>
                    {item.m.ini}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: c.tx }}>{item.m.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.tx, marginTop: 2 }}>${item.prem.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: c.tx, opacity: 0.7, marginTop: 1 }}>{item.items} item{item.items !== 1 ? 's' : ''}</div>
                </div>
              )
            })}
          </div>

          {/* 4th and beyond */}
          {lbData.slice(3).map((item, i) => (
            <div key={item.m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: '0.5px solid #f3f4f6' }}>
              <span style={{ fontSize: 12, color: '#9ca3af', width: 20 }}>{i + 4}.</span>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: '#1e40af', flexShrink: 0 }}>
                {item.m.ini}
              </div>
              <span style={{ fontSize: 12, flex: 1, color: '#111' }}>{item.m.name}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: item.prem > 0 ? '#0C447C' : '#9ca3af' }}>
                ${item.prem.toLocaleString()}
              </span>
            </div>
          ))}
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>

          {/* Team progress / My tasks */}
          <Card style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{isAdmin ? 'Team progress' : 'My tasks'}</span>
              <button onClick={() => setPage('tasks')} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {isAdmin
              ? members.map(m => {
                  const mt = tasks.filter(t => t.uid === m.id)
                  const done = mt.filter(t => t.done).length
                  const p = mt.length ? Math.round(done / mt.length * 100) : 0
                  const bc = p === 100 ? '#16a34a' : p > 50 ? '#d97706' : '#dc2626'
                  return (
                    <div key={m.id} style={{ marginBottom: 9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 600, color: '#1e40af' }}>{m.ini}</div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#111' }}>{m.name}</span>
                        </div>
                        <span style={{ fontSize: 10, color: bc, fontWeight: 500 }}>{done}/{mt.length}</span>
                      </div>
                      <div style={{ height: 3, background: '#f3f4f6', borderRadius: 99 }}>
                        <div style={{ width: p + '%', height: '100%', background: bc, borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })
              : myTasks.slice(0, 5).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid #f3f4f6' }}>
                    <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${t.done ? '#16a34a' : '#d1d5db'}`, background: t.done ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                      {t.done ? '✓' : ''}
                    </div>
                    <span style={{ fontSize: 12, flex: 1, color: '#111', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
                  </div>
                ))
            }
          </Card>

          {/* Quote of the day */}
          <div style={{ background: N, borderRadius: 10, padding: '14px 16px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Quote of the day
              </div>
              {isAdmin && !editingQuote && (
                <button
                  onClick={() => { setQuoteDraft({ text: quoteText, author: quoteAuthor }); setEditingQuote(true) }}
                  style={{ background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 5, color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 500, padding: '3px 9px', cursor: 'pointer' }}
                >
                  ✏ Edit
                </button>
              )}
            </div>

            {editingQuote ? (
              <div>
                <textarea
                  value={quoteDraft.text}
                  onChange={e => setQuoteDraft(d => ({ ...d, text: e.target.value }))}
                  placeholder="Enter today's quote…"
                  rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 7, color: '#fff', fontSize: 13, padding: '8px 10px', resize: 'none', outline: 'none', marginBottom: 8, fontFamily: 'inherit', lineHeight: 1.6 }}
                />
                <input
                  value={quoteDraft.author}
                  onChange={e => setQuoteDraft(d => ({ ...d, author: e.target.value }))}
                  placeholder="— Author (optional)"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 7, color: 'rgba(255,255,255,0.75)', fontSize: 12, padding: '7px 10px', outline: 'none', marginBottom: 10, fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: 7 }}>
                  <button
                    onClick={saveQuote}
                    disabled={savingQuote}
                    style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 7, color: N, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer' }}
                  >{savingQuote ? 'Saving…' : 'Save quote'}</button>
                  <button
                    onClick={() => setEditingQuote(false)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '7px 14px', cursor: 'pointer' }}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.65, fontStyle: 'italic', marginBottom: quoteAuthor ? 8 : 0 }}>
                  "{quoteText}"
                </div>
                {quoteAuthor && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>— {quoteAuthor}</div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
