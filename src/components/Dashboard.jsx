import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Field, Modal, Spinner, IS, SkeletonCard } from './shared'
import { launchConfetti } from '../utils/animations'

const PODIUM_COLORS = [
  { bg: 'linear-gradient(135deg, #fef9c3, #fde68a)', tx: '#78350f', border: '#fbbf24', medal: '🥇' },
  { bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', tx: '#334155', border: '#94a3b8', medal: '🥈' },
  { bg: 'linear-gradient(135deg, #fff7ed, #fed7aa)', tx: '#7c2d12', border: '#f97316', medal: '🥉' },
]

// ── Business day helpers ──────────────────────────────────────
function getBusinessDaysLeft() {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  let count = 0
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  while (d <= lastDay) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function getBusinessDaysInMonth() {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  let count = 0
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  while (d <= lastDay) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function getBusinessDaysElapsed() {
  const now = new Date()
  let count = 0
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  while (d <= now) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ── Streak helper ─────────────────────────────────────────────
function calcStreak(sales, uid) {
  const dates = new Set(sales.filter(s => s.uid === uid).map(s => new Date(s.created_at).toDateString()))
  let streak = 0
  const d = new Date()
  if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (dates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

// ── Trend arrow ───────────────────────────────────────────────
function TrendBadge({ pct, tx }) {
  if (pct === null || pct === undefined) return null
  const up   = pct > 0
  const flat = pct === 0
  const color = flat ? tx : up ? '#166534' : '#991b1b'
  const bg    = flat ? 'rgba(0,0,0,0.06)' : up ? 'rgba(22,163,74,0.15)' : 'rgba(153,27,27,0.12)'
  const label = flat ? '—' : (up ? '▲' : '▼') + ' ' + Math.abs(pct) + '%'
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg, padding: '1px 6px', borderRadius: 99, marginLeft: 5 }}>
      {label} vs last month
    </span>
  )
}

// ── Pacing badge ──────────────────────────────────────────────
function PacingBadge({ actual, expected }) {
  const diff = actual - expected
  if (expected <= 0) return null
  let label, color, bg
  if (diff >= 8) {
    label = `⬆ Ahead by ${diff}%`; color = '#166534'; bg = '#dcfce7'
  } else if (diff >= -8) {
    label = `↔ On pace (${expected}% expected)`; color = '#92400e'; bg = '#fef9c3'
  } else {
    label = `⬇ Behind by ${Math.abs(diff)}%`; color = '#991b1b'; bg = '#fee2e2'
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg, padding: '3px 9px', borderRadius: 99 }}>
      {label}
    </span>
  )
}

// ── Goal toast ────────────────────────────────────────────────
function GoalToast({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '2px solid #16a34a', borderRadius: 16, padding: '22px 40px', zIndex: 9998, textAlign: 'center', boxShadow: 'var(--shadow-lg)', animation: 'toastIn .4s ease', minWidth: 320 }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#166534', marginBottom: 6 }}>Team goal crushed!</div>
      <div style={{ fontSize: 14, color: 'var(--text-3)' }}>The whole team hit the monthly target!</div>
    </div>
  )
}

