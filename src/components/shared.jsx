export const N = '#1B3A6B'
export const R = '#C8102E'

export const CHIP_COLORS = {
  'New Lead':      { bg: '#EEEDFE', tx: '#3C3489' },
  'Contacted':     { bg: '#FAEEDA', tx: '#633806' },
  'Quoted':        { bg: '#E6F1FB', tx: '#0C447C' },
  'Sold':          { bg: '#EAF3DE', tx: '#27500A' },
  'Lost':          { bg: '#FCEBEB', tx: '#791F1F' },
  'Left a Review': { bg: '#EAF3DE', tx: '#27500A' },
  'Pending':       { bg: '#FAEEDA', tx: '#633806' },
  'Declined':      { bg: '#FCEBEB', tx: '#791F1F' },
  'No Response':   { bg: '#F1EFE8', tx: '#5F5E5A' },
  'Urgent':        { bg: '#FCEBEB', tx: '#791F1F' },
  'Normal':        { bg: '#E6F1FB', tx: '#0C447C' },
  'Low':           { bg: '#F1EFE8', tx: '#5F5E5A' },
  'Rolled Over':   { bg: '#FAEEDA', tx: '#633806' },
  'Auto':          { bg: '#E6F1FB', tx: '#0C447C' },
  'Home':          { bg: '#EAF3DE', tx: '#27500A' },
  'Life':          { bg: '#EEEDFE', tx: '#3C3489' },
  'Other':         { bg: '#F1EFE8', tx: '#5F5E5A' },
}

export const IS = {
  width: '100%', fontSize: 13, padding: '7px 10px',
  border: '1px solid #d1d5db', borderRadius: 6,
  background: '#fff', color: '#111', outline: 'none',
}

export function Chip({ label }) {
  const s = CHIP_COLORS[label] || { bg: '#F1EFE8', tx: '#5F5E5A' }
  return (
    <span style={{
      background: s.bg, color: s.tx,
      padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 500,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

export function Card({ children, p = 16, mb = 0, style: st = {} }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 10, padding: p, marginBottom: mb, ...st,
    }}>{children}</div>
  )
}

export function Btn({ children, variant = 'primary', sm = false, style: st = {}, ...props }) {
  const base = {
    cursor: 'pointer', borderRadius: 6, fontWeight: 500,
    fontSize: sm ? 11 : 13,
    padding: sm ? '4px 10px' : '7px 14px',
    display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none',
  }
  const vs = {
    primary: { background: N, color: '#fff' },
    outline:  { background: 'transparent', color: N, border: `1px solid ${N}` },
    ghost:    { background: 'transparent', color: '#6b7280' },
    danger:   { background: R, color: '#fff' },
  }
  return <button {...props} style={{ ...base, ...vs[variant], ...st }}>{children}</button>
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 11 }}>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>{label}</label>}
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, width = 440 }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,29,53,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 1000, paddingTop: 60,
      }}
    >
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, width, maxWidth: '92vw', maxHeight: '80vh', overflow: 'auto',
      }}>
        <div style={{
          padding: '13px 18px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  )
}

export function TabBar({ tabs, active, setActive }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 15 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => setActive(t)} style={{
          padding: '7px 13px', border: 'none',
          borderBottom: active === t ? `2px solid ${N}` : '2px solid transparent',
          background: 'none', cursor: 'pointer', fontSize: 12,
          fontWeight: active === t ? 500 : 400,
          color: active === t ? '#111' : '#6b7280',
          marginBottom: -1,
        }}>{t}</button>
      ))}
    </div>
  )
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{title}</span>
      {action && <Btn variant="ghost" sm onClick={onAction} style={{ fontSize: 11 }}>{action} →</Btn>}
    </div>
  )
}

export function pct(v, m) { return m ? Math.min(100, Math.round(v / m * 100)) : 0 }
export function pcol(v, m) {
  const p = pct(v, m)
  return p >= 80 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'
}

export function MiniBar({ val, max }) {
  return (
    <div>
      <div style={{ height: 3, background: '#f3f4f6', borderRadius: 99, marginBottom: 2 }}>
        <div style={{ width: pct(val, max) + '%', height: '100%', background: pcol(val, max), borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 10, color: '#9ca3af' }}>{val} / {max}</span>
    </div>
  )
}

export function Avatar({ ini, isAdmin, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: isAdmin ? R : '#dbeafe',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 500,
      color: isAdmin ? '#fff' : '#1e40af', flexShrink: 0,
    }}>{ini}</div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 24, height: 24, border: `2px solid ${N}`,
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function EmptyState({ text }) {
  return <div style={{ padding: 28, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{text}</div>
}
