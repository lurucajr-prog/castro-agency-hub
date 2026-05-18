// ============================================================
// Castro Agency Hub — Admin Settings
// Place this file at: src/components/AdminSettings.jsx
// Batch 1: added Google review link field
// ============================================================
import { useState, useEffect } from 'react'
import { supabase }   from '../lib/supabase'
import { N, Card, Btn, Field, Spinner, IS } from './shared'

function SavedBadge({ show }) {
  if (!show) return null
  return <span style={{ fontSize:11, color:'var(--success)', marginLeft:8, fontWeight:500 }}>✓ Saved</span>
}

export default function AdminSettings({ user }) {
  const [settings, setSettings] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [saved,    setSaved]    = useState({})

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const { data } = await supabase.from('settings').select('*')
    const map = {}
    ;(data || []).forEach(s => { map[s.key] = s.value })
    setSettings(map)
    setLoading(false)
  }

  async function save(key, value) {
    await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
    setSettings(s => ({ ...s, [key]: value }))
    setSaved(s => ({ ...s, [key]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2200)
  }

  if (loading) return <Spinner />

  const standupOn      = settings['standup_enabled'] !== 'false'
  const announcementOn = settings['announcement_active'] === 'true'

  return (
    <div style={{ padding:22 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:600, color:'var(--text-1)', marginBottom:2 }}>Admin settings</div>
        <div style={{ fontSize:12, color:'var(--text-3)' }}>Manage app configuration — changes take effect immediately</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, maxWidth:860 }}>

        {/* Team goal */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Monthly team goal
            <SavedBadge show={saved['team_goal']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            The premium target shown on the leaderboard and dashboard. Changing this resets the goal confetti for the current month.
          </div>
          <Field label="Monthly premium goal ($)" mb={0}>
            <input
              style={IS}
              type="number"
              defaultValue={settings['team_goal'] || '50000'}
              onBlur={e => save('team_goal', e.target.value)}
              placeholder="e.g. 50000"
            />
          </Field>
        </Card>

        {/* Quote of the day */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Quote of the day
            <SavedBadge show={saved['quote_text']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            The inspirational quote shown on the dashboard. Edit it inline on the dashboard or here.
          </div>
          <Field label="Quote text">
            <input style={IS} defaultValue={settings['quote_text'] || ''} onBlur={e => save('quote_text', e.target.value)} placeholder="Make today count." />
          </Field>
          <Field label="Author" mb={0}>
            <input style={IS} defaultValue={settings['quote_author'] || ''} onBlur={e => save('quote_author', e.target.value)} placeholder="Unknown" />
          </Field>
        </Card>

        {/* Morning standup */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Morning check-in
            <SavedBadge show={saved['standup_enabled']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            The daily mood check-in on the dashboard. Responses are anonymous to agents, visible to admins.
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button
              onClick={() => save('standup_enabled', String(!standupOn))}
              style={{ padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:500, background: standupOn ? N : 'var(--surface-3)', color: standupOn ? '#fff' : 'var(--text-3)' }}
            >
              {standupOn ? '✓ Enabled' : 'Disabled'}
            </button>
            <span style={{ fontSize:11, color:'var(--text-4)' }}>Click to toggle</span>
          </div>
        </Card>

        {/* Announcement banner */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Announcement banner
            <SavedBadge show={saved['announcement_text']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            Shows a dismissible banner at the top of the dashboard for the whole team. You can also edit it inline on the dashboard.
          </div>
          <Field label="Announcement text">
            <input style={IS} defaultValue={settings['announcement_text'] || ''} onBlur={e => save('announcement_text', e.target.value)} placeholder="e.g. Team meeting at 3pm today!" />
          </Field>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button
              onClick={() => save('announcement_active', String(!announcementOn))}
              style={{ padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:500, background: announcementOn ? N : 'var(--surface-3)', color: announcementOn ? '#fff' : 'var(--text-3)' }}
            >
              {announcementOn ? '✓ Active' : 'Inactive'}
            </button>
            <span style={{ fontSize:11, color:'var(--text-4)' }}>Toggle to show/hide on dashboard</span>
          </div>
        </Card>

        {/* Google review link — NEW */}
        <Card style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Google review link
            <SavedBadge show={saved['google_review_link']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            Your agency's Google Business review link. Once saved, it auto-fills the review templates and the "Review link" generator button on the Reviews page. Get this link from your Google Business Profile.
          </div>
          <Field label="Google review URL" mb={0}>
            <input
              style={IS}
              type="url"
              defaultValue={settings['google_review_link'] || ''}
              onBlur={e => save('google_review_link', e.target.value)}
              placeholder="https://g.page/r/YOUR_BUSINESS_ID/review"
            />
          </Field>
          {settings['google_review_link'] && (
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)' }} />
              <span style={{ fontSize:11, color:'var(--success)' }}>Link is set and active</span>
              <a href={settings['google_review_link']} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:N, textDecoration:'none', marginLeft:4 }}>Test link →</a>
            </div>
          )}
        </Card>

        {/* Learning — video link field */}
        <Card style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Learning section — video upload link
            <SavedBadge show={saved['learning_video_link']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            The URL that agents click when uploading a video to Learning (Loom, YouTube, etc.). This appears as a helper link in the Learning section.
          </div>
          <Field label="Video hosting URL" mb={0}>
            <input
              style={IS}
              type="url"
              defaultValue={settings['learning_video_link'] || ''}
              onBlur={e => save('learning_video_link', e.target.value)}
              placeholder="https://loom.com or https://youtube.com"
            />
          </Field>
        </Card>

      </div>
    </div>
  )
}
