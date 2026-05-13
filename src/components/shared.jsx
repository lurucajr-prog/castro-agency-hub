// ============================================================
// Castro Agency Hub — Shared Components
// Place this file at: src/components/shared.jsx
// ============================================================
import { useState, useEffect } from 'react'

// ── Brand color constants (kept for backward compatibility) ──
export const N = '#1B3A6B'  // navy — use var(--primary) in new code
export const R = '#C8102E'  // red  — use var(--danger) in new code

// ── Input base style ─────────────────────────────────────────
export const IS = {
  width:          '100%',
  padding:        '8px 10px',
  border:         '1px solid var(--border-2)',
  borderRadius:   7,
  fontSize:       13,
  outline:        'none',
  boxSizing:      'border-box',
  background:     'var(--surface)',
  color:          'var(--text-1)',
  transition:     'border-color 0.15s, box-shadow 0.15s',
  fontFamily:     'inherit',
}

// Input style for error state
export const IS_ERR = {
  ...IS,
  border:     '1px solid var(--danger)',
  background: 'var(--danger-light)',
}

// ── Card ─────────────────────────────────────────────────────
export function Card({ children, mb, p, style, onClick, ...props }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: 10,
        padding:      p !== undefined ? p : 14,
        marginBottom: mb || 0,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Button ───────────────────────────────────────────────────
export function Btn({ children, onClick, disabled, variant, sm, style, type = 'button', ...props }) {
  const base = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            5,
    padding:        sm ? '4px 11px' : '8px 15px',
    borderRadius:   7,
    fontSize:       sm ? 11 : 13,
    fontWeight:     500,
    cursor:         disabled ? 'not-allowed' : 'pointer',
    opacity:        disabled ? 0.55 : 1,
    transition:     'background 0.15s, opacity 0.15s, border-color 0.15s',
    border:         'none',
    flexShrink:     0,
    fontFamily:     'inherit',
    ...style,
  }

  if (variant === 'outline') {
    return (
      <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--text-2)' }} {...props}>
        {children}
      </button>
    )
  }
  if (variant === 'danger') {
    return (
      <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, background: 'var(--danger)', color: '#fff' }} {...props}>
        {children}
      </button>
    )
  }
  if (variant === 'ghost') {
    return (
      <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, background: 'transparent', color: 'var(--text-3)', border: 'none' }} {...props}>
        {children}
      </button>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, background: 'var(--primary)', color: '#fff' }} {...props}>
      {children}
    </button>
  )
}

// ── Label / Field wrapper ────────────────────────────────────
export function Field({ label, children, style, error, mb }) {
  return (
    <div style={{ marginBottom: mb !== undefined ? mb : 12, ...style }}>
      {label && (
        <label style={{
          display:       'block',
          fontSize:      11,
          fontWeight:    500,
          color:         'var(--text-4)',
          marginBottom:  4,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}>
          {label}
        </label>
      )}
      {children}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3, fontWeight: 500 }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── Chip / badge ─────────────────────────────────────────────
const CHIP_COLORS = {
  // Referral statuses
  'New Lead':       { bg: 'var(--surface-3)', tx: 'var(--text-2)' },
  'Contacted':      { bg: 'var(--primary-mid)', tx: '#1e40af' },
  'Quoted':         { bg: 'var(--warning-light)', tx: '#92400e' },
  'Sold':           { bg: 'var(--success-light)', tx: '#166534' },
  'Not Interested': { bg: 'var(--danger-light)', tx: '#991b1b' },
  // Review statuses
  'Pending':        { bg: 'var(--surface-3)', tx: 'var(--text-2)' },
  'Left a Review':  { bg: 'var(--success-light)', tx: '#166534' },
  'Declined':       { bg: 'var(--danger-light)', tx: '#991b1b' },
  'No Response':    { bg: 'var(--surface-3)', tx: 'var(--text-3)' },
  // Tasks
  'Complete':       { bg: 'var(--success-light)', tx: '#166534' },
  'In Progress':    { bg: 'var(--warning-light)', tx: '#92400e' },
  'Overdue':        { bg: 'var(--danger-light)', tx: '#991b1b' },
}

export function Chip({ label, style }) {
  const c = CHIP_COLORS[label] || { bg: 'var(--surface-3)', tx: 'var(--text-2)' }
  return (
    <span style={{
      background:   c.bg,
      color:        c.tx,
      padding:      '2px 9px',
      borderRadius: 99,
      fontSize:     11,
      fontWeight:   500,
      display:      'inline-block',
      whiteSpace:   'nowrap',
      ...style,
    }}>
      {label}
    </span>
  )
}

// ── Spinner ──────────────────────────────────────────────────
export function Spinner({ size = 32, padding = 48 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding }}>
      <div style={{
        width:       size,
        height:      size,
        border:      '3px solid var(--border)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation:   'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

// ── EmptyState ───────────────────────────────────────────────
export function EmptyState({ text, icon = '📭', action, onAction }) {
  return (
    <div style={{ padding: '44px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 38, marginBottom: 10, opacity: 0.45 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: action ? 14 : 0, lineHeight: 1.5 }}>
        {text}
      </div>
      {action && onAction && (
        <Btn sm onClick={onAction}>{action}</Btn>
      )}
    </div>
  )
}

// ── Skeleton components ──────────────────────────────────────
export function SkeletonLine({ w = '100%', h = 13, mb = 8 }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, marginBottom: mb, borderRadius: 4 }}
    />
  )
}

export function SkeletonCard({ lines = 3, mb = 12 }) {
  return (
    <Card mb={mb}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          w={i === 0 ? '55%' : i === lines - 1 ? '35%' : '100%'}
          mb={i === lines - 1 ? 0 : 9}
        />
      ))}
    </Card>
  )
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <Card p={0}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
        {['30%','20%','15%','20%'].map((w, i) => (
          <SkeletonLine key={i} w={w} h={10} mb={0} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '12px 14px', borderBottom: i < rows - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
          {['25%','18%','12%','18%','10%'].map((w, j) => (
            <SkeletonLine key={j} w={w} h={12} mb={0} />
          ))}
        </div>
      ))}
    </Card>
  )
}

