import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Tasks from './components/Tasks'
import Referrals from './components/Referrals'
import Reviews from './components/Reviews'
import Sales from './components/Sales'
import Cancellations from './components/Cancellations'
import Renewals from './components/Renewals'
import Chat from './components/Chat'
import { N, Spinner } from './components/shared'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

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

  async function fetchProfile(email) {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()
    if (error) console.error('Profile fetch error:', error)
    setProfile(data)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setPage('dashboard')
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: N,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 500 }}>Castro Agency Hub</div>
        <Spinner />
      </div>
    )
  }

  if (!session || !profile) return <Login />

  const pages = {
    dashboard:     Dashboard,
    tasks:         Tasks,
    referrals:     Referrals,
    reviews:       Reviews,
    sales:         Sales,
    cancellations: Cancellations,
    renewals:      Renewals,
    chat:          Chat,
  }
  const PageComponent = pages[page] || Dashboard

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <Sidebar user={profile} page={page} setPage={setPage} onLogout={handleLogout} />
      <div style={{ flex: 1, overflow: 'auto', background: '#f9fafb' }}>
        <PageComponent user={profile} setPage={setPage} />
      </div>
    </div>
  )
}
