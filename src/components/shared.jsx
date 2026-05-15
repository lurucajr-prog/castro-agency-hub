// ============================================================
// Castro Agency Hub — Shared Components v2
// The Redesign. Every component here makes every page better.
// src/components/shared.jsx
// ============================================================
import { useState, useEffect } from 'react'

// ── Brand constants ──────────────────────────────────────────
// N = navy, used for sidebar and brand elements (do not change)
export const N = '#1B3A6B'
export const R = '#C8102E'

// ── Input base styles ────────────────────────────────────────
export const IS = {
  width:        '100%',
  padding:      '8px 11px',
  border:       '1px solid var(--border-2)',
  borderRadius: 8,
  fontSize:     13,
  outline:      'none',
  boxSizing:    'border-box',
  background:   'var(--surface)',
  color:        'var(--text-1)',
  transition:   'border-color 0.15s, box-shadow 0.15s',
  fontFamily:   'inherit',
  lineHeight:   1.5,
}

export const IS_ERR = {
  ...IS,
  border:     '1.5px solid var(--danger)',
  background: 'var(--danger-light)',
}

// ── Card ─────────────────────────────────────────────────────
// Elevated, clean. Shadow makes it float off the page.
export function Card({ children, mb, p, style, onClick, ...props }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: 12,
        padding:      p !== undefined ? p : 16,
        marginBottom: mb || 0,
        boxShadow:    'var(--shadow-sm)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Button ───────────────────────────────────────────────────
// Uses direct DOM event handlers for hover/press -- no useState needed,
// no hook-related issues, and works reliably in all contexts.
export function Btn({ children, onClick, disabled, variant, sm, style, type = 'button', ...props }) {
  const base = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            5,
    padding:        sm ? '5px 12px' : '8px 16px',
    borderRadius:   8,
    fontSize:       sm ? 11 : 13,
    fontWeight:     600,
    cursor:         disabled ? 'not-allowed' : 'pointer',
    opacity:        disabled ? 0.5 : 1,
    transition:     'background 0.15s, box-shadow 0.15s, border-color 0.15s',
    border:         'none',
    flexShrink:     0,
    fontFamily:     'inherit',
    lineHeight:     1,
    ...style,
  }

  if (variant === 'outline') {
    return (
      <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
        style={{ ...base, background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        {...props}>{children}</button>
    )
  }
  if (variant === 'danger') {
    return (
      <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
        style={{ ...base, background: 'var(--danger)', color: '#fff' }}
        onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--danger-hover)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,38,38,0.3)' } }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.boxShadow = 'none' }}
        {...props}>{children}</button>
    )
  }
  if (variant === 'ghost') {
    return (
      <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
        style={{ ...base, background: 'transparent', color: 'var(--text-3)', border: 'none' }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        {...props}>{children}</button>
    )
  }
  // Primary: electric blue with glow on hover
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ ...base, background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--primary-hover)'; e.currentTarget.style.boxShadow = 'var(--shadow-blue)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)' }}
      {...props}>{children}</button>
  )
}

// ── Field / Label wrapper ────────────────────────────────────
export function Field({ label, children, style, error, mb }) {
  return (
    <div style={{ marginBottom: mb !== undefined ? mb : 12, ...style }}>
      {label && (
        <label style={{
          display:       'block',
          fontSize:      11,
          fontWeight:    600,
          color:         'var(--text-4)',
          marginBottom:  5,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {label}
        </label>
      )}
      {children}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}

// ── Chip / badge ─────────────────────────────────────────────
const CHIP_COLORS = {
  'New Lead':       { bg: 'var(--surface-3)',     tx: 'var(--text-2)' },
  'Contacted':      { bg: 'var(--primary-mid)',   tx: '#1e40af' },
  'Quoted':         { bg: 'var(--warning-light)', tx: '#92400e' },
  'Sold':           { bg: 'var(--success-light)', tx: '#166534' },
  'Not Interested': { bg: 'var(--danger-light)',  tx: '#991b1b' },
  'Pending':        { bg: 'var(--surface-3)',     tx: 'var(--text-2)' },
  'Left a Review':  { bg: 'var(--success-light)', tx: '#166534' },
  'Declined':       { bg: 'var(--danger-light)',  tx: '#991b1b' },
  'No Response':    { bg: 'var(--surface-3)',     tx: 'var(--text-3)' },
  'Urgent':         { bg: 'var(--danger-light)',  tx: '#991b1b' },
  'Normal':         { bg: 'var(--primary-light)', tx: '#1e40af' },
  'Low':            { bg: 'var(--surface-3)',     tx: 'var(--text-3)' },
  'Rolled Over':    { bg: 'var(--warning-light)', tx: '#92400e' },
}

export function Chip({ label, style }) {
  const c = CHIP_COLORS[label] || { bg: 'var(--surface-3)', tx: 'var(--text-2)' }
  return (
    <span style={{
      background:   c.bg,
      color:        c.tx,
      padding:      '3px 9px',
      borderRadius: 9999,
      fontSize:     11,
      fontWeight:   600,
      display:      'inline-block',
      whiteSpace:   'nowrap',
      lineHeight:   1.4,
      ...style,
    }}>
      {label}
    </span>
  )
}

// ── Spinner ──────────────────────────────────────────────────
export function Spinner({ size = 30, padding = 48 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding }}>
      <div style={{
        width:          size,
        height:         size,
        border:         `3px solid #d1d9e6`,
        borderTopColor: 'var(--primary)',
        borderRadius:   '50%',
        animation:      'spin 0.65s linear infinite',
      }} />
    </div>
  )
}

// ── EmptyState ───────────────────────────────────────────────
export function EmptyState({ text, icon = '📭', action, onAction }) {
  return (
    <div style={{ padding: '52px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 42, marginBottom: 12, opacity: 0.35, filter: 'grayscale(0.3)' }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginBottom: action ? 14 : 0, lineHeight: 1.6 }}>{text}</div>
      {action && onAction && <Btn sm onClick={onAction}>{action}</Btn>}
    </div>
  )
}

// ── Skeleton components ──────────────────────────────────────
export function SkeletonLine({ w = '100%', h = 13, mb = 8 }) {
  return <div className="skeleton" style={{ width: w, height: h, marginBottom: mb, borderRadius: 5 }} />
}

export function SkeletonCard({ lines = 3, mb = 12 }) {
  return (
    <Card mb={mb}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} w={i === 0 ? '55%' : i === lines - 1 ? '35%' : '100%'} mb={i === lines - 1 ? 0 : 10} />
      ))}
    </Card>
  )
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <Card p={0}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
        {['30%','20%','15%','20%'].map((w, i) => <SkeletonLine key={i} w={w} h={10} mb={0} />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '12px 14px', borderBottom: i < rows - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          {['25%','18%','12%','18%','10%'].map((w, j) => <SkeletonLine key={j} w={w} h={12} mb={0} />)}
        </div>
      ))}
    </Card>
  )
}

