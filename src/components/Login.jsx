import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Btn } from './shared'

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
    width: '100%', fontSize: 14, padding: '10px 13px',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
    background: 'rgba(255,255,255,0.1)', color: '#fff', outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh', background: N,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: R,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px', fontSize: 22, fontWeight: 700, color: '#fff',
        }}>CA</div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Castro Agency Hub</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Sign in to your account</div>
      </div>

      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={IS}
            autoComplete="email"
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>Password</label>
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
          <div style={{ background: 'rgba(200,16,46,0.2)', border: '1px solid rgba(200,16,46,0.4)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#fca5a5', marginBottom: 14 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '11px 0', background: R, color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>

      <div style={{ marginTop: 20, color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center' }}>
        Contact your office manager if you need help signing in.
      </div>
    </div>
  )
}
