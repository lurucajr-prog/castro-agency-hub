import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Field, Modal, Spinner, IS } from './shared'

const BADGES = [
  { id: 'first_sale',    icon: '🌟', label: 'First Sale',    desc: 'Logged their first sale' },
  { id: 'month_club',    icon: '🏆', label: 'Month Club',    desc: '5+ sales in a month' },
  { id: 'power_month',   icon: '💪', label: 'Power Month',   desc: '10+ sales in a month' },
  { id: 'review_hero',   icon: '⭐', label: 'Review Hero',   desc: '5+ reviews logged' },
  { id: 'streak_master', icon: '🔥', label: 'Streak Master', desc: '3+ day selling streak' },
]

function calcStreak(sales, uid) {
  const dates = new Set(sales.filter(s => s.uid === uid).map(s => new Date(s.created_at).toDateString()))
  let streak = 0; const d = new Date()
  if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (dates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

function computeBadges(uid, allSales, monthSales, reviews) {
  const mySales      = allSales.filter(s => s.uid === uid)
  const myMonthSales = monthSales.filter(s => s.uid === uid)
  const myReviews    = reviews.filter(r => r.asked_by_uid === uid)
  const streak       = calcStreak(allSales, uid)
  return BADGES.filter(b => {
    if (b.id === 'first_sale')    return mySales.length >= 1
    if (b.id === 'month_club')    return myMonthSales.length >= 5
    if (b.id === 'power_month')   return myMonthSales.length >= 10
    if (b.id === 'review_hero')   return myReviews.length >= 5
    if (b.id === 'streak_master') return streak >= 3
    return false
  })
}

export default function Profiles({ user, setPage, openDm }) {
  const [profiles,        setProfiles]        = useState([])
  const [allSales,        setAllSales]        = useState([])
  const [monthSales,      setMonthSales]      = useState([])
  const [reviews,         setReviews]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selected,        setSelected]        = useState(null)
  const [editing,         setEditing]         = useState(false)
  const [bioDraft,        setBioDraft]        = useState('')
  const [saving,          setSaving]          = useState(false)
  const [uploading,       setUploading]       = useState(false)
  const [activityFeed,    setActivityFeed]    = useState([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [shoutouts,       setShoutouts]       = useState([])      // all active shoutouts
  const [showShoutout,    setShowShoutout]    = useState(null)    // profile to shout out
  const [shoutMsg,        setShoutMsg]        = useState('')
  const [shoutEmoji,      setShoutEmoji]      = useState('🏅')
  const [sendingShout,    setSendingShout]    = useState(false)
  const fileRef = useRef(null)

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  useEffect(() => { fetchAll() }, [])

  // Fetch activity feed whenever selected profile changes
  useEffect(() => {
    if (selected) fetchActivity(selected.id)
    else setActivityFeed([])
  }, [selected?.id])

  async function fetchAll() {
    const [p, allS, mS, r, sh] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('sales').select('uid, created_at, premium, client, policy_type'),
      supabase.from('sales').select('uid, premium').gte('created_at', monthStart),
      supabase.from('reviews').select('asked_by_uid, client, result, created_at'),
      supabase.from('shoutouts').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ])
    const profileData = p.data || []
    setProfiles(profileData)
    setAllSales(allS.data || [])
    setMonthSales(mS.data || [])
    setReviews(r.data || [])
    setShoutouts(sh.data || [])
    setLoading(false)

    // Persist any newly earned badges for the current user
    await persistBadges(user.id, profileData, allS.data || [], mS.data || [], r.data || [])
  }

  // Merge newly computed badges with stored ones and save if changed
  async function persistBadges(uid, profileData, allS, mS, r) {
    const myProfile  = profileData.find(p => p.id === uid)
    if (!myProfile) return

    const stored   = new Set(myProfile.badges_earned || [])
    const computed = new Set(computeBadges(uid, allS, mS, r).map(b => b.id))
    const merged   = [...new Set([...stored, ...computed])]

    if (merged.length > stored.size) {
      await supabase.from('profiles').update({ badges_earned: merged }).eq('id', uid)
      setProfiles(ps => ps.map(p => p.id === uid ? { ...p, badges_earned: merged } : p))
    }
  }

  // Fetch recent sales + reviews for a profile (shown in activity feed)
  async function fetchActivity(uid) {
    setLoadingActivity(true)
    const [s, r] = await Promise.all([
      supabase.from('sales').select('id, created_at, client, policy_type, premium').eq('uid', uid).order('created_at', { ascending: false }).limit(6),
      supabase.from('reviews').select('id, created_at, client, result').eq('asked_by_uid', uid).order('created_at', { ascending: false }).limit(6),
    ])
    const feed = [
      ...(s.data || []).map(x => ({ ...x, _type: 'sale' })),
      ...(r.data || []).map(x => ({ ...x, _type: 'review' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
    setActivityFeed(feed)
    setLoadingActivity(false)
  }

  async function saveBio() {
    if (!selected) return
    setSaving(true)
    await supabase.from('profiles').update({ bio: bioDraft }).eq('id', selected.id)
    setProfiles(ps => ps.map(p => p.id === selected.id ? { ...p, bio: bioDraft } : p))
    setSelected(s => s ? { ...s, bio: bioDraft } : s)
    setEditing(false)
    setSaving(false)
  }

  async function uploadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 3 * 1024 * 1024) { alert('Photo must be under 3MB.'); return }
    setUploading(true)
    const ext      = file.name.split('.').pop() || 'jpg'
    const fileName = `${selected.id}-avatar.${ext}`
    await supabase.storage.from('profile-photos').upload(fileName, file, { upsert: true, contentType: file.type })
    const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(fileName)
    await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', selected.id)
    setProfiles(ps => ps.map(p => p.id === selected.id ? { ...p, photo_url: publicUrl } : p))
    setSelected(s => s ? { ...s, photo_url: publicUrl } : s)
    setUploading(false)
  }

  function handleDm(profileId) {
    setSelected(null)
    if (openDm) {
      openDm(profileId)
    } else {
      setPage('dms')
    }
  }

  async function sendShoutout() {
    if (!shoutMsg.trim() || !showShoutout) return
    setSendingShout(true)
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const toProfile = profiles.find(p => p.id === showShoutout)
    const { data } = await supabase.from('shoutouts').insert({
      from_uid:   user.id,
      from_name:  user.name,
      to_uid:     showShoutout,
      to_name:    toProfile?.name || '',
      message:    shoutMsg.trim(),
      emoji:      shoutEmoji,
      expires_at: expiresAt,
    }).select().single()
    if (data) setShoutouts(prev => [data, ...prev])
    setShowShoutout(null)
    setShoutMsg('')
    setShoutEmoji('🏅')
    setSendingShout(false)
  }

  if (loading) return <Spinner />

  const members = profiles.filter(p => p.role === 'member')
  const sorted  = [...profiles.filter(p => p.role === 'admin'), ...members]

  return (
    <>
      <div style={{ padding: 22 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>Team profiles</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Meet the Castro Agency team</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {sorted.map(p => {
            const mPrem   = monthSales.filter(s => s.uid === p.id).reduce((s, x) => s + (x.premium || 0), 0)
            const mItems  = monthSales.filter(s => s.uid === p.id).length
            const streak  = calcStreak(allSales, p.id)
            const isMe    = p.id === user.id

            // Use persisted badges if available, otherwise compute live
            const earnedIds    = p.badges_earned?.length > 0 ? p.badges_earned : computeBadges(p.id, allSales, monthSales, reviews).map(b => b.id)
            const displayBadges = BADGES.filter(b => earnedIds.includes(b.id))

            return (
              <div key={p.id} style={{ background: 'var(--surface)', border: `1.5px solid ${isMe ? N : 'var(--border)'}`, borderRadius: 12, padding: '18px 16px', cursor: 'pointer', textAlign: 'center', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                onClick={() => setSelected(p)}>

                {/* Avatar */}
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${p.role === 'admin' ? R : N}` }} />
                    : <div style={{ width: 64, height: 64, borderRadius: '50%', background: p.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600, color: p.role === 'admin' ? '#fff' : '#1e40af', margin: '0 auto' }}>{p.ini}</div>
                  }
                  {streak > 0 && <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--surface)', borderRadius: 99, fontSize: 11, padding: '1px 4px', border: '1px solid var(--border)' }}>🔥{streak}</div>}
                </div>

                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{p.title}</div>
                {p.role === 'admin' && <div style={{ fontSize: 10, fontWeight: 500, color: R, marginBottom: 8 }}>Admin</div>}

                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: N }}>{mItems}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Items</div>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>${mPrem >= 1000 ? Math.round(mPrem / 1000) + 'k' : mPrem}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Premium</div>
                  </div>
                </div>

                {displayBadges.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {displayBadges.map(b => <span key={b.id} title={b.desc} style={{ fontSize: 16 }}>{b.icon}</span>)}
                  </div>
                )}

                {isMe && <div style={{ fontSize: 10, color: N, fontWeight: 500, marginBottom: 6 }}>You</div>}

                {/* DM button -- only shown on other people's cards */}
                {p.id !== user.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleDm(p.id) }}
                      style={{ flex: 1, fontSize: 11, color: N, background: 'var(--primary-light)', border: `1px solid var(--primary-mid)`, borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      💬 DM
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setShowShoutout(p.id); setShoutMsg(''); setShoutEmoji('🏅') }}
                      style={{ flex: 1, fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      🏅 Shoutout
                    </button>
                  </div>
                )}

                {/* Active shoutouts for this person */}
                {shoutouts.filter(s => s.to_uid === p.id).slice(0, 1).map(s => (
                  <div key={s.id} style={{ marginTop: 6, background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 7, padding: '5px 8px', fontSize: 10, color: '#78350f', lineHeight: 1.4 }}>
                    {s.emoji} <em>"{s.message}"</em> — {s.from_name}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Profile detail modal ── */}
      {selected && (
        <Modal title={selected.name} onClose={() => { setSelected(null); setEditing(false) }} width={560}>

          {/* Header: photo + name + DM button */}
          <div style={{ display: 'flex', gap: 18, marginBottom: 18, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              {selected.photo_url
                ? <img src={selected.photo_url} alt={selected.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${selected.role === 'admin' ? R : N}` }} />
                : <div style={{ width: 80, height: 80, borderRadius: '50%', background: selected.role === 'admin' ? R : 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 600, color: selected.role === 'admin' ? '#fff' : '#1e40af' }}>{selected.ini}</div>
              }
              {selected.id === user.id && (
                <>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ marginTop: 8, fontSize: 10, color: N, background: 'none', border: `1px solid ${N}`, borderRadius: 5, padding: '3px 9px', cursor: 'pointer', display: 'block', width: '100%', fontFamily: 'inherit' }}>
                    {uploading ? 'Uploading…' : 'Change photo'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadPhoto(e.target.files[0]); e.target.value = '' }} />
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{selected.title}</div>
              {selected.role === 'admin' && <span style={{ fontSize: 10, fontWeight: 500, color: R, background: 'var(--danger-light)', padding: '2px 7px', borderRadius: 99 }}>Admin</span>}
              {/* DM button in modal */}
              {selected.id !== user.id && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => handleDm(selected.id)}
                    style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: N, border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    💬 Send DM
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Items this month',  val: monthSales.filter(s => s.uid === selected.id).length,                                           c: N },
              { label: 'Premium this month',val: '$' + monthSales.filter(s => s.uid === selected.id).reduce((s, x) => s + (x.premium || 0), 0).toLocaleString(), c: 'var(--success)' },
              { label: 'All-time sales',    val: allSales.filter(s => s.uid === selected.id).length,                                             c: 'var(--purple)' },
              { label: 'Selling streak',    val: calcStreak(allSales, selected.id) + 'd',                                                       c: '#d97706' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: s.c }}>{s.val}</div>
                <div style={{ fontSize: 9, color: 'var(--text-4)', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Badges */}
          {(() => {
            const earnedIds     = profiles.find(p => p.id === selected.id)?.badges_earned || []
            const liveBadgeIds  = computeBadges(selected.id, allSales, monthSales, reviews).map(b => b.id)
            const allEarnedIds  = [...new Set([...earnedIds, ...liveBadgeIds])]
            const bs            = BADGES.filter(b => allEarnedIds.includes(b.id))
            if (!bs.length) return null
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Badges</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {bs.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 10px' }}>
                      <span style={{ fontSize: 14 }}>{b.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)' }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Bio */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              About
              {selected.id === user.id && !editing && (
                <button onClick={() => { setBioDraft(selected.bio || ''); setEditing(true) }} style={{ fontSize: 10, color: N, background: 'none', border: `1px solid ${N}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>✏ Edit</button>
              )}
            </div>
            {editing && selected.id === user.id ? (
              <>
                <textarea value={bioDraft} onChange={e => setBioDraft(e.target.value)} rows={3} placeholder="Tell the team a little about yourself…" style={{ ...IS, resize: 'none', lineHeight: 1.6, fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                  <Btn onClick={saveBio} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
                  <Btn variant="outline" onClick={() => setEditing(false)}>Cancel</Btn>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: selected.bio ? 'var(--text-2)' : 'var(--text-4)', lineHeight: 1.65 }}>
                {selected.bio || `${selected.name} hasn't added a bio yet.`}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Recent activity
            </div>
            {loadingActivity ? (
              <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '12px 0' }}>Loading…</div>
            ) : activityFeed.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>No recent activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activityFeed.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item._type === 'sale' ? '💰' : '⭐'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item._type === 'sale' ? (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.client} — {item.policy_type}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            ${(item.premium || 0).toLocaleString()} · {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.client} — review request
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {item.result} · {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Shoutouts for this person */}
            {(() => {
              const myShouts = shoutouts.filter(s => s.to_uid === selected?.id)
              if (myShouts.length === 0) return null
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Shoutouts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {myShouts.map(s => (
                      <div key={s.id} style={{ background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 8, padding: '9px 12px' }}>
                        <div style={{ fontSize: 13, color: '#78350f', marginBottom: 2 }}>{s.emoji} <em>"{s.message}"</em></div>
                        <div style={{ fontSize: 11, color: '#92400e' }}>From {s.from_name} · expires in {Math.max(0, Math.ceil((new Date(s.expires_at) - Date.now()) / 86400000))}d</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Send shoutout button in modal */}
            {selected?.id !== user.id && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setShowShoutout(selected.id); setShoutMsg(''); setShoutEmoji('🏅') }}
                  style={{ fontSize: 12, fontWeight: 500, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  🏅 Send {selected?.name?.split(' ')[0]} a shoutout
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Send shoutout modal */}
      {showShoutout && (
        <Modal title={`Shoutout — ${profiles.find(p => p.id === showShoutout)?.name}`} onClose={() => setShowShoutout(null)} width={400}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
            Shoutouts appear on their profile card for 2 days. Everyone on the team can see them.
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Pick an emoji</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['🏅', '⭐', '💪', '🎯', '🔥', '👏', '🚀', '❤️'].map(e => (
                <button key={e} onClick={() => setShoutEmoji(e)} style={{ fontSize: 22, background: shoutEmoji === e ? 'var(--primary-light)' : 'var(--surface-2)', border: `2px solid ${shoutEmoji === e ? N : 'transparent'}`, borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Message</div>
            <textarea
              value={shoutMsg}
              onChange={e => setShoutMsg(e.target.value)}
              placeholder={`e.g. Great work on that close today!`}
              rows={3}
              style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 12px', fontSize: 13, resize: 'none', outline: 'none', background: 'var(--surface)', color: 'var(--text-1)', fontFamily: 'inherit', lineHeight: 1.5 }}
              maxLength={120}
            />
            <div style={{ fontSize: 10, color: 'var(--text-4)', textAlign: 'right', marginTop: 2 }}>{shoutMsg.length}/120</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setShowShoutout(null)}>Cancel</Btn>
            <Btn onClick={sendShoutout} disabled={sendingShout || !shoutMsg.trim()} style={{ background: '#d97706' }}>
              {sendingShout ? 'Sending…' : `${shoutEmoji} Send shoutout`}
            </Btn>
          </div>
        </Modal>
      )}
    </>
  )
}
