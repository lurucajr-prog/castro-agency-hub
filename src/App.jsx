// ============================================================
// Castro Agency Hub — App Entry (Concurrence-Safe Production Shell)
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
  const [debugStatus,  setDebugStatus]  = useState('Initializing verification trackers...')

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

  // Single consolidated profile loader
  async function loadProfileData(emailStr) {
    if (!emailStr) {
      setLoading(false)
      return
    }
    const cleanEmail = emailStr.toLowerCase().trim()
    setDebugStatus(`Verifying role clearance for ${cleanEmail}...`)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle()

      if (error) {
        console.error("Profile loading mismatch exception:", error)
        setDebugStatus(`Database link error: ${error.message}`)
        return
      }

      if (data) {
        setProfile(data)
        setDarkMode(data.dark_mode === true)
      }
    } catch (err) {
      console.error("Profile compilation crash caught:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    // Step 1: Query for an existing local browser session immediately on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      if (session) {
        setSession(session)
        loadProfileData(session.user.email)
      } else {
        setLoading(false)
      }
    }).catch(err => {
      console.error("Authentication track error:", err)
      if (isMounted) setLoading(false)
    })

    // Step 2: Establish a clean background listener for subsequent sign-in/sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return
      
      if (event === 'SIGNED_IN') {
        setSession(currentSession)
        if (currentSession?.user?.email) {
          setLoading(true)
          loadProfileData(currentSession.user.email)
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
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
    setLoading(true)
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setPage('dashboard')
    setDarkMode(false)
    setDmTarget(null)
    setVisitedPages(new Set(['dashboard']))
    setLoading(false)
  }

  function openDm(profileId) {
    setDmTarget(profileId)
    setPage('dms')
  }

  // ── Render Track 1: Loading ──
  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:24, fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ color:'#fff', fontSize:22, fontWeight:600, letterSpacing:-0.5 }}>Castro Agency Hub</div>
        <Spinner />
        <div style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>{debugStatus}</div>
      </div>
    )
  }

  // ── Render Track 2: Safe Account Recovery (Handles missing database profiles without freezing) ──
  if (session && !profile) {
    return (
      <div style={{ minHeight:'100vh', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:24, fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ background:'#fff', color:'#111', padding:32, borderRadius:14, maxWidth:450, width:'100%', textAlign:'center', boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>⚠️</div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:8, color:'#111' }}>Staff Profile Unresolved</div>
          <div style={{ fontSize:13, color:'#4b5563', lineHeight:1.6, marginBottom:22, textAlign:'left' }}>
            You have authenticated successfully as <strong>{session.user.email}</strong>, but this email address has not been added to your database's <code>profiles</code> table yet. 
            <br /><br />
            An administrator needs to register this exact email address in the database so the interface can map your tracking targets.
          </div>
          <button onClick={handleLogout} style={{ background:'#c8102e', color:'#fff', border:'none', borderRadius:9, padding:'12px 20px', fontSize:14, fontWeight:700, cursor:'pointer', width:'100%', boxShadow:'0 4px 12px rgba(200,16,46,0.25)' }}>
            Return to Sign In
          </button>
        </div>
      </div>
    )
  }

  // ── Render Track 3: Standard Form Routing ──
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
          {/* Chat Panel */}
          {visitedPages.has('chat') && (
            <div style={{ display: page === 'chat' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <ErrorBoundary>
                <Chat user={profile} setPage={setPage} darkMode={darkMode} />
              </ErrorBoundary>
            </div>
          )}

          {/* DM Panel */}
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

          {/* Standard Page Panels */}
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
