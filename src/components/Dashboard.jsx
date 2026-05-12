import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Field, Modal, Spinner, IS } from './shared'

const PODIUM_COLORS = [
  { bg: '#EAF3DE', tx: '#27500A', border: '#C0DD97' },
  { bg: '#E6F1FB', tx: '#0C447C', border: '#B5D4F4' },
  { bg: '#FAEEDA', tx: '#633806', border: '#FAC775' },
]

function getBusinessDaysLeft() {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  let count = 0
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  while (d <= lastDay) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function calcStreak(sales, uid) {
  const saleDates = new Set(
    sales.filter(s => s.uid === uid).map(s => new Date(s.created_at).toDateString())
  )
  let streak = 0
  const d = new Date()
  if (!saleDates.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (saleDates.has(d.toDateString())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function launchConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const colors = ['#C8102E','#1B3A6B','#FFD700','#16a34a','#f97316','#8b5cf6','#ec4899']
  const particles = Array.from({ length: 220 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * 100,
    w: Math.random() * 14 + 5, h: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 5 + 2, angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 10, drift: (Math.random() - 0.5) * 3, opacity: 1,
  }))
  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.y += p.speed; p.x += p.drift; p.angle += p.spin
      if (frame > 150) p.opacity = Math.max(0, p.opacity - 0.013)
      ctx.save(); ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180)
      ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h)
      ctx.restore()
    })
    frame++
    if (frame < 250) requestAnimationFrame(animate)
    else if (canvas.parentNode) document.body.removeChild(canvas)
  }
  animate()
}