// ── Modal ────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 520 }) {
  // ESC key closes modal
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'rgba(0,0,0,0.5)',
      zIndex:     1000,
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding:    20,
    }}>
      <div style={{
        background:    'var(--surface)',
        borderRadius:  14,
        width:         '100%',
        maxWidth:      width,
        maxHeight:     '90vh',
        display:       'flex',
        flexDirection: 'column',
        boxShadow:     'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          padding:        '16px 20px',
          borderBottom:   '1px solid var(--border)',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          flexShrink:     0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              border:     'none',
              background: 'none',
              fontSize:   22,
              cursor:     'pointer',
              color:      'var(--text-4)',
              lineHeight: 1,
              padding:    '0 2px',
            }}
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── ConfirmModal — replaces window.confirm() ─────────────────
export function ConfirmModal({
  title    = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  onConfirm,
  onCancel,
  danger   = false,
}) {
  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      background: 'rgba(0,0,0,0.5)',
      zIndex:     2000,
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding:    20,
    }}>
      <div style={{
        background:   'var(--surface)',
        borderRadius: 14,
        padding:      '24px 24px 20px',
        maxWidth:     380,
        width:        '100%',
        boxShadow:    'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22, lineHeight: 1.6 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" onClick={onCancel}>{cancelLabel}</Btn>
          <Btn variant={danger ? 'danger' : undefined} onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────
export function Toast({ emoji, title, subtitle, borderColor, onDone, duration = 3500 }) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      position:     'fixed',
      top:          80,
      left:         '50%',
      transform:    'translateX(-50%)',
      background:   'var(--surface)',
      border:       `2px solid ${borderColor || 'var(--primary)'}`,
      borderRadius: 16,
      padding:      '18px 32px',
      zIndex:       9998,
      textAlign:    'center',
      boxShadow:    'var(--shadow-lg)',
      animation:    'toastIn 0.4s ease',
      minWidth:     260,
    }}>
      {emoji && <div style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</div>}
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{subtitle}</div>}
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────
export function StatCard({ label, value, color, icon, trend, trendLabel }) {
  const trendUp = trend > 0
  const trendDown = trend < 0

  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border)',
      borderRadius: 10,
      padding:      '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </div>
        {icon && <div style={{ fontSize: 18, opacity: 0.7 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--text-1)', margin: '6px 0 4px' }}>
        {value}
      </div>
      {trend !== undefined && (
        <div style={{
          fontSize: 11,
          fontWeight: 500,
          color: trendUp ? 'var(--success)' : trendDown ? 'var(--danger)' : 'var(--text-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div>}
      </div>
      {action && onAction && (
        <Btn variant="outline" sm onClick={onAction}>{action}</Btn>
      )}
    </div>
  )
}

// ── Table header cell helper ─────────────────────────────────
export function TH({ children, right, style }) {
  return (
    <th style={{
      padding:       '8px 12px',
      textAlign:     right ? 'right' : 'left',
      fontSize:      10,
      fontWeight:    500,
      color:         'var(--text-4)',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      background:    'var(--surface-2)',
      ...style,
    }}>
      {children}
    </th>
  )
}

// ── Divider ──────────────────────────────────────────────────
export function Divider({ my = 12 }) {
  return (
    <div style={{
      height:     1,
      background: 'var(--border)',
      margin:     `${my}px 0`,
    }} />
  )
}
