import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { R } from './shared'

// Castro Agency office photo — upload this to Supabase storage bucket "public-assets"
// and replace the URL below with the public URL
const OFFICE_PHOTO = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Incorrect email or password. Try again.'); setLoading(false) }
  }

  const IS = {
    width: '100%', fontSize: 14, padding: '11px 14px',
    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 9,
    background: 'rgba(255,255,255,0.12)', color: '#fff',
    outline: 'none', backdropFilter: 'blur(4px)',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Left — photo panel */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'flex-end',
      }}>
        <img
          src={OFFICE_PHOTO}
          alt="Castro Agency office"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,25,50,0.85) 0%, rgba(10,25,50,0.3) 50%, rgba(10,25,50,0.15) 100%)' }} />
        {/* Bottom text */}
        <div style={{ position: 'relative', padding: '32px 36px', zIndex: 1 }}>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>Castro Agency</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.5 }}>Allstate Insurance · Countryside, IL<br />708-352-7300</div>
        </div>
      </div>

      {/* Right — login panel */}
      <div style={{
        width: 420, background: '#1B3A6B', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '48px 40px',
        position: 'relative',
      }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, background: R,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 22, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 16px rgba(200,16,46,0.4)',
          }}>CA</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Welcome back</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Sign in to Castro Agency Hub</div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              style={IS}
              autoComplete="email"
            />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={IS}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(200,16,46,0.2)', border: '1px solid rgba(200,16,46,0.4)',
              borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#fca5a5', marginBottom: 16,
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px 0', background: R, color: '#fff',
              border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1,
              boxShadow: '0 4px 12px rgba(200,16,46,0.35)',
              transition: 'opacity 0.15s',
            }}
          >{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <div style={{ marginTop: 24, color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
          Need help signing in?<br />Contact your office manager.
        </div>

        {/* Allstate badge */}
        <div style={{
          position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center',
          color: 'rgba(255,255,255,0.2)', fontSize: 11,
        }}>Powered by Allstate · You're in good hands.</div>
      </div>
    </div>
  )
}
