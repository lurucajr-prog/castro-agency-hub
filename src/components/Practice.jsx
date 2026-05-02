import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Spinner, EmptyState } from './shared'

const SCENARIOS = [
  {
    id: 'cold-price',
    name: 'Cold call — price shopper',
    category: 'Auto',
    difficulty: 'Hard',
    description: 'Prospect shopping for cheaper rates, currently with Geico',
    objections: ["That's too expensive", "I've been with my agent for years"],
    systemPrompt: `You are Mike, a 34-year-old Chicago resident. You are playing the role of a prospect receiving a cold call from an insurance agent at Castro Agency (an Allstate agency). You currently pay $142/month with Geico and have been with them for 3 years.

PERSONALITY: Mildly skeptical, busy, but polite. You're not rude but you're not immediately enthusiastic either.

YOUR OBJECTIONS (use these naturally throughout the conversation, not all at once):
- "That's too expensive" / price concerns — bring this up when they mention pricing or ask for a quote
- "I've been with my agent for years" — use this when they push for you to switch

RULES:
- Stay fully in character as Mike at all times
- Start the call by simply saying "Hello?"
- Respond naturally and conversationally, like a real phone call
- Keep responses SHORT — 1-3 sentences max, like real conversation
- If the agent handles an objection well, warm up slightly
- If the agent handles it poorly, become more resistant
- Never break character or give coaching advice
- If asked about your coverage details, make up realistic numbers`,
  },
  {
    id: 'busy-prospect',
    name: 'Busy prospect',
    category: 'Auto',
    difficulty: 'Medium',
    description: 'Hard to reach — says they have no time and are not interested',
    objections: ["I don't have time", "I'm not interested right now"],
    systemPrompt: `You are Sarah, a 42-year-old suburban mom receiving a cold call from an insurance agent. You are genuinely busy — you have kids in the background and are always in a rush.

PERSONALITY: Distracted, a little impatient, but not mean. You give short answers.

YOUR OBJECTIONS:
- "I don't have time right now" — use this early and often
- "I'm really not interested" — use this if they don't hook you quickly

RULES:
- Stay fully in character as Sarah
- Start with "Hello?" and sound slightly distracted
- Keep ALL responses to 1-2 sentences max — you're busy
- If the agent is respectful of your time and makes a compelling quick pitch, warm up a little
- If they ramble or don't get to the point, shut it down
- Never break character`,
  },
  {
    id: 'spouse-delay',
    name: 'Spousal delay',
    category: 'Auto',
    difficulty: 'Medium',
    description: 'Interested but keeps deferring to spouse before making any decision',
    objections: ["Let me talk to my wife/husband", "Not interested right now"],
    systemPrompt: `You are David, a 38-year-old who handles the finances but always defers big decisions to his wife Maria. You are actually somewhat interested in saving money on insurance but you never commit to anything without running it by her first.

PERSONALITY: Friendly and engaged but noncommittal. You like the idea but won't say yes.

YOUR OBJECTIONS:
- "I'd have to talk to my wife first" — use this whenever they try to move forward or close
- "Now's not a great time" — use this as a deflection if they push too hard

RULES:
- Start with "Hello?"
- Be genuinely friendly and curious — ask questions about pricing
- But always stall with the wife objection before committing
- If the agent suggests a specific next step (like a scheduled call with both of you), be open to it
- Keep responses to 2-3 sentences
- Never break character`,
  },
  {
    id: 'loyal-client',
    name: 'Loyal to their agent',
    category: 'Home',
    difficulty: 'Hard',
    description: 'Long-time client of another agency, strong emotional loyalty',
    objections: ["I've been with my agent for years", "I'm not interested"],
    systemPrompt: `You are Robert, a 55-year-old homeowner who has been with the same State Farm agent (Bob) for over 15 years. You genuinely like Bob and feel loyal to him. You're not unhappy with your current insurance — you just pay more than you probably need to.

PERSONALITY: Warm but firm. You like people but you're loyal. You feel like switching would be a betrayal.

YOUR OBJECTIONS:
- "I've been with Bob for 15 years, he's taken good care of us" — your main objection
- "I'm really not looking to switch" — secondary

RULES:
- Start with "Hello?"
- Be friendly and warm — you're not rude
- But be genuinely resistant to switching — this isn't just a stall, you really like your agent
- If the agent makes a compelling financial case (big savings), show some curiosity but still hesitate
- Never break character
- Keep responses conversational, 2-3 sentences`,
  },
  {
    id: 'new-homeowner',
    name: 'New homeowner bundle',
    category: 'Home',
    difficulty: 'Easy',
    description: 'Just bought a house, needs home + auto. Open to switching.',
    objections: ["That's too expensive"],
    systemPrompt: `You are Jessica, a 31-year-old who just closed on her first home last month. You currently have auto insurance but need home insurance and you've been meaning to shop around for a bundle deal.

PERSONALITY: Open, friendly, a little overwhelmed by the home-buying process but eager to get things sorted.

YOUR OBJECTIONS:
- "That seems a little pricey" — bring this up if they quote you something over $200/month combined

RULES:
- Start with "Hello?"
- Be genuinely open and interested — this is a warm lead situation
- Ask real questions: what's covered, how does bundling work, what's the deductible
- Only push back on price if it seems high
- Be ready to move forward if they handle the conversation well
- Keep responses conversational, 2-3 sentences
- Never break character`,
  },
  {
    id: 'renewal-save',
    name: 'Renewal save',
    category: 'Retention',
    difficulty: 'Hard',
    description: 'Existing client threatening to cancel — found cheaper quote elsewhere',
    objections: ["That's too expensive", "I found a better deal"],
    systemPrompt: `You are Carlos, an existing Allstate customer whose renewal just came in $40/month higher than last year. You got a quote from Progressive that's $35/month cheaper and you're seriously considering switching.

PERSONALITY: Frustrated but reasonable. You liked your old rate. You're not angry, just disappointed and looking for a reason to stay.

YOUR OBJECTIONS:
- "My renewal went up a lot this year" — lead with this
- "Progressive quoted me $35 cheaper" — use this when they ask about the competing quote
- "I've been a customer for 4 years, I feel like I should get a better rate" — loyalty card

RULES:
- Start with "Hello?" — you know it's the agency calling about your renewal
- Be frustrated but not hostile
- You WANT to stay if they can make it work — you just need a reason
- If they acknowledge your frustration and work with you, warm up
- If they just defend the price without helping, dig in
- Keep responses 2-3 sentences
- Never break character`,
  },
]