// ── Modal ────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 520 }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'rgba(10,20,40,0.55)',
      backdropFilter: 'blur(3px)',
      zIndex:     1000,
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding:    20,
    }}>
      <div style={{
        background:    'var(--surface)',
        borderRadius:  16,
        width:         '100%',
        maxWidth:      width,
        maxHeight:     '90vh',
        display:       'flex',
        flexDirection: 'column',
        boxShadow:     'var(--shadow-xl)',
        border:        '1px solid var(--border)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{ border: '1.5px solid var(--border-2)', background: 'var(--surface-2)', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: 'var(--text-1)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontWeight: 400, flexShrink: 0, transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-light)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}
          >×</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── ConfirmModal ─────────────────────────────────────────────
export function ConfirmModal({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>{title}</div>
          {message && <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>{message}</div>}
        </div>
        <div style={{ padding: '12px 22px 20px', display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant={danger ? 'danger' : undefined} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────
export function Toast({ emoji, title, subtitle, borderColor, onDone, duration = 3500 }) {
  useEffect(() => { const t = setTimeout(onDone, duration); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: `2px solid ${borderColor || 'var(--primary)'}`, borderRadius: 18, padding: '18px 32px', zIndex: 9998, textAlign: 'center', boxShadow: 'var(--shadow-lg)', animation: 'toastIn 0.4s ease', minWidth: 260 }}>
      {emoji && <div style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</div>}
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{subtitle}</div>}
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────
export function StatCard({ label, value, color, icon, trend, trendLabel }) {
  const trendUp   = trend > 0
  const trendDown = trend < 0
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
        {icon && <div style={{ fontSize: 20, opacity: 0.6 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--text-1)', letterSpacing: -0.5, marginBottom: 4 }}>{value}</div>
      {trend !== undefined && (
        <div style={{ fontSize: 11, fontWeight: 600, color: trendUp ? 'var(--success)' : trendDown ? 'var(--danger)' : 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
          {trendUp ? '▲' : trendDown ? '▼' : '—'}
          <span>{trendLabel || (Math.abs(trend) + '%')}</span>
        </div>
      )}
    </div>
  )
}

// ── Section header ───────────────────────────────────────────
export function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div>}
      </div>
      {action && onAction && <Btn variant="outline" sm onClick={onAction}>{action}</Btn>}
    </div>
  )
}

// ── TH — table header cell ───────────────────────────────────
export function TH({ children, right, style }) {
  return (
    <th style={{ padding: '9px 12px', textAlign: right ? 'right' : 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, background: 'var(--surface-2)', ...style }}>
      {children}
    </th>
  )
}

// ── Divider ──────────────────────────────────────────────────
export function Divider({ my = 12 }) {
  return <div style={{ height: 1, background: 'var(--border)', margin: `${my}px 0` }} />
}

// ── TabBar ───────────────────────────────────────────────────
export function TabBar({ tabs, active, setActive }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => setActive(t)} style={{ padding: '9px 16px', border: 'none', borderBottom: active === t ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: active === t ? 700 : 400, color: active === t ? 'var(--primary)' : 'var(--text-3)', whiteSpace: 'nowrap', marginBottom: -1, transition: 'color 0.15s, border-color 0.15s', fontFamily: 'inherit' }}>
          {t}
        </button>
      ))}
    </div>
  )
}

// ── pct — percentage helper ───────────────────────────────────
export function pct(val, max) {
  if (!max || max <= 0) return 0
  return Math.min(100, Math.round((val / max) * 100))
}

// ── pcol — progress color ─────────────────────────────────────
export function pcol(val, max) {
  const p = pct(val, max)
  if (p >= 100) return '#166534'
  if (p >= 80)  return '#16a34a'
  if (p >= 50)  return '#d97706'
  return '#dc2626'
}

// ── MiniBar — inline progress bar ────────────────────────────
export function MiniBar({ val, max }) {
  const p     = pct(val, max)
  const color = pcol(val, max)
  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 3 }}>{max > 0 ? `${val}/${max}` : val}</div>
      <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 99, transition: 'width 0.45s ease' }} />
      </div>
    </div>
  )
}
