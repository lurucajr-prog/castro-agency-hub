import { N, R } from './shared'

const NAV = [
  { id: 'dashboard',     label: 'Dashboard',    icon: '◉' },
  { id: 'tasks',         label: 'Tasks',         icon: '☑' },
  { id: 'referrals',     label: 'Referrals',     icon: '↗' },
  { id: 'reviews',       label: 'Reviews',       icon: '★' },
  { id: 'sales',         label: 'Sales',         icon: '$' },
  { id: 'cancellations', label: 'Cancellations', icon: '⚠' },
  { id: 'renewals',      label: 'Renewals',      icon: '↻' },
  { id: 'practice',      label: 'Practice',      icon: '🎯' },
  { id: 'chat',          label: 'Team chat',     icon: '◎' },
]

export default function Sidebar({ user, page, setPage, onLogout }) {
  return (
    <div style={{ width: 165, background: N, display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh' }}>
      <div style={{ padding: '15px 13px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Castro Agency</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>Office hub</div>
      </div>

      <nav style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
        {NAV.map(n => {
          const active = page === n.id
          return (
            <div
              key={n.id}
              onClick={() => setPage(n.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 1,
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 12, fontWeight: active ? 500 : 400,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 13 }}>{n.icon}</span>
              {n.label}
            </div>
          )
        })}
      </nav>

      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: user.role === 'admin' ? R : 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 600, color: '#fff', flexShrink: 0,
          }}>{user.ini}</div>
          <div>
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>{user.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{user.title}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            color: 'rgba(255,255,255,0.45)', fontSize: 11, padding: '4px 0', cursor: 'pointer',
          }}
        >Sign out</button>
      </div>
    </div>
  )
}