function GoalToast({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'#fff', border:'2px solid #16a34a', borderRadius:16, padding:'22px 40px', zIndex:9998, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', animation:'toastIn 0.4s ease', minWidth:320 }}>
      <style>{`@keyframes toastIn{from{transform:translateX(-50%) translateY(-30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
      <div style={{ fontSize:48, marginBottom:8 }}>🏆</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#166534', marginBottom:6 }}>Team goal crushed!</div>
      <div style={{ fontSize:14, color:'#374151' }}>The whole team hit the monthly target!</div>
      <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>That's what we're made of 💪</div>
    </div>
  )
}

export default function Dashboard({ user, setPage }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quoteText, setQuoteText] = useState('')
  const [quoteAuthor, setQuoteAuthor] = useState('')
  const [editingQuote, setEditingQuote] = useState(false)
  const [quoteDraft, setQuoteDraft] = useState({ text: '', author: '' })
  const [savingQuote, setSavingQuote] = useState(false)
  const [teamGoal, setTeamGoal] = useState(50000)
  const [editingTeamGoal, setEditingTeamGoal] = useState(false)
  const [teamGoalDraft, setTeamGoalDraft] = useState('')
  const [announcementText, setAnnouncementText] = useState('')
  const [announcementActive, setAnnouncementActive] = useState(false)
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(false)
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [standupEnabled, setStandupEnabled] = useState(true)
  const [myMoodToday, setMyMoodToday] = useState(null)
  const [standupTally, setStandupTally] = useState({ fire: 0, neutral: 0, tired: 0 })
  const [showGoalToast, setShowGoalToast] = useState(false)
  const goalCelebrated = useRef(false)
  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [tasks, monthSalesRes, allSalesRes, revs, profiles, goals, settings, myStandup, allStandup] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('sales').select('*').gte('created_at', monthStart),
      supabase.from('sales').select('uid, created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('reviews').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('standup_responses').select('*').eq('uid', user.id).eq('date', today).maybeSingle(),
      supabase.from('standup_responses').select('*').eq('date', today),
    ])

    const s = settings.data || []
    const getS = key => s.find(x => x.key === key)?.value || ''
    setQuoteText(getS('quote_text') || 'Make today count.')
    setQuoteAuthor(getS('quote_author') || '')
    setTeamGoal(Number(getS('team_goal')) || 50000)
    setAnnouncementText(getS('announcement_text') || '')
    setAnnouncementActive(getS('announcement_active') === 'true')
    setStandupEnabled(getS('standup_enabled') !== 'false')

    if (myStandup.data) setMyMoodToday(myStandup.data.mood)

    const tally = { fire: 0, neutral: 0, tired: 0 }
    ;(allStandup.data || []).forEach(r => {
      if (r.mood === 'fire') tally.fire++
      else if (r.mood === 'neutral') tally.neutral++
      else if (r.mood === 'tired') tally.tired++
    })
    setStandupTally(tally)

    setData({
      tasks: tasks.data || [],
      monthSales: monthSalesRes.data || [],
      allSales: allSalesRes.data || [],
      revs: revs.data || [],
      profiles: profiles.data || [],
      goals: goals.data || [],
    })
    setLoading(false)
  }

  // Check if team goal is hit after data loads
  useEffect(() => {
    if (!data || goalCelebrated.current) return
    const totalPrem = data.monthSales.reduce((s, x) => s + (x.premium || 0), 0)
    if (totalPrem >= teamGoal && teamGoal > 0) {
      goalCelebrated.current = true
      launchConfetti()
      setShowGoalToast(true)
    }
  }, [data, teamGoal])

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

  async function saveTeamGoal() {
    const val = Number(teamGoalDraft)
    if (!val) return
    await supabase.from('settings').upsert({ key: 'team_goal', value: String(val) })
    await supabase.from('settings').upsert({ key: 'team_goal_celebrated', value: 'false' })
    setTeamGoal(val)
    goalCelebrated.current = false
    setEditingTeamGoal(false)
  }

  async function saveAnnouncement() {
    await Promise.all([
      supabase.from('settings').upsert({ key: 'announcement_text', value: announcementDraft }),
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
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('standup_responses').upsert({ uid: user.id, mood, date: today }, { onConflict: 'uid,date' })
    setMyMoodToday(mood)
    setStandupTally(t => ({
      ...t,
      [mood]: t[mood] + 1,
    }))
  }

  async function toggleStandup() {
    const newVal = !standupEnabled
    await supabase.from('settings').upsert({ key: 'standup_enabled', value: String(newVal) })
    setStandupEnabled(newVal)
  }

  if (loading) return <Spinner />

  const { tasks, monthSales, allSales, revs, profiles, goals } = data
  const members = profiles.filter(p => p.role === 'member')
  const goalsMap = {}
  goals.forEach(g => { goalsMap[g.uid] = g })

  const now = new Date()
  const totalPrem = monthSales.reduce((s, x) => s + (x.premium || 0), 0)
  const premPct = teamGoal ? Math.min(100, Math.round(totalPrem / teamGoal * 100)) : 0
  const premBarColor = premPct >= 100 ? '#16a34a' : premPct >= 60 ? '#d97706' : '#1B3A6B'

  const myTasks = tasks.filter(t => t.uid === user.id)
  const myMonthSales = monthSales.filter(s => s.uid === user.id)
  const myPrem = myMonthSales.reduce((s, x) => s + (x.premium || 0), 0)
  const revDone = revs.filter(r => r.result === 'Left a Review').length
  const bizDaysLeft = getBusinessDaysLeft()

  const stats = [
    { label: 'Premium this month', val: '$' + totalPrem.toLocaleString(), sub: premPct + '% of goal', pct: premPct, bg: '#EAF3DE', tx: '#27500A', bar: '#639922' },
    { label: isAdmin ? 'Items sold' : 'My items sold', val: isAdmin ? monthSales.length : myMonthSales.length, sub: isAdmin ? members.length + ' agents' : '$' + myPrem.toLocaleString(), pct: null, bg: '#E6F1FB', tx: '#0C447C', bar: '#378ADD' },
    { label: isAdmin ? 'Total tasks' : 'My tasks', val: isAdmin ? tasks.length : myTasks.length, sub: isAdmin ? tasks.filter(t => t.done).length + ' completed' : myTasks.filter(t => t.done).length + '/' + myTasks.length + ' done', pct: null, bg: '#EEEDFE', tx: '#3C3489', bar: '#7F77DD' },
    { label: 'Review requests', val: revs.length, sub: revDone + ' left a review', pct: revs.length ? Math.round(revDone / revs.length * 100) : 0, bg: '#FAEEDA', tx: '#633806', bar: '#BA7517' },
  ]

  const lbData = members.map(m => ({
    m,
    prem: monthSales.filter(s => s.uid === m.id).reduce((s, x) => s + (x.premium || 0), 0),
    items: monthSales.filter(s => s.uid === m.id).length,
    streak: calcStreak(allSales, m.id),
  })).sort((a, b) => b.prem - a.prem)

  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: 22 }}>

      {/* Announcement banner */}
      {announcementActive && announcementText && !announcementDismissed && (
        <div style={{ background: '#1B3A6B', color: '#fff', borderRadius: 9, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
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

      {/* Admin: post announcement if none active */}
      {isAdmin && (!announcementActive || announcementDismissed) && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => { setAnnouncementDraft(''); setEditingAnnouncement(true) }} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px dashed #d1d5db', borderRadius: 7, padding: '5px 13px', cursor: 'pointer' }}>
            + Post announcement to team
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#111', marginBottom: 2 }}>Good morning, {user.name} 👋</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{today} · Castro Agency</div>
        </div>
        <div style={{ background: '#dbeafe', color: '#1e40af', fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 8 }}>
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {bizDaysLeft} business day{bizDaysLeft !== 1 ? 's' : ''} left
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
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

      {/* Team goal bar */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Team goal</span>
            {premPct >= 100 && <span style={{ fontSize: 12 }}>🏆</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: premBarColor }}>${totalPrem.toLocaleString()} / ${teamGoal.toLocaleString()}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: premBarColor }}>{premPct}%</span>
            {isAdmin && (
              <button onClick={() => { setTeamGoalDraft(String(teamGoal)); setEditingTeamGoal(true) }} style={{ fontSize: 10, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Edit goal</button>
            )}
          </div>
        </div>
        <div style={{ height: 8, background: '#f3f4f6', borderRadius: 99 }}>
          <div style={{ width: premPct + '%', height: '100%', background: premBarColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      {/* Standup prompt */}
      {standupEnabled && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isAdmin ? 8 : (myMoodToday ? 4 : 10) }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Morning check-in</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isAdmin && (
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  🔥 {standupTally.fire} · 😐 {standupTally.neutral} · 😴 {standupTally.tired}
                </div>
              )}
              {isAdmin && (
                <button onClick={toggleStandup} style={{ fontSize: 10, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                  Turn off
                </button>
              )}
            </div>
          </div>
          {!isAdmin && (
            myMoodToday ? (
              <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
                ✓ Checked in today — {myMoodToday === 'fire' ? '🔥 Fired up' : myMoodToday === 'neutral' ? '😐 Neutral' : '😴 Low energy'}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 9 }}>How's your energy today?</div>
                <div style={{ display: 'flex', gap: 9 }}>
                  {[
                    { key: 'fire', label: '🔥 Fired up' },
                    { key: 'neutral', label: '😐 Neutral' },
                    { key: 'tired', label: '😴 Low energy' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => submitStandup(opt.key)} style={{ flex: 1, padding: '8px 0', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Admin: turn standup back on */}
      {isAdmin && !standupEnabled && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={toggleStandup} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px dashed #d1d5db', borderRadius: 7, padding: '5px 13px', cursor: 'pointer' }}>
            + Turn on morning check-in
          </button>
        </div>
      )}

      {/* Lower grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Sales leaderboard</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>by premium</span>
              <button onClick={() => setPage('sales')} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
            {lbData.slice(0, 3).map((item, i) => {
              const c = PODIUM_COLORS[i]
              return (
                <div key={item.m.id} style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 9, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{['🥇','🥈','🥉'][i]}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', margin: '0 auto 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: c.tx }}>{item.m.ini}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: c.tx }}>{item.m.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.tx, marginTop: 2 }}>${item.prem.toLocaleString()}</div>
                  {item.streak > 0 && <div style={{ fontSize: 10, color: c.tx, opacity: 0.75, marginTop: 2 }}>🔥 {item.streak}d streak</div>}
                </div>
              )
            })}
          </div>

          {lbData.slice(3).map((item, i) => (
            <div key={item.m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: '0.5px solid #f3f4f6' }}>
              <span style={{ fontSize: 12, color: '#9ca3af', width: 20 }}>{i + 4}.</span>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: '#1e40af', flexShrink: 0 }}>{item.m.ini}</div>
              <span style={{ fontSize: 12, flex: 1, color: '#111' }}>{item.m.name}</span>
              {item.streak > 0 && <span style={{ fontSize: 11, color: '#d97706' }}>🔥{item.streak}</span>}
              <span style={{ fontSize: 12, fontWeight: 500, color: item.prem > 0 ? '#0C447C' : '#9ca3af' }}>${item.prem.toLocaleString()}</span>
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
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
                    <div style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${t.done ? '#16a34a' : '#d1d5db'}`, background: t.done ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700, flexShrink: 0 }}>{t.done ? '✓' : ''}</div>
                    <span style={{ fontSize: 12, flex: 1, color: '#111', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
                  </div>
                ))
            }
          </Card>

          <div style={{ background: N, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Quote of the day</div>
              {isAdmin && !editingQuote && (
                <button onClick={() => { setQuoteDraft({ text: quoteText, author: quoteAuthor }); setEditingQuote(true) }} style={{ background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 5, color: 'rgba(255,255,255,0.7)', fontSize: 10, padding: '3px 9px', cursor: 'pointer' }}>✏ Edit</button>
              )}
            </div>
            {editingQuote ? (
              <div>
                <textarea value={quoteDraft.text} onChange={e => setQuoteDraft(d => ({ ...d, text: e.target.value }))} rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 7, color: '#fff', fontSize: 13, padding: '8px 10px', resize: 'none', outline: 'none', marginBottom: 8, fontFamily: 'inherit', lineHeight: 1.6 }} />
                <input value={quoteDraft.author} onChange={e => setQuoteDraft(d => ({ ...d, author: e.target.value }))} placeholder="— Author (optional)" style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 7, color: 'rgba(255,255,255,0.75)', fontSize: 12, padding: '7px 10px', outline: 'none', marginBottom: 10, fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={saveQuote} disabled={savingQuote} style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 7, color: N, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer' }}>{savingQuote ? 'Saving…' : 'Save'}</button>
                  <button onClick={() => setEditingQuote(false)} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '7px 14px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.65, fontStyle: 'italic', marginBottom: quoteAuthor ? 8 : 0 }}>"{quoteText}"</div>
                {quoteAuthor && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>— {quoteAuthor}</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Announcement modal */}
      {editingAnnouncement && (
        <Modal title="Post announcement" onClose={() => setEditingAnnouncement(false)}>
          <Field label="Announcement text">
            <textarea value={announcementDraft} onChange={e => setAnnouncementDraft(e.target.value)} rows={3} placeholder="e.g. Team meeting Friday at 2pm — don't forget!" style={{ ...IS, resize: 'none', lineHeight: 1.5 }} />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => setEditingAnnouncement(false)}>Cancel</Btn>
            <Btn onClick={saveAnnouncement}>Post to team</Btn>
          </div>
        </Modal>
      )}

      {/* Team goal edit modal */}
      {editingTeamGoal && (
        <Modal title="Set team goal" onClose={() => setEditingTeamGoal(false)}>
          <Field label="Monthly premium target ($)">
            <input style={IS} type="number" value={teamGoalDraft} onChange={e => setTeamGoalDraft(e.target.value)} placeholder="e.g. 50000" />
          </Field>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>This is the combined team premium target. When the team hits it, everyone gets a confetti celebration.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setEditingTeamGoal(false)}>Cancel</Btn>
            <Btn onClick={saveTeamGoal}>Save goal</Btn>
          </div>
        </Modal>
      )}

      {showGoalToast && <GoalToast onDone={() => setShowGoalToast(false)} />}
    </div>
  )
}