const DIFF_COLORS = {
  Easy:   { bg: '#dcfce7', tx: '#166534' },
  Medium: { bg: '#dbeafe', tx: '#1e40af' },
  Hard:   { bg: '#fee2e2', tx: '#991b1b' },
}

const CAT_COLORS = {
  Auto:      { bg: '#ede9fe', tx: '#5b21b6' },
  Home:      { bg: '#e0f2fe', tx: '#075985' },
  Retention: { bg: '#fef9c3', tx: '#854d0e' },
}

export default function Practice({ user }) {
  const [view, setView] = useState('home') // home | call | scorecard | admin
  const [activeScenario, setActiveScenario] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState(null)
  const [sessions, setSessions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [scorecard, setScorecard] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const endRef = useRef(null)
  const timerRef = useRef(null)
  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchSessions() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerActive])

  async function fetchSessions() {
    const [s, p] = await Promise.all([
      supabase.from('practice_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    setSessions(s.data || [])
    setProfiles(p.data || [])
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function startCall(scenario) {
    setActiveScenario(scenario)
    setMessages([])
    setInput('')
    setTip(null)
    setElapsed(0)
    setTimerActive(true)
    setView('call')

    // Create session record
    const { data } = await supabase.from('practice_sessions').insert({
      uid: user.id,
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      difficulty: scenario.difficulty,
      messages: [],
      completed: false,
    }).select().single()
    if (data) setSessionId(data.id)

    // Get opening line from AI
    setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          system: scenario.systemPrompt,
          messages: [{ role: 'user', content: 'START_CALL' }],
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Hello?'
      const aiMsg = { role: 'prospect', text: reply, ts: new Date() }
      setMessages([aiMsg])
    } catch (e) {
      setMessages([{ role: 'prospect', text: 'Hello?', ts: new Date() }])
    }
    setLoading(false)
  }

  async function sendMessage() {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')

    const agentMsg = { role: 'agent', text: trimmed, ts: new Date() }
    const newMessages = [...messages, agentMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Build message history for AI
      const history = newMessages.map(m => ({
        role: m.role === 'agent' ? 'user' : 'assistant',
        content: m.text,
      }))

      // Get prospect response
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 150,
          system: activeScenario.systemPrompt,
          messages: history,
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || '...'
      const prospectMsg = { role: 'prospect', text: reply, ts: new Date() }
      const finalMessages = [...newMessages, prospectMsg]
      setMessages(finalMessages)

      // Get live coaching tip (every other message)
      if (newMessages.length % 2 === 0) {
        getTip(finalMessages)
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'prospect', text: "Sorry, I didn't catch that.", ts: new Date() }])
    }
    setLoading(false)
  }

  async function getTip(msgs) {
    try {
      const history = msgs.map(m => ({
        role: m.role === 'agent' ? 'user' : 'assistant',
        content: m.text,
      }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: `You are a sales coach observing a practice call at an insurance agency. The agent is practicing with a simulated prospect. 
          
Give ONE short coaching tip based on the last agent message. Format as JSON only:
{
  "type": "good" | "warning" | "tip",
  "title": "short label (3-5 words)",
  "text": "one sentence coaching note"
}

type "good" = they did something right
type "warning" = they missed something or prospect objection is coming  
type "tip" = suggest a specific line or technique

Be specific and actionable. Reference actual words from the conversation.`,
          messages: [
            ...history,
            { role: 'user', content: 'Give me a coaching tip on the last agent message.' }
          ],
        }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setTip(parsed)
    } catch (e) {
      // tip fails silently
    }
  }

  async function endCall() {
    setTimerActive(false)
    setLoading(true)

    try {
      const history = messages.map(m => ({
        role: m.role === 'agent' ? 'user' : 'assistant',
        content: m.text,
      }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system: `You are a sales coach scoring a practice insurance sales call. Score the agent's performance and give specific feedback.

Return JSON only (no markdown, no backticks):
{
  "rapport": <integer 1-10>,
  "objections": <integer 1-10>,
  "pitch": <integer 1-10>,
  "overall": <integer 1-10>,
  "grade": "A" | "B" | "C" | "D",
  "summary": "2-3 sentence overall summary of their performance",
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "best_line": "quote the single best thing the agent said verbatim",
  "missed_opportunity": "one specific thing they should have said but didn't"
}

Be honest and specific. Reference actual things they said.`,
          messages: [
            ...history,
            { role: 'user', content: `Score this practice call. Scenario: ${activeScenario.name}. Objections to handle: ${activeScenario.objections.join(', ')}.` }
          ],
        }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const sc = JSON.parse(clean)
      setScorecard(sc)

      // Save to DB
      if (sessionId) {
        await supabase.from('practice_sessions').update({
          messages: messages,
          score_rapport: sc.rapport,
          score_objections: sc.objections,
          score_pitch: sc.pitch,
          score_overall: sc.overall,
          feedback: sc.summary,
          completed: true,
        }).eq('id', sessionId)
      }

      await fetchSessions()
      setView('scorecard')
    } catch (e) {
      setView('scorecard')
      setScorecard({ rapport: 5, objections: 5, pitch: 5, overall: 5, grade: 'C', summary: 'Could not generate scorecard.', strengths: [], improvements: [], best_line: '', missed_opportunity: '' })
    }
    setLoading(false)
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const gradeColor = (g) => ({ A: '#166534', B: '#1e40af', C: '#92400e', D: '#991b1b' }[g] || '#6b7280')
  const gradeGbg = (g) => ({ A: '#dcfce7', B: '#dbeafe', C: '#fef9c3', D: '#fee2e2' }[g] || '#f3f4f6')

  const myS = sessions.filter(s => s.uid === user.id)

  // ─── ADMIN VIEW ───────────────────────────────────────────────
  if (view === 'admin' && isAdmin) {
    const members = profiles.filter(p => p.role === 'member')
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Practice results</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>See how the team is training</div>
          </div>
          <Btn variant="outline" onClick={() => setView('home')}>← Back</Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {members.map(m => {
            const mSessions = sessions.filter(s => s.uid === m.id && s.completed)
            const latest = mSessions[0]
            const avg = mSessions.length ? Math.round(mSessions.reduce((a, s) => a + (s.score_overall || 0), 0) / mSessions.length) : null
            return (
              <Card key={m.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#1e40af' }}>{m.ini}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{mSessions.length} session{mSessions.length !== 1 ? 's' : ''} completed</div>
                  </div>
                  {avg !== null && (
                    <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: avg >= 7 ? '#166534' : avg >= 5 ? '#d97706' : '#dc2626' }}>{avg}/10</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>avg score</div>
                    </div>
                  )}
                </div>

                {mSessions.length === 0
                  ? <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>No practice sessions yet</div>
                  : (
                    <>
                      {mSessions.slice(0, 3).map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: '#111' }}>{s.scenario_name}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ ...DIFF_COLORS[s.difficulty], padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: DIFF_COLORS[s.difficulty]?.bg, color: DIFF_COLORS[s.difficulty]?.tx }}>{s.difficulty}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: s.score_overall >= 7 ? '#166534' : s.score_overall >= 5 ? '#d97706' : '#dc2626' }}>{s.score_overall}/10</span>
                          </div>
                        </div>
                      ))}
                      {mSessions.length > 3 && <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', paddingTop: 6 }}>+{mSessions.length - 3} more sessions</div>}
                    </>
                  )
                }

                {latest && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#f9fafb', borderRadius: 7, border: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', marginBottom: 3 }}>LAST SESSION FEEDBACK</div>
                    <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{latest.feedback || 'No feedback recorded.'}</div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── SCORECARD VIEW ───────────────────────────────────────────
  if (view === 'scorecard' && scorecard) {
    const scores = [
      { label: 'Rapport building', val: scorecard.rapport },
      { label: 'Handling objections', val: scorecard.objections },
      { label: 'Pitch clarity', val: scorecard.pitch },
    ]
    return (
      <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Call complete · {activeScenario?.name}</div>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: gradeGbg(scorecard.grade), border: `3px solid ${gradeColor(scorecard.grade)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 32, fontWeight: 600, color: gradeColor(scorecard.grade) }}>{scorecard.grade}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>{scorecard.overall}/10 overall</div>
        </div>

        <Card mb={12}>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.65, marginBottom: 14 }}>{scorecard.summary}</div>
          {scores.map(s => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: '#374151' }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: s.val >= 7 ? '#166534' : s.val >= 5 ? '#d97706' : '#dc2626' }}>{s.val}/10</span>
              </div>
              <div style={{ height: 5, background: '#f3f4f6', borderRadius: 99 }}>
                <div style={{ width: `${s.val * 10}%`, height: '100%', background: s.val >= 7 ? '#16a34a' : s.val >= 5 ? '#d97706' : '#dc2626', borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#166534', marginBottom: 8 }}>✓ Strengths</div>
            {(scorecard.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 5, paddingLeft: 8, borderLeft: '2px solid #86efac' }}>{s}</div>)}
          </Card>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#dc2626', marginBottom: 8 }}>↑ Improve</div>
            {(scorecard.improvements || []).map((s, i) => <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 5, paddingLeft: 8, borderLeft: '2px solid #fca5a5' }}>{s}</div>)}
          </Card>
        </div>

        {scorecard.best_line && (
          <Card mb={12}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#1e40af', marginBottom: 6 }}>⭐ Best line</div>
            <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic', paddingLeft: 10, borderLeft: '3px solid #93c5fd' }}>"{scorecard.best_line}"</div>
          </Card>
        )}

        {scorecard.missed_opportunity && (
          <Card mb={20}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#92400e', marginBottom: 6 }}>💡 Missed opportunity</div>
            <div style={{ fontSize: 12, color: '#374151' }}>{scorecard.missed_opportunity}</div>
          </Card>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Btn variant="outline" onClick={() => setView('home')}>Back to scenarios</Btn>
          <Btn onClick={() => startCall(activeScenario)}>Try again</Btn>
        </div>
      </div>
    )
  }

  // ─── ACTIVE CALL VIEW ─────────────────────────────────────────
  if (view === 'call') {
    const tipStyle = {
      good:    { bg: '#f0fdf4', border: '#86efac', tx: '#166534' },
      warning: { bg: '#fff7ed', border: '#fed7aa', tx: '#92400e' },
      tip:     { bg: '#eff6ff', border: '#93c5fd', tx: '#1e40af' },
    }[tip?.type] || { bg: '#f9fafb', border: '#e5e7eb', tx: '#374151' }

    const tipIcon = { good: '✓', warning: '⚡', tip: '💡' }[tip?.type] || '•'

    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Call area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '11px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{activeScenario?.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
                <span style={{ fontSize: 11, color: '#6b7280' }}>Call in progress · {formatTime(elapsed)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="outline" sm onClick={() => getTip(messages)}>Hint</Btn>
              <Btn sm onClick={endCall} style={{ background: '#dc2626' }} disabled={loading}>
                {loading && view === 'call' ? 'Scoring…' : 'End call'}
              </Btn>
            </div>
          </div>

          {/* Prospect info */}
          <div style={{ padding: '8px 16px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', gap: 20, flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: '#075985' }}><span style={{ fontWeight: 600 }}>Scenario:</span> {activeScenario?.description}</div>
            <div style={{ fontSize: 11, color: '#075985' }}><span style={{ fontWeight: 600 }}>Expect:</span> {activeScenario?.objections.join(' · ')}</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#f9fafb' }}>
            {messages.map((m, i) => {
              const isAgent = m.role === 'agent'
              return (
                <div key={i} style={{ display: 'flex', gap: 9, flexDirection: isAgent ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: isAgent ? R : '#dbeafe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 600, color: isAgent ? '#fff' : '#1e40af',
                  }}>{isAgent ? user.ini : 'AI'}</div>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexDirection: isAgent ? 'row-reverse' : 'row', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{isAgent ? 'You' : 'Prospect'}</span>
                    </div>
                    <div style={{
                      background: isAgent ? N : '#fff',
                      color: isAgent ? '#fff' : '#111',
                      padding: '9px 13px',
                      borderRadius: isAgent ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                      fontSize: 13, lineHeight: 1.6,
                      border: isAgent ? 'none' : '1px solid #e5e7eb',
                    }}>{m.text}</div>
                  </div>
                </div>
              )
            })}
            {loading && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#1e40af' }}>AI</div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '11px 14px', borderRadius: '2px 12px 12px 12px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[1, 0.6, 0.3].map((o, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', opacity: o }} />)}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: 9, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type your response as the agent…"
              disabled={loading}
              style={{ flex: 1, fontSize: 13, padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: 22, background: '#f9fafb', color: '#111', outline: 'none' }}
            />
            <Btn onClick={sendMessage} disabled={loading} style={{ borderRadius: 22, padding: '9px 20px' }}>Send</Btn>
          </div>
        </div>

        {/* Live tips panel */}
        <div style={{ width: 220, borderLeft: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Live coaching</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Updates as you go</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {/* Current tip */}
            {tip ? (
              <div style={{ background: tipStyle.bg, border: `1px solid ${tipStyle.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: tipStyle.tx, marginBottom: 4 }}>{tipIcon} {tip.title}</div>
                <div style={{ fontSize: 12, color: tipStyle.tx, lineHeight: 1.5 }}>{tip.text}</div>
              </div>
            ) : (
              <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Tips will appear as you respond</div>
              </div>
            )}

            {/* Scenario reminders */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>Watch for</div>
              {activeScenario?.objections.map((o, i) => (
                <div key={i} style={{ padding: '6px 9px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, marginBottom: 6, fontSize: 11, color: '#92400e' }}>
                  "{o}"
                </div>
              ))}
            </div>

            {/* Quick tips */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>General tips</div>
              {[
                'Use their name often',
                'Acknowledge before pitching',
                'Ask questions, don\'t lecture',
                'Always ask for the next step',
              ].map((t, i) => (
                <div key={i} style={{ fontSize: 11, color: '#374151', padding: '4px 0', borderBottom: '1px solid #f9fafb' }}>• {t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── HOME VIEW ────────────────────────────────────────────────
  const categories = [...new Set(SCENARIOS.map(s => s.category))]

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Practice calls</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Pick a scenario and practice with an AI prospect — full objections, real feedback</div>
        </div>
        {isAdmin && (
          <Btn variant="outline" onClick={() => setView('admin')}>Team results →</Btn>
        )}
      </div>

      {/* My recent sessions */}
      {myS.filter(s => s.completed).length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>My recent sessions</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {myS.filter(s => s.completed).slice(0, 3).map(s => (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: s.score_overall >= 7 ? '#166534' : s.score_overall >= 5 ? '#d97706' : '#dc2626' }}>{s.score_overall}/10</div>
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>score</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{s.scenario_name}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenario grid */}
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ background: CAT_COLORS[cat]?.bg, color: CAT_COLORS[cat]?.tx, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{cat}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {SCENARIOS.filter(s => s.category === cat).map(s => {
              const dc = DIFF_COLORS[s.difficulty]
              const mySessions = myS.filter(x => x.scenario_id === s.id && x.completed)
              const bestScore = mySessions.length ? Math.max(...mySessions.map(x => x.score_overall || 0)) : null
              return (
                <div
                  key={s.id}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = N}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                  onClick={() => startCall(s)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{s.name}</div>
                    <span style={{ background: dc.bg, color: dc.tx, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>{s.difficulty}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>{s.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {s.objections.map((o, i) => (
                        <span key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280', padding: '2px 7px', borderRadius: 99, fontSize: 10 }}>"{o.length > 20 ? o.slice(0, 20) + '…' : o}"</span>
                      ))}
                    </div>
                    {bestScore !== null && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: bestScore >= 7 ? '#166534' : '#d97706', flexShrink: 0, marginLeft: 8 }}>Best: {bestScore}/10</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