// ── Quote history modal ───────────────────────────────────────
function QuoteHistoryModal({ history, onClose }) {
  return (
    <Modal title="Quote history" onClose={onClose} width={480}>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-4)', fontSize: 13 }}>
          No history yet. Quotes will appear here after you update them.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map(q => (
            <div key={q.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '11px 14px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-1)', fontStyle: 'italic', lineHeight: 1.65, marginBottom: q.author ? 5 : 0 }}>
                "{q.text}"
              </div>
              {q.author && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>— {q.author}</div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 4 }}>
                {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default function Dashboard({ user, setPage }) {
  const [data,               setData]               = useState(null)
  const [loading,            setLoading]            = useState(true)
  const [quoteText,          setQuoteText]          = useState('')
  const [quoteAuthor,        setQuoteAuthor]        = useState('')
  const [editingQuote,       setEditingQuote]       = useState(false)
  const [quoteDraft,         setQuoteDraft]         = useState({ text: '', author: '' })
  const [savingQuote,        setSavingQuote]        = useState(false)
  const [quoteHistory,       setQuoteHistory]       = useState([])
  const [showQuoteHistory,   setShowQuoteHistory]   = useState(false)
  const [announcementText,   setAnnouncementText]   = useState('')
  const [announcementActive, setAnnouncementActive] = useState(false)
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)
  const [editingAnnouncement,setEditingAnnouncement] = useState(false)
  const [announcementDraft,  setAnnouncementDraft]  = useState('')
  const [standupEnabled,     setStandupEnabled]     = useState(true)
  const [myMoodToday,        setMyMoodToday]        = useState(null)
  const [standupTally,       setStandupTally]       = useState({ fire: 0, neutral: 0, tired: 0 })
  const [showGoalToast,      setShowGoalToast]      = useState(false)
  const [teamGoal,           setTeamGoal]           = useState(50000)
  const [lastMonthPrem,      setLastMonthPrem]      = useState(0)
  const [lastMonthItems,     setLastMonthItems]     = useState(0)
  const [adminStats,         setAdminStats]         = useState(null)
  const [activityFeed,       setActivityFeed]       = useState([])

  const goalCelebrated = useRef(false)
  const isAdmin = user.role === 'admin'

  const now = new Date()
  // Month-specific key so goal celebration resets automatically each new month
  const celebKey = `team_goal_celebrated_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const today         = now.toISOString().split('T')[0]
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    // Last month bounds for trend comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

    const [
      tasks, monthSalesRes, allSalesRes, revs, profiles,
      goals, settings, myStandup, allStandup, lastMonthRes, qHistory,
    ] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('sales').select('*').gte('created_at', monthStart).order('created_at', { ascending: false }),
      supabase.from('sales').select('uid, created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('reviews').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('standup_responses').select('*').eq('uid', user.id).eq('date', today).maybeSingle(),
      supabase.from('standup_responses').select('*').eq('date', today),
      supabase.from('sales').select('premium, items, uid').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
      supabase.from('quote_history').select('*').order('created_at', { ascending: false }).limit(12),
    ])

    const s    = settings.data || []
    const getS = key => s.find(x => x.key === key)?.value || ''

    setQuoteText(getS('quote_text') || 'Make today count.')
    setQuoteAuthor(getS('quote_author') || '')
    setAnnouncementText(getS('announcement_text') || '')
    setAnnouncementActive(getS('announcement_active') === 'true')
    setStandupEnabled(getS('standup_enabled') !== 'false')

    // Read team goal from settings, fall back to 50000
    const tGoal = Number(getS('team_goal')) || 50000
    setTeamGoal(tGoal)

    // If this month's goal was already celebrated, mark the ref so it doesn't re-fire
    if (getS(celebKey) === 'true') goalCelebrated.current = true

    if (myStandup.data) setMyMoodToday(myStandup.data.mood)
    const tally = { fire: 0, neutral: 0, tired: 0 }
    ;(allStandup.data || []).forEach(r => {
      if (r.mood === 'fire') tally.fire++
      else if (r.mood === 'neutral') tally.neutral++
      else if (r.mood === 'tired') tally.tired++
    })
    setStandupTally(tally)

    // Last month totals for trend indicators
    const lmSales = lastMonthRes.data || []
    setLastMonthPrem(lmSales.reduce((s, x) => s + (x.premium || 0), 0))
    setLastMonthItems(lmSales.reduce((s, x) => s + (x.items || 1), 0))

    setQuoteHistory(qHistory.data || [])
    setData({
      tasks: tasks.data || [],
      monthSales: monthSalesRes.data || [],
      allSales: allSalesRes.data || [],
      revs: revs.data || [],
      profiles: profiles.data || [],
      goals: goals.data || [],
    })
    setLoading(false)

    // ── Activity feed: recent sales + reviews left ──
    const [recentSalesRes, recentReviewsRes] = await Promise.all([
      supabase.from('sales').select('id, uid, client, premium, policy_type, created_at, is_split').order('created_at', { ascending: false }).limit(6),
      supabase.from('reviews').select('id, asked_by_uid, asked_by_name, client, result, created_at').eq('result', 'Left a Review').order('created_at', { ascending: false }).limit(4),
    ])
    const feed = [
      ...(recentSalesRes.data || []).map(s => ({ ...s, _type: 'sale' })),
      ...(recentReviewsRes.data || []).map(r => ({ ...r, _type: 'review' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
    setActivityFeed(feed)

    // ── Real-time: update monthSales + activity feed when sales are logged ──
    const salesRtCh = supabase.channel('dashboard_sales_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, payload => {
        const sale = payload.new
        // Add to monthSales if it belongs to the current month
        const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        if (sale.created_at >= mStart) {
          setData(prev => prev ? ({ ...prev, monthSales: [sale, ...prev.monthSales] }) : prev)
        }
        // Add to activity feed
        setActivityFeed(prev => [{ ...sale, _type: 'sale' }, ...prev].slice(0, 8))
      })
      .subscribe()

    // Admin-only: fetch quick stats for the summary section
    if (user.role === 'admin') {
      const today = new Date().toISOString().split('T')[0]
      const [sugg, leadRets, refFollowUp] = await Promise.all([
        supabase.from('suggestions').select('*', { count:'exact', head:true }).eq('status', 'Pending'),
        supabase.from('lead_returns').select('*', { count:'exact', head:true }).eq('status', 'New'),
        supabase.from('referrals').select('*', { count:'exact', head:true }).lte('follow_up_date', today).not('status', 'in', '("Sold","Not Interested")').not('follow_up_date', 'is', null),
      ])
      setAdminStats({
        pendingSuggestions: sugg.count  || 0,
        newLeadReturns:     leadRets.count || 0,
        followUpDue:        refFollowUp.count || 0,
      })
    }
  }

  // ── Goal confetti trigger ─────────────────────────────────────
  useEffect(() => {
    if (!data || goalCelebrated.current || teamGoal <= 0) return
    const totalPrem = data.monthSales.reduce((s, x) => s + (x.premium || 0), 0)
    if (totalPrem >= teamGoal) {
      goalCelebrated.current = true
      launchConfetti({ count: 220, duration: 250 })
      setShowGoalToast(true)
      // Persist so refreshing doesn't re-trigger this month
      supabase.from('settings').upsert({ key: celebKey, value: 'true' })
    }
  }, [data, teamGoal])

  // ── Quote save (also writes to history) ──────────────────────
  async function saveQuote() {
    if (!quoteDraft.text.trim()) return
    setSavingQuote(true)
    // Save current quote to history before overwriting
    if (quoteText && quoteText !== 'Make today count.') {
      await supabase.from('quote_history').insert({ text: quoteText, author: quoteAuthor })
    }
    await Promise.all([
      supabase.from('settings').upsert({ key: 'quote_text',   value: quoteDraft.text.trim() }),
      supabase.from('settings').upsert({ key: 'quote_author', value: quoteDraft.author.trim() }),
    ])
    // Refresh history
    const { data: newHistory } = await supabase.from('quote_history').select('*').order('created_at', { ascending: false }).limit(12)
    setQuoteHistory(newHistory || [])
    setQuoteText(quoteDraft.text.trim())
    setQuoteAuthor(quoteDraft.author.trim())
    setEditingQuote(false)
    setSavingQuote(false)
  }

  async function saveAnnouncement() {
    await Promise.all([
      supabase.from('settings').upsert({ key: 'announcement_text',   value: announcementDraft }),
      supabase.from('settings').upsert({ key: 'announcement_active', value: 'true' }),
    ])
    setAnnouncementText(announcementDraft)
    setAnnouncementActive(true)
    setAnnouncementDismissed(false)
    setEditingAnnouncement(false)
  }

  async function clearAnnouncement() {
    await supabase.from('settings').upsert({ key: 'announcement_active', value: 'false' })
    setAnnouncementActive(false)
  }

  async function submitStandup(mood) {
    const today = now.toISOString().split('T')[0]
    await supabase.from('standup_responses').upsert({ uid: user.id, mood, date: today }, { onConflict: 'uid,date' })
    setMyMoodToday(mood)
    setStandupTally(t => ({ ...t, [mood]: t[mood] + 1 }))
  }

  async function toggleStandup() {
    const n = !standupEnabled
    await supabase.from('settings').upsert({ key: 'standup_enabled', value: String(n) })
    setStandupEnabled(n)
  }

  if (loading) return (
    <div style={{ padding:22 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {[1,2,3,4].map(i => <SkeletonCard key={i} lines={3} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.35fr 1fr', gap:12 }}>
        <SkeletonCard lines={6} />
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  )

  const { tasks, monthSales, allSales, revs, profiles, goals } = data
  const members   = profiles.filter(p => p.role === 'member')
  const goalsMap  = {}; goals.forEach(g => { goalsMap[g.uid] = g })

  // Include admins who toggled show_on_leaderboard
  const lbParticipants = profiles.filter(p => p.role === 'member' || (p.role === 'admin' && p.show_on_leaderboard))

  const totalPrem     = monthSales.reduce((s, x) => s + (x.premium || 0), 0)
  const totalItems    = monthSales.reduce((s, x) => s + (x.items || 1), 0)
  const totalPremGoal = members.reduce((sum, m) => sum + (goalsMap[m.id]?.premium || 10000), 0)
  // premPct uses the team goal from settings so the stat card, pacing badge, and goal confetti all agree
  const premPct       = teamGoal > 0 ? Math.min(100, Math.round(totalPrem / teamGoal * 100)) : 0

  const myTasks      = tasks.filter(t => t.uid === user.id)
  const myMonthSales = monthSales.filter(s => s.uid === user.id)
  const myPrem       = myMonthSales.reduce((s, x) => s + (x.premium || 0), 0)
  const myItems      = myMonthSales.reduce((s, x) => s + (x.items || 1), 0)
  const revDone      = revs.filter(r => r.result === 'Left a Review').length
  const bizDaysLeft  = getBusinessDaysLeft()

  // ── Trend calculations ────────────────────────────────────────
  const premTrend     = lastMonthPrem  > 0 ? Math.round(((totalPrem  - lastMonthPrem)  / lastMonthPrem)  * 100) : null
  const itemsTrend    = lastMonthItems > 0 ? Math.round(((totalItems - lastMonthItems) / lastMonthItems) * 100) : null
  const myItemsTrend  = lastMonthItems > 0 ? null : null // personal trend needs personal last month data — shown at team level for now

  // ── Pacing ────────────────────────────────────────────────────
  const bizTotal    = getBusinessDaysInMonth()
  const bizElapsed  = getBusinessDaysElapsed()
  const expectedPct = bizTotal > 0 ? Math.round(bizElapsed / bizTotal * 100) : 0

  // ── Leaderboard ───────────────────────────────────────────────
  const lbData = lbParticipants.map(m => {
    const ms     = monthSales.filter(s => s.uid === m.id)
    const prem   = ms.reduce((s, x) => s + (x.premium || 0), 0)
    const items  = ms.reduce((s, x) => s + (x.items || 1), 0)
    const streak = calcStreak(allSales, m.id)
    const g      = goalsMap[m.id] || { policies: 8, premium: 10000, quotes: 30 }
    return { m, prem, items, streak, g }
  }).sort((a, b) => b.prem - a.prem)

  const myRank = lbData.findIndex(x => x.m.id === user.id) + 1  // 1-based, 0 = not found

  // ── Today's total ────────────────────────────────────────────
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todaySales     = monthSales.filter(s => s.created_at >= todayStart)
  const todayTotal     = todaySales.reduce((s, x) => s + (x.premium || 0), 0)
  const todayCount     = todaySales.length

  // ── Pace to close ─────────────────────────────────────────────
  const projectedPremium = bizElapsed > 0
    ? Math.round((totalPrem / bizElapsed) * bizTotal)
    : 0

  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const stats = [
    {
      label: 'Premium this month',
      val:   '$' + totalPrem.toLocaleString(),
      sub:   premPct + '% of $' + teamGoal.toLocaleString() + ' goal',
      sub2:  todayTotal > 0 ? `+$${todayTotal.toLocaleString()} today (${todayCount} sale${todayCount !== 1 ? 's' : ''})` : null,
      pct:   premPct,
      bg:    '#EAF3DE', tx: '#27500A', bar: '#639922',
      trend: premTrend,
    },
    {
      label: isAdmin ? 'Items sold (team)' : 'My items sold',
      val:   isAdmin ? totalItems : myItems,
      sub:   isAdmin ? members.length + ' agents' : '$' + myPrem.toLocaleString() + ' premium',
      pct:   null,
      bg:    '#E6F1FB', tx: '#0C447C', bar: '#378ADD',
      trend: isAdmin ? itemsTrend : null,
    },
    {
      label: isAdmin ? 'Total tasks' : 'My tasks',
      val:   isAdmin ? tasks.length : myTasks.length,
      sub:   isAdmin
        ? tasks.filter(t => t.done).length + ' completed'
        : myTasks.filter(t => t.done).length + '/' + myTasks.length + ' done',
      pct:   null,
      bg:    '#EEEDFE', tx: '#3C3489', bar: '#7F77DD',
      trend: null,
    },
    {
      label: 'Review requests',
      val:   revs.length,
      sub:   revDone + ' left a review · ' + (revs.length ? Math.round(revDone / revs.length * 100) : 0) + '% conversion',
      pct:   revs.length ? Math.round(revDone / revs.length * 100) : 0,
      bg:    '#FAEEDA', tx: '#7c2d12', bar: '#c2410c',
      trend: null,
    },
  ]

  return (
    <div style={{ padding: 22 }}>

      {/* ── Announcement banner ── */}
      {announcementActive && announcementText && !announcementDismissed && (
        <div style={{ background: N, color: '#fff', borderRadius: 9, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 16 }}>📢</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{announcementText}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {isAdmin && <button onClick={() => { setAnnouncementDraft(announcementText); setEditingAnnouncement(true) }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, padding: '3px 9px', cursor: 'pointer' }}>Edit</button>}
            {isAdmin && <button onClick={clearAnnouncement} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 5, color: 'rgba(255,255,255,0.7)', fontSize: 11, padding: '3px 9px', cursor: 'pointer' }}>Remove</button>}
            <button onClick={() => setAnnouncementDismissed(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
        </div>
      )}
      {isAdmin && (!announcementActive || announcementDismissed) && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => { setAnnouncementDraft(''); setEditingAnnouncement(true) }} style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: '1px dashed var(--border-2)', borderRadius: 7, padding: '5px 13px', cursor: 'pointer' }}>
            + Post announcement to team
          </button>
        </div>
      )}

      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>
            Good morning, {user.name} 👋
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{today} · Castro Agency</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <div style={{ background: 'var(--primary-mid)', color: '#1e40af', fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 8 }}>
            {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {bizDaysLeft} business day{bizDaysLeft !== 1 ? 's' : ''} left
          </div>
          {/* Pacing indicator — only show once some data exists */}
          {totalPrem > 0 && (
            <PacingBadge actual={premPct} expected={expectedPct} />
          )}
        </div>
      </div>

      {/* ── Admin summary section ── */}
      {isAdmin && adminStats && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:500, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
            Quick overview
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { label:'Pending suggestions', val:adminStats.pendingSuggestions, page:'suggestions', icon:'💡', warn: adminStats.pendingSuggestions > 0 },
              { label:'Overdue tasks',        val:tasks.filter(t=>!t.done).length, page:'tasks',       icon:'☑', warn: false },
              { label:'Follow-ups due',       val:adminStats.followUpDue,          page:'referrals',   icon:'📅', warn: adminStats.followUpDue > 0 },
              { label:'Unresolved lead returns', val:adminStats.newLeadReturns,   page:'sales',       icon:'↩', warn: adminStats.newLeadReturns > 0 },
            ].map(s => (
              <div key={s.label} onClick={() => setPage(s.page)}
                style={{ background: s.warn && s.val > 0 ? 'var(--warning-light)' : 'var(--surface)', border: `1px solid ${s.warn && s.val > 0 ? '#fcd34d' : 'var(--border)'}`, borderRadius:10, padding:'11px 14px', cursor:'pointer', transition:'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:14 }}>{s.icon}</span>
                  <div style={{ fontSize:10, color:'var(--text-4)', fontWeight:500, textTransform:'uppercase', letterSpacing:0.4 }}>{s.label}</div>
                </div>
                <div style={{ fontSize:22, fontWeight:700, color: s.warn && s.val > 0 ? '#92400e' : 'var(--text-1)' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat cards — redesigned ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background:   'var(--surface)',
            borderRadius: 14,
            padding:      '16px 18px',
            boxShadow:    'var(--shadow-sm)',
            border:       '1px solid var(--border)',
            borderTop:    `3px solid ${s.bar}`,
            transition:   'box-shadow 0.2s, transform 0.2s',
            position:     'relative',
            overflow:     'hidden',
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none' }}
          >
            {/* Background tint -- stronger corner accent */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: 96, height: 96, background: s.bg, opacity: 0.6, borderRadius: '0 14px 0 96px', pointerEvents: 'none' }} />

            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1, letterSpacing: -1, marginBottom: 6 }}>
              {s.val}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: s.sub2 ? 5 : s.pct !== null ? 8 : 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              {s.sub}
              <TrendBadge pct={s.trend} tx={s.bar} />
            </div>
            {s.sub2 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: s.tx, background: s.bg, borderRadius: 6, padding: '3px 8px', display: 'inline-block', marginBottom: 8 }}>
                {s.sub2}
              </div>
            )}
            {s.pct !== null && (
              <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: s.pct + '%', height: '100%', background: s.bar, borderRadius: 99, transition: 'width 0.6s ease' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Goal countdown + pace to close ── */}
      {teamGoal > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Team goal</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: premPct >= 100 ? 'var(--success)' : 'var(--text-1)', letterSpacing: -0.5 }}>${totalPrem.toLocaleString()}</span>
              <span style={{ fontSize: 13, color: 'var(--text-4)' }}>of ${teamGoal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {projectedPremium > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>Pace to close</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: projectedPremium >= teamGoal ? 'var(--success)' : 'var(--warning)' }}>
                    ${projectedPremium.toLocaleString()}
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-4)', marginLeft: 3 }}>by month end</span>
                  </div>
                </div>
              )}
              <div style={{ background: premPct >= 100 ? 'var(--success-light)' : premPct >= expectedPct ? '#eff6ff' : 'var(--warning-light)', border: `1px solid ${premPct >= 100 ? '#86efac' : premPct >= expectedPct ? '#bfdbfe' : '#fcd34d'}`, borderRadius: 9999, padding: '4px 12px', fontSize: 13, fontWeight: 700, color: premPct >= 100 ? 'var(--success)' : premPct >= expectedPct ? 'var(--primary)' : 'var(--warning)' }}>
                {premPct}%
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 99, overflow: 'visible', position: 'relative' }}>
            {expectedPct > 0 && expectedPct < 100 && (
              <div style={{ position: 'absolute', top: -3, bottom: -3, left: `${expectedPct}%`, width: 2, background: 'var(--border-2)', borderRadius: 99, zIndex: 2 }} title={`Expected: ${expectedPct}%`} />
            )}
            <div style={{
              height: '100%',
              width:  Math.min(100, premPct) + '%',
              background: premPct >= 100
                ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                : premPct >= expectedPct
                  ? 'linear-gradient(90deg, #2563eb, #60a5fa)'
                  : 'linear-gradient(90deg, #d97706, #fbbf24)',
              borderRadius: 99,
              transition:   'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
              position:     'relative',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-4)' }}>$0</span>
            {expectedPct > 5 && expectedPct < 95 && (
              <span style={{ fontSize: 10, color: 'var(--text-4)' }}>Expected {expectedPct}% · {bizElapsed}d of {bizTotal} business days</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-4)' }}>${teamGoal.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ── Morning standup ── */}
      {standupEnabled && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: myMoodToday ? 4 : isAdmin ? 8 : 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Morning check-in</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Show tally to everyone (anonymous aggregate) */}
              {(isAdmin || standupTally.fire + standupTally.neutral + standupTally.tired > 0) && (
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  🔥 {standupTally.fire} · 😐 {standupTally.neutral} · 😴 {standupTally.tired}
                </div>
              )}
              {isAdmin && (
                <button onClick={toggleStandup} style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                  Turn off
                </button>
              )}
            </div>
          </div>

          {/* Admin-only: overdue task breakdown */}
          {isAdmin && (() => {
            const todayStr   = new Date().toISOString().split('T')[0]
            const agentsOver = members.map(m => ({
              name:  m.name,
              count: tasks.filter(t => t.uid === m.id && !t.done && t.due_date && t.due_date < todayStr).length,
            })).filter(x => x.count > 0)
            if (agentsOver.length === 0) return null
            return (
              <div style={{ background: 'var(--danger-light)', border: '1px solid #fca5a5', borderRadius: 7, padding: '7px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#991b1b' }}>⚠ Overdue tasks:</span>
                {agentsOver.map(a => (
                  <span key={a.name} style={{ fontSize: 11, color: '#7f1d1d', background: 'rgba(220,38,38,0.1)', borderRadius: 99, padding: '2px 8px' }}>
                    {a.name} · {a.count}
                  </span>
                ))}
              </div>
            )
          })()}

          {myMoodToday ? (
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
              ✓ Checked in — {myMoodToday === 'fire' ? '🔥 Fired up' : myMoodToday === 'neutral' ? '😐 Neutral' : '😴 Low energy'}
            </div>
          ) : !isAdmin ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 9 }}>How's your energy today?</div>
              <div style={{ display: 'flex', gap: 9 }}>
                {[{ key: 'fire', label: '🔥 Fired up' }, { key: 'neutral', label: '😐 Neutral' }, { key: 'tired', label: '😴 Low energy' }].map(opt => (
                  <button key={opt.key} onClick={() => submitStandup(opt.key)} style={{ flex: 1, padding: '8px 0', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', fontFamily: 'inherit' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
      {isAdmin && !standupEnabled && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={toggleStandup} style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: '1px dashed var(--border-2)', borderRadius: 7, padding: '5px 13px', cursor: 'pointer' }}>
            + Turn on morning check-in
          </button>
        </div>
      )}

      {/* ── Main grid: leaderboard + right column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12 }}>

        {/* Leaderboard */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Sales leaderboard</span>
              {/* Personal rank indicator for agents */}
              {!isAdmin && myRank > 0 && myRank > 3 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 99 }}>
                  You're #{myRank}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>by premium</span>
              <button onClick={() => setPage('sales')} style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
          </div>

          {/* Podium top 3 — premium upgrade */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
            {lbData.slice(0, 3).map((item, i) => {
              const c     = PODIUM_COLORS[i]
              const isMe  = item.m.id === user.id
              const minH  = [200, 165, 145][i]
              return (
                <div key={item.m.id} style={{
                  background:     c.bg,
                  border:         `1.5px solid ${c.border}`,
                  borderRadius:   14,
                  padding:        i === 0 ? '22px 12px 18px' : i === 1 ? '16px 12px' : '12px',
                  minHeight:      minH,
                  textAlign:      'center',
                  position:       'relative',
                  boxShadow:      i === 0 ? '0 8px 28px rgba(251,191,36,0.35), 0 2px 8px rgba(251,191,36,0.15)' : 'var(--shadow-xs)',
                  transition:     'transform 0.2s, box-shadow 0.2s',
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            i === 0 ? 6 : 4,
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; if (i === 0) e.currentTarget.style.boxShadow = '0 14px 36px rgba(251,191,36,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; if (i === 0) e.currentTarget.style.boxShadow = '0 8px 28px rgba(251,191,36,0.35), 0 2px 8px rgba(251,191,36,0.15)' }}
                >
                  {isMe && (
                    <div style={{ position: 'absolute', top: 8, right: 9, fontSize: 9, fontWeight: 700, color: c.tx, background: 'rgba(0,0,0,0.12)', padding: '2px 7px', borderRadius: 99 }}>YOU</div>
                  )}
                  <div style={{ fontSize: i === 0 ? 32 : 22 }}>{c.medal}</div>
                  <div style={{ width: i === 0 ? 44 : 33, height: i === 0 ? 44 : 33, borderRadius: '50%', background: 'rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i === 0 ? 14 : 11, fontWeight: 700, color: c.tx }}>{item.m.ini}</div>
                  <div style={{ fontSize: i === 0 ? 14 : 12, fontWeight: 700, color: c.tx }}>{item.m.name}</div>
                  <div style={{ fontSize: i === 0 ? 20 : 15, fontWeight: 800, color: c.tx, letterSpacing: -0.5 }}>${item.prem.toLocaleString()}</div>
                  {item.streak > 0 && <div style={{ fontSize: 11, color: c.tx, opacity: 0.85 }}>🔥 {item.streak}d</div>}
                </div>
              )
            })}
          </div>

          {/* Remaining agents — bridged styling */}
          {lbData.slice(3).map((item, i) => {
            const isMe = item.m.id === user.id
            return (
              <div key={item.m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--border)', background: isMe ? 'var(--primary-light)' : i % 2 === 0 ? 'transparent' : 'var(--surface-2)', padding: '9px 10px', borderRadius: isMe ? 8 : 0, margin: isMe ? '0 -2px' : 0, transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-4)', width: 18, fontWeight: 600, textAlign: 'center' }}>{i + 4}</span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: isMe ? 'var(--primary)' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: isMe ? '#fff' : 'var(--text-2)', flexShrink: 0 }}>{item.m.ini}</div>
                <span style={{ fontSize: 13, flex: 1, color: 'var(--text-1)', fontWeight: isMe ? 700 : 500 }}>
                  {item.m.name}
                  {isMe && <span style={{ fontSize: 9, color: 'var(--primary)', fontWeight: 700, marginLeft: 6 }}>YOU</span>}
                </span>
                {item.streak > 0 && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>🔥 {item.streak}</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: item.prem > 0 ? 'var(--success)' : 'var(--text-4)' }}>${item.prem.toLocaleString()}</span>
              </div>
            )
          })}
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>

          {/* Team progress / My tasks */}
          <Card style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{isAdmin ? 'Team progress' : 'My tasks'}</span>
              <button onClick={() => setPage('tasks')} style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {isAdmin ? members.map(m => {
              const mt   = tasks.filter(t => t.uid === m.id)
              const done = mt.filter(t => t.done).length
              const p    = mt.length ? Math.round(done / mt.length * 100) : 0
              const bc   = p === 100 ? '#16a34a' : p > 50 ? '#d97706' : '#dc2626'
              return (
                <div key={m.id} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 600, color: '#1e40af' }}>{m.ini}</div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)' }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: bc, fontWeight: 500 }}>{done}/{mt.length}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 99 }}>
                    <div style={{ width: p + '%', height: '100%', background: bc, borderRadius: 99, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            }) : myTasks.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${t.done ? '#16a34a' : 'var(--border-2)'}`, background: t.done ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                  {t.done ? '✓' : ''}
                </div>
                <span style={{ fontSize: 12, flex: 1, color: 'var(--text-1)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
              </div>
            ))}
          </Card>

          {/* Quote of the day */}
          <div style={{ background: N, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Quote of the day</div>
              {isAdmin && !editingQuote && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowQuoteHistory(true)} style={{ background: 'rgba(255,255,255,.1)', border: '.5px solid rgba(255,255,255,.2)', borderRadius: 5, color: 'rgba(255,255,255,.65)', fontSize: 10, padding: '3px 9px', cursor: 'pointer' }}>
                    🕒 History
                  </button>
                  <button onClick={() => { setQuoteDraft({ text: quoteText, author: quoteAuthor }); setEditingQuote(true) }} style={{ background: 'rgba(255,255,255,.12)', border: '.5px solid rgba(255,255,255,.2)', borderRadius: 5, color: 'rgba(255,255,255,.7)', fontSize: 10, padding: '3px 9px', cursor: 'pointer' }}>
                    ✏ Edit
                  </button>
                </div>
              )}
            </div>

            {editingQuote ? (
              <div>
                <textarea value={quoteDraft.text} onChange={e => setQuoteDraft(d => ({ ...d, text: e.target.value }))} rows={3} style={{ width: '100%', background: 'rgba(255,255,255,.12)', border: '.5px solid rgba(255,255,255,.25)', borderRadius: 7, color: '#fff', fontSize: 13, padding: '8px 10px', resize: 'none', outline: 'none', marginBottom: 8, fontFamily: 'inherit', lineHeight: 1.6 }} />
                <input value={quoteDraft.author} onChange={e => setQuoteDraft(d => ({ ...d, author: e.target.value }))} placeholder="— Author (optional)" style={{ width: '100%', background: 'rgba(255,255,255,.12)', border: '.5px solid rgba(255,255,255,.25)', borderRadius: 7, color: 'rgba(255,255,255,.75)', fontSize: 12, padding: '7px 10px', outline: 'none', marginBottom: 10, fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={saveQuote} disabled={savingQuote} style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 7, color: N, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {savingQuote ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingQuote(false)} style={{ background: 'rgba(255,255,255,.1)', border: '.5px solid rgba(255,255,255,.2)', borderRadius: 7, color: 'rgba(255,255,255,.6)', fontSize: 12, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.65, fontStyle: 'italic', marginBottom: quoteAuthor ? 8 : 0 }}>"{quoteText}"</div>
                {quoteAuthor && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>— {quoteAuthor}</div>}
              </>
            )}
          </div>

          {/* ── Activity feed ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 12 }}>Team activity</div>
            {activityFeed.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-4)', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>No recent activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activityFeed.map((item, i) => {
                  const isSale   = item._type === 'sale'
                  const profile  = profiles.find(p => p.id === (isSale ? item.uid : item.asked_by_uid))
                  const timeAgo  = (() => {
                    const diff = Date.now() - new Date(item.created_at).getTime()
                    const m = Math.floor(diff / 60000)
                    if (m < 1) return 'just now'
                    if (m < 60) return `${m}m ago`
                    const h = Math.floor(m / 60)
                    if (h < 24) return `${h}h ago`
                    return Math.floor(h / 24) + 'd ago'
                  })()
                  return (
                    <div key={item.id + i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{isSale ? '💰' : '⭐'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600 }}>{profile?.name || 'Someone'}</span>
                          {isSale
                            ? <> logged a sale — {item.policy_type} · <span style={{ color: 'var(--success)', fontWeight: 700 }}>${(item.premium || 0).toLocaleString()}</span>{item.is_split && <span style={{ fontSize: 10, color: 'var(--text-4)', marginLeft: 4 }}>(split)</span>}</>
                            : <> · <span style={{ fontWeight: 600 }}>{item.client}</span> left a review</>
                          }
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>{timeAgo}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {editingAnnouncement && (
        <Modal title="Post announcement" onClose={() => setEditingAnnouncement(false)}>
          <Field label="Announcement text">
            <textarea value={announcementDraft} onChange={e => setAnnouncementDraft(e.target.value)} rows={3} placeholder="e.g. Team meeting Friday at 2pm!" style={{ ...IS, resize: 'none', lineHeight: 1.5 }} />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => setEditingAnnouncement(false)}>Cancel</Btn>
            <Btn onClick={saveAnnouncement}>Post to team</Btn>
          </div>
        </Modal>
      )}

      {showQuoteHistory && (
        <QuoteHistoryModal history={quoteHistory} onClose={() => setShowQuoteHistory(false)} />
      )}

      {showGoalToast && <GoalToast onDone={() => setShowGoalToast(false)} />}
    </div>
  )
}
