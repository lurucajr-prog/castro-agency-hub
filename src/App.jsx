// ============================================================
// Castro Agency Hub — App Entry (Auto-Diagnostic & Self-Healing Shell)
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
  
  // Real-time troubleshooting diagnosis telemetry hooks
  const [debugStatus,  setDebugStatus]  = useState('Initializing security layer...')
  const [debugError,   setDebugError]   = useState(null)

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

  // Securely load profile row with comprehensive diagnostic exception tracking
  async function loadProfile(emailStr) {
    if (!emailStr) {
      setDebugError('No authenticated email address resolved from your active login.')
      setLoading(false)
      return
    }
    
    const cleanEmail = emailStr.toLowerCase().trim()
    setDebugStatus(`Verifying database profile authorization for ${cleanEmail}...`)
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle()

      if (error) {
        console.error("Database connection exception:", error)
        setDebugError(`Database Error: ${error.message || 'Row retrieval constraint violation.'} (Check your Supabase policies)`)
        return
      }

      if (!data) {
        console.warn(`Account profile lookup miss: ${cleanEmail}`)
        setDebugError(`Account mismatch: '${cleanEmail}' successfully authenticated with Supabase, but no corresponding staff role entry exists inside your 'profiles' database table. Double-check your user management spellings!`)
        return
      }

      setProfile(data)
      setDarkMode(data.dark_mode === true)
      setDebugError(null)
    } catch (err) {
      console.error("Critical execution catch block:", err)
      setDebugError(`System Crash: ${err.message || 'An unexpected execution panic occurred.'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function initializeAuthSession() {
      try {
        setDebugStatus('Scanning for active browser credentials...')
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
        console.error("Auth session tracking initialization failure:", err)
        if (isMounted) {
          setDebugError(`Auth Error: ${err.message || 'Failed to successfully negotiate secure handshake with database.'}`)
          setLoading(false)
        }
      }
    }

    initializeAuthSession()

    // Listen for real-time authentication state disruptions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return
      setSession(currentSession)
      
      if (currentSession?.user?.email) {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setLoading(true)
          await loadProfile(currentSession.user.email)
        }
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
    try {
      setLoading(true)
      setDebugStatus('De-authenticating cookies and resetting configuration context...')
      await supabase.auth.signOut()
    } catch (err) {
      console.error(err)
    } finally {
      setSession(null)
      setProfile(null)
      setPage('dashboard')
      setDarkMode(false)
      setDmTarget(null)
      setVisitedPages(new Set(['dashboard']))
      setDebugError(null)
      setLoading(false)
    }
  }

  function openDm(profileId) {
    setDmTarget(profileId)
    setPage('dms')
  }

  // ── Smart Diagnostic Loader Shell ───────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#1B3A6B', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, padding:24, fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ color:'#fff', fontSize:22, fontWeight:600, letterSpacing:-0.5 }}>Castro Agency Hub</div>
        
        {!debugError ? (
          <>
            <Spinner />
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>{debugStatus}</div>
          </>
        ) : (
          <div style={{ background:'rgba(255,255,255,0.98)', borderRadius:14, padding:28, maxWidth:460, width:'100%', boxShadow:'0 20px 40px rgba(0,0,0,0.4)', textAlign:'center', animation:'page-enter 0.3s ease' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>⚙️</div>
            <div style={{ color:'#111', fontSize:18, fontWeight:700, marginBottom:8 }}>Portal Troubleshooting Interface</div>
            <div style={{ color:'#4b5563', fontSize:13, lineHeight:1.6, marginBottom:22, textAlign:'left', background:'#f3f4f6', padding:14, borderRadius:8, borderLeft:'4px solid #dc2626', wordBreak:'break-word', fontFamily:'monospace' }}>
              {debugError}
            </div>
            <button onClick={handleLogout} style={{ background:'#c8102e', color:'#fff', border:'none', borderRadius:9, padding:'12px 20px', fontSize:14, fontWeight:700, cursor:'pointer', width:'100%', boxShadow:'0 4px 12px rgba(200,16,46,0.3)', transition:'opacity 0.2s' }}>
              Disconnect & Reset Session
            </button>
          </div>
        )}
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

          {/* ── Persistent pages ── */}
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

          {/* ── Regular pages ── */}
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
