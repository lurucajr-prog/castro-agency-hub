// ============================================================
// Castro Agency Hub — Admin Settings
// Place this file at: src/components/AdminSettings.jsx
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

  const standupOn       = settings['standup_enabled'] !== 'false'
  const announcementOn  = settings['announcement_active'] === 'true'

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

        {/* Morning standup */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Morning check-in
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:14, lineHeight:1.5 }}>
            Controls whether the mood standup widget shows on the dashboard each morning.
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <Btn
              sm
              variant={standupOn ? undefined : 'outline'}
              onClick={() => save('standup_enabled', 'true')}
            >
              Enable
            </Btn>
            <Btn
              sm
              variant={standupOn ? 'outline' : 'danger'}
              onClick={() => save('standup_enabled', 'false')}
            >
              Disable
            </Btn>
          </div>
          <div style={{ fontSize:11, color:'var(--text-4)' }}>
            Currently: {standupOn ? '🟢 Enabled' : '🔴 Disabled'}
          </div>
        </Card>

        {/* Quote of the day */}
        <Card style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Quote of the day
            <SavedBadge show={saved['quote_text']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            Shown in the navy card on the dashboard. Saving archives the previous quote to the history log.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 220px', gap:10 }}>
            <Field label="Quote text" mb={0}>
              <textarea
                key={settings['quote_text']}
                defaultValue={settings['quote_text'] || ''}
                onBlur={e => save('quote_text', e.target.value)}
                rows={2}
                style={{ ...IS, resize:'none', lineHeight:1.5 }}
                placeholder="Enter an inspiring quote…"
              />
            </Field>
            <Field label="Author (optional)" mb={0}>
              <input
                key={settings['quote_author']}
                defaultValue={settings['quote_author'] || ''}
                onBlur={e => save('quote_author', e.target.value)}
                style={IS}
                placeholder="— Author"
              />
            </Field>
          </div>
        </Card>

        {/* Announcement */}
        <Card style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>
            Team announcement
            <SavedBadge show={saved['announcement_text']} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
            The navy banner shown at the top of the dashboard. Team members can dismiss it per session. Toggle it off to hide without deleting the text.
          </div>
          <Field label="Announcement text">
            <input
              key={settings['announcement_text']}
              defaultValue={settings['announcement_text'] || ''}
              onBlur={e => save('announcement_text', e.target.value)}
              style={IS}
              placeholder="e.g. Team meeting Friday at 2pm!"
            />
          </Field>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Btn
              sm
              variant={announcementOn ? undefined : 'outline'}
              onClick={() => save('announcement_active', 'true')}
            >
              Show banner
            </Btn>
            <Btn
              sm
              variant={announcementOn ? 'outline' : 'danger'}
              onClick={() => save('announcement_active', 'false')}
            >
              Hide banner
            </Btn>
            <span style={{ fontSize:11, color:'var(--text-4)' }}>
              Currently: {announcementOn ? '🟢 Visible to team' : '🔴 Hidden'}
            </span>
          </div>
        </Card>

      </div>
    </div>
  )
}
