// ============================================================
// Castro Agency Hub — App Entry (routing shell)
// Place this file at: src/App.jsx
// ============================================================
import './styles/theme.css'
import { useState, useEffect } from 'react'
import { supabase }          from './lib/supabase'
import ErrorBoundary         from './components/ErrorBoundary'
import Login                 from './components/Login'
import Sidebar               from './components/Sidebar'
import TopBar                from './components/TopBar'
import Dashboard             from './components/Dashboard'
import Tasks                 from './components/Tasks'
import Referrals             from './components/Referrals'
import Reviews               from './components/Reviews'
import Sales                 from './components/Sales'
import LiveLeads             from './components/LiveLeads'
import Cancellations         from './components/Cancellations'
import Renewals              from './components/Renewals'
import Learning              from './components/Learning'
import Chat                  from './components/Chat'
import DirectMessages        from './components/DirectMessages'
import Profiles              from './components/Profiles'
import Suggestions           from './components/Suggestions'
import { Spinner }           from './components/shared'

const PAGES = {
  dashboard:     Dashboard,
  tasks:         Tasks,
  referrals:     Referrals,
  reviews:       Reviews,
  sales:         Sales,
  'live-leads':  LiveLeads,
  cancellations: Cancellations,
  renewals:      Renewals,
  learning:      Learning,
  profiles:      Profiles,
  suggestions:   Suggestions,
}

// These pages stay mounted once visited so navigating back is instant
const PERSISTENT_PAGES = ['chat', 'dms']

export default function App() {
  const [session,       setSession]       = useState(null)
  const [profile,       setProfile]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [page,          setPage]          = useState('dashboard')
  const [darkMode,      setDarkMode]      = useState(false)
  const [visitedPages,  setVisitedPages]  = useState(() => new Set(['dashboard']))

  // Track visited pages so persistent pages mount on first visit and stay mounted
  useEffect(() => {
    setVisitedPages(prev => new Set([...prev, page]))
  }, [page])

  // ── Auth ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.email)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.email)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Dark mode class on <html> ──────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  async function fetchProfile(email) {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('email', email).single()
    if (error) console.error('[App] Profile fetch error:', error)
    if (data) {
      setProfile(data)
      setDarkMode(data.dark_mode || false)
    }
    setLoading(false)
  }

  async function toggleDarkMode() {
    const next = !darkMode
    setDarkMode(next)
    if (profile?.id) {
      await supabase.from('profiles').update({ dark_mode: next }).eq('id', profile.id)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setPage('dashboard')
    setDarkMode(false)
    setVisitedPages(new Set(['dashboard']))
  }

  // ── Loading screen ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
        <div style={{ color:'#fff', fontSize:18, fontWeight:500 }}>Castro Agency Hub</div>
        <Spinner />
      </div>
    )
  }

  if (!session || !profile) return <Login />

  const PageComponent  = PAGES[page]
  const isPersistent   = PERSISTENT_PAGES.includes(page)

  return (
    <div
      style={{
        display:    'flex',
        height:     '100vh',
        overflow:   'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: 'var(--bg)',
      }}
    >
      <Sidebar
        user={profile}
        page={page}
        setPage={setPage}
        onLogout={handleLogout}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <TopBar
          user={profile}
          page={page}
          setPage={setPage}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />

        <div style={{ flex:1, overflow:'hidden', position:'relative' }}>

          {/* ── Persistent pages: keep mounted, show/hide with CSS ── */}
          {/* Chat */}
          {visitedPages.has('chat') && (
            <div style={{
              display:        page === 'chat' ? 'flex' : 'none',
              flexDirection:  'column',
              height:         '100%',
              overflow:       'hidden',
            }}>
              <ErrorBoundary>
                <Chat user={profile} setPage={setPage} darkMode={darkMode} />
              </ErrorBoundary>
            </div>
          )}

          {/* Direct Messages */}
          {visitedPages.has('dms') && (
            <div style={{
              display:        page === 'dms' ? 'flex' : 'none',
              flexDirection:  'column',
              height:         '100%',
              overflow:       'hidden',
            }}>
              <ErrorBoundary>
                <DirectMessages user={profile} setPage={setPage} darkMode={darkMode} />
              </ErrorBoundary>
            </div>
          )}

          {/* ── Regular pages: mount/unmount normally ── */}
          {!isPersistent && PageComponent && (
            <div style={{ height:'100%', overflow:'auto', background:'var(--bg)' }}>
              <ErrorBoundary key={page}>
                <div className="page-enter">
                  <PageComponent
                    user={profile}
                    setPage={setPage}
                    darkMode={darkMode}
                  />
                </div>
              </ErrorBoundary>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
