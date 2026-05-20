// ============================================================
// Castro Agency Hub — App Entry (Robust Routing Shell)
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
import AdminSettings         from './components/AdminSettings'
import AuditLog              from './components/AuditLog'
import NotificationHistory   from './components/NotificationHistory'
import { Spinner }           from './components/shared'

const PAGES = {
  dashboard:                Dashboard,
  tasks:                    Tasks,
  referrals:                Referrals,
  reviews:                  Reviews,
  sales:                    Sales,
  'live-leads':             LiveLeads,
  cancellations:            Cancellations,
  renewals:                 Renewals,
  learning:                 Learning,
  profiles:                 Profiles,
  suggestions:              Suggestions,
  settings:                 AdminSettings,
  'audit-log':              AuditLog,
  'notification-history':   NotificationHistory,
}

const PERSISTENT_PAGES = ['chat', 'dms']

export default function App() {
  const [session,      setSession]      = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [page,         setPage]         = useState('dashboard')
  const [loading,      setLoading]      = useState(true)
  const [darkMode,     setDarkMode]     = useState(false)
  const [dmTarget,     setDmTarget]     = useState(null)
  const [visitedPages, setVisitedPages] = useState(new Set(['dashboard']))

  // Track visited persistent pages so they stay mounted
  useEffect(() => {
    if (PERSISTENT_PAGES.includes(page)) {
      setVisitedPages(prev => new Set([...prev, page]))
    }
  }, [page])

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else          document.documentElement.classList.remove('dark')
  }, [darkMode])

  // Securely load profile row with strict exception safety
  async function loadProfile(email) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (error) {
        console.error("Profile matching error details:", error)
      }
      if (data) {
        setProfile(data)
        setDarkMode(data.dark_mode === true)
      }
    } catch (err) {
      console.error("Critical error in loadProfile handler:", err)
    } finally {
      // Guaranteed to execute even if query fails completely
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (!isMounted) return
        setSession(session)

        if (session?.user?.email) {
          await loadProfile(session.user.email)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error("Auth session initialization failed:", err)
        if (isMounted) setLoading(false)
      }
    }

    initializeAuth()

    // Listen for real-time authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return
      setSession(currentSession)
      
      if (currentSession?.user?.email) {
        setLoading(true)
        await loadProfile(currentSession.user.email)
      } else {
        setProfile(null)
        setDarkMode(false)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  async function toggleDarkMode() {
    const next = !darkMode
    setDarkMode(next)
    if (profile) {
      await supabase.from('profiles').update({ dark_mode: next }).eq('id', profile.id)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setPage('dashboard')
    setDarkMode(false)
    setDmTarget(null)
    setVisitedPages(new Set(['dashboard']))
  }

  function openDm(profileId) {
    setDmTarget(profileId)
    setPage('dms')
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

  // If session failed or profile row wasn't found, drop back to login cleanly
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
            <div style={{ display: page === 'chat' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <ErrorBoundary>
                <Chat user={profile} setPage={setPage} darkMode={darkMode} />
              </ErrorBoundary>
            </div>
          )}

          {/* Direct Messages */}
          {visitedPages.has('dms') && (
            <div style={{ display: page === 'dms' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <ErrorBoundary>
                <DirectMessages
                  user={profile}
                  setPage={setPage}
                  darkMode={darkMode}
                  dmTarget={dmTarget}
                  onDmTargetConsumed={() => setDmTarget(null)}
                />
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
                    openDm={openDm}
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
