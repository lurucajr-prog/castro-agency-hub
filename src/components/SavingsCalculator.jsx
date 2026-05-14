import { useState } from 'react'
import { N } from './shared'

// ── Formatters ───────────────────────────────────────────────
const fmt     = n => n ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
const savColor = n => n > 0 ? '#166534' : n < 0 ? '#991b1b' : '#6b7280'

// ── Tab config ────────────────────────────────────────────────
const TABS = [
  { id: 'common',  label: '⭐ Most Common',  desc: 'Auto monthly · Home through escrow' },
  { id: 'monthly', label: 'Both Monthly',    desc: 'Auto & Home paid monthly' },
  { id: 'annual',  label: 'Both Annual',     desc: 'Auto & Home paid annually' },
]

// ── Calc functions ────────────────────────────────────────────

// Most Common: auto monthly, home annual (escrow)
function calcCommon(v) {
  const ca = Number(v.currAuto) || 0  // current auto monthly
  const ch = Number(v.currHome) || 0  // current home annual
  const aa = Number(v.allAuto)  || 0  // allstate auto monthly
  const ah = Number(v.allHome)  || 0  // allstate home annual
  const autoSavYear  = (ca - aa) * 12
  const homeSavYear  = ch - ah
  const totalSavYear = autoSavYear + homeSavYear
  const totalCurrY   = ca * 12 + ch
  const totalAllY    = aa * 12 + ah
  return { ca, ch, aa, ah, autoSavYear, homeSavYear, totalSavYear, totalCurrY, totalAllY }
}

// Both Monthly
function calcMonthly(v) {
  const ca = Number(v.currAuto) || 0
  const ch = Number(v.currHome) || 0
  const aa = Number(v.allAuto)  || 0
  const ah = Number(v.allHome)  || 0
  const autoSavMo    = ca - aa
  const homeSavMo    = ch - ah
  const totalSavMo   = autoSavMo + homeSavMo
  const totalSavYear = totalSavMo * 12
  const totalCurrY   = (ca + ch) * 12
  const totalAllY    = (aa + ah) * 12
  return { ca, ch, aa, ah, autoSavMo, homeSavMo, totalSavMo, totalSavYear, totalCurrY, totalAllY }
}

// Both Annual
function calcAnnual(v) {
  const ca = Number(v.currAuto) || 0
  const ch = Number(v.currHome) || 0
  const aa = Number(v.allAuto)  || 0
  const ah = Number(v.allHome)  || 0
  const autoSavYear  = ca - aa
  const homeSavYear  = ch - ah
  const totalSavYear = autoSavYear + homeSavYear
  return { ca, ch, aa, ah, autoSavYear, homeSavYear, totalSavYear }
}

// ── Input row component ───────────────────────────────────────
function InputRow({ label, sublabel, currVal, allVal, onCurrChange, onAllChange, placeholder }) {
  const IS_base = {
    width: '100%', border: '1px solid var(--border-2)', borderRadius: 8,
    padding: '9px 12px', fontSize: 13, outline: 'none',
    background: 'var(--surface)', color: 'var(--text-1)',
    fontFamily: 'inherit', transition: 'border-color 0.15s',
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: 10, alignItems: 'center', marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 1 }}>{sublabel}</div>}
      </div>
      <input style={IS_base} type="number" value={currVal} onChange={onCurrChange} placeholder={placeholder || 'e.g. 300'} />
      <input style={{ ...IS_base, borderColor: '#93c5fd', background: '#eff6ff' }} type="number" value={allVal} onChange={onAllChange} placeholder={placeholder || 'e.g. 275'} />
    </div>
  )
}

// ── Savings row component ─────────────────────────────────────
function SavingsRow({ label, amount, period, isTotal }) {
  if (!amount && amount !== 0) return null
  const positive = amount > 0
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: isTotal ? '12px 16px' : '9px 16px',
      background: isTotal ? (positive ? '#dcfce7' : amount < 0 ? '#fee2e2' : 'var(--surface-3)') : 'transparent',
      borderTop: isTotal ? '1px solid var(--border)' : 'none',
    }}>
      <span style={{ fontSize: isTotal ? 13 : 12, fontWeight: isTotal ? 700 : 400, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontSize: isTotal ? 14 : 12, fontWeight: isTotal ? 700 : 600, color: savColor(amount) }}>
        {positive ? 'Save ' : amount < 0 ? 'Cost +' : ''}{fmt(Math.abs(amount))}{period ? `/${period}` : ''}
      </span>
    </div>
  )
}

export default function SavingsCalculator({ onClose }) {
  const [tab,     setTab]     = useState('common')
  const [common,  setCommon]  = useState({ currAuto: '', currHome: '', allAuto: '', allHome: '' })
  const [monthly, setMonthly] = useState({ currAuto: '', currHome: '', allAuto: '', allHome: '' })
  const [annual,  setAnnual]  = useState({ currAuto: '', currHome: '', allAuto: '', allHome: '' })

  const vals    = tab === 'common' ? common : tab === 'monthly' ? monthly : annual
  const setVals = tab === 'common' ? setCommon : tab === 'monthly' ? setMonthly : setAnnual

  const c  = tab === 'common' ? calcCommon(vals) : tab === 'monthly' ? calcMonthly(vals) : calcAnnual(vals)
  const hasData = vals.currAuto || vals.currHome || vals.allAuto || vals.allHome
  const bigSavings = c.totalSavYear || 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,53,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: 580, maxWidth: '96vw', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>

        {/* ── Header ── */}
        <div style={{ background: N, borderRadius: '16px 16px 0 0', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 3 }}>💰 Savings Calculator</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>Show clients exactly how much they save by switching to Allstate</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 22px', background: 'var(--surface)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '11px 16px', border: 'none',
              borderBottom: tab === t.id ? `2px solid ${N}` : '2px solid transparent',
              background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? N : 'var(--text-3)',
              marginBottom: -1, whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 22px' }}>

          {/* Tab description */}
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 16, fontStyle: 'italic' }}>
            {TABS.find(t => t.id === tab)?.desc}
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: 10, marginBottom: 6 }}>
            <div />
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Carrier</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: N, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>Allstate Quote</div>
          </div>

          {/* ── Most Common inputs ── */}
          {tab === 'common' && (
            <>
              <InputRow
                label="Auto" sublabel="per month"
                currVal={common.currAuto} onCurrChange={e => setCommon(v => ({ ...v, currAuto: e.target.value }))}
                allVal={common.allAuto}   onAllChange={e => setCommon(v => ({ ...v, allAuto: e.target.value }))}
                placeholder="e.g. 300"
              />
              <InputRow
                label="Home" sublabel="per year (escrow)"
                currVal={common.currHome} onCurrChange={e => setCommon(v => ({ ...v, currHome: e.target.value }))}
                allVal={common.allHome}   onAllChange={e => setCommon(v => ({ ...v, allHome: e.target.value }))}
                placeholder="e.g. 2400"
              />
            </>
          )}

          {/* ── Both Monthly inputs ── */}
          {tab === 'monthly' && (
            <>
              <InputRow
                label="Auto" sublabel="per month"
                currVal={monthly.currAuto} onCurrChange={e => setMonthly(v => ({ ...v, currAuto: e.target.value }))}
                allVal={monthly.allAuto}   onAllChange={e => setMonthly(v => ({ ...v, allAuto: e.target.value }))}
                placeholder="e.g. 300"
              />
              <InputRow
                label="Home" sublabel="per month"
                currVal={monthly.currHome} onCurrChange={e => setMonthly(v => ({ ...v, currHome: e.target.value }))}
                allVal={monthly.allHome}   onAllChange={e => setMonthly(v => ({ ...v, allHome: e.target.value }))}
                placeholder="e.g. 200"
              />
            </>
          )}

          {/* ── Both Annual inputs ── */}
          {tab === 'annual' && (
            <>
              <InputRow
                label="Auto" sublabel="per year"
                currVal={annual.currAuto} onCurrChange={e => setAnnual(v => ({ ...v, currAuto: e.target.value }))}
                allVal={annual.allAuto}   onAllChange={e => setAnnual(v => ({ ...v, allAuto: e.target.value }))}
                placeholder="e.g. 3600"
              />
              <InputRow
                label="Home" sublabel="per year"
                currVal={annual.currHome} onCurrChange={e => setAnnual(v => ({ ...v, currHome: e.target.value }))}
                allVal={annual.allHome}   onAllChange={e => setAnnual(v => ({ ...v, allHome: e.target.value }))}
                placeholder="e.g. 2400"
              />
            </>
          )}

          {/* ── Results ── */}
          {hasData && (
            <div style={{ marginTop: 18, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, background: 'var(--surface-3)', padding: '8px 16px' }}>
                {['', 'Current', 'Allstate', 'You save'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
                ))}
              </div>

              {/* Most Common rows */}
              {tab === 'common' && c.ca + c.aa > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Auto <span style={{ fontSize: 10, color: 'var(--text-4)' }}>/ mo</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>{c.ca ? fmt(c.ca) : '—'}</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600, textAlign: 'right' }}>{c.aa ? fmt(c.aa) : '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: savColor(c.ca - c.aa), textAlign: 'right' }}>{c.ca && c.aa ? fmt(Math.abs(c.ca - c.aa)) + '/mo' : '—'}</div>
                </div>
              )}
              {tab === 'common' && c.ch + c.ah > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Home <span style={{ fontSize: 10, color: 'var(--text-4)' }}>/ yr (escrow)</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>{c.ch ? fmt(c.ch) : '—'}</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600, textAlign: 'right' }}>{c.ah ? fmt(c.ah) : '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: savColor(c.ch - c.ah), textAlign: 'right' }}>{c.ch && c.ah ? fmt(Math.abs(c.ch - c.ah)) + '/yr' : '—'}</div>
                </div>
              )}

              {/* Both Monthly rows */}
              {tab === 'monthly' && c.ca + c.aa > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Auto <span style={{ fontSize: 10, color: 'var(--text-4)' }}>/ mo</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>{c.ca ? fmt(c.ca) : '—'}</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600, textAlign: 'right' }}>{c.aa ? fmt(c.aa) : '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: savColor(c.autoSavMo), textAlign: 'right' }}>{c.ca && c.aa ? fmt(Math.abs(c.autoSavMo)) + '/mo' : '—'}</div>
                </div>
              )}
              {tab === 'monthly' && c.ch + c.ah > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Home <span style={{ fontSize: 10, color: 'var(--text-4)' }}>/ mo</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>{c.ch ? fmt(c.ch) : '—'}</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600, textAlign: 'right' }}>{c.ah ? fmt(c.ah) : '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: savColor(c.homeSavMo), textAlign: 'right' }}>{c.ch && c.ah ? fmt(Math.abs(c.homeSavMo)) + '/mo' : '—'}</div>
                </div>
              )}

              {/* Both Annual rows */}
              {tab === 'annual' && c.ca + c.aa > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Auto <span style={{ fontSize: 10, color: 'var(--text-4)' }}>/ yr</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>{c.ca ? fmt(c.ca) : '—'}</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600, textAlign: 'right' }}>{c.aa ? fmt(c.aa) : '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: savColor(c.autoSavYear), textAlign: 'right' }}>{c.ca && c.aa ? fmt(Math.abs(c.autoSavYear)) + '/yr' : '—'}</div>
                </div>
              )}
              {tab === 'annual' && c.ch + c.ah > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Home <span style={{ fontSize: 10, color: 'var(--text-4)' }}>/ yr</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>{c.ch ? fmt(c.ch) : '—'}</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600, textAlign: 'right' }}>{c.ah ? fmt(c.ah) : '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: savColor(c.homeSavYear), textAlign: 'right' }}>{c.ch && c.ah ? fmt(Math.abs(c.homeSavYear)) + '/yr' : '—'}</div>
                </div>
              )}

              {/* Total row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, padding: '12px 16px', borderTop: '2px solid var(--border)', background: bigSavings > 0 ? '#f0fdf4' : bigSavings < 0 ? '#fff7f7' : 'var(--surface)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Total / year</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', textAlign: 'right' }}>{c.totalCurrY ? fmt(c.totalCurrY) : '—'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: N, textAlign: 'right' }}>{c.totalAllY ? fmt(c.totalAllY) : '—'}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: savColor(bigSavings), textAlign: 'right' }}>{c.totalCurrY || c.totalAllY ? fmt(Math.abs(bigSavings)) : '—'}</div>
              </div>
            </div>
          )}

          {/* ── Big savings callout ── */}
          {bigSavings > 0 && (
            <div style={{ marginTop: 16, background: '#EAF3DE', border: '1.5px solid #C0DD97', borderRadius: 12, padding: '18px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#27500A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                With Allstate, this client saves
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#166534', marginBottom: 4 }}>
                {fmt(bigSavings)}<span style={{ fontSize: 16, fontWeight: 500, color: '#27500A' }}> / year</span>
              </div>
              {tab !== 'annual' && (
                <div style={{ fontSize: 13, color: '#3a5a1c', fontWeight: 500 }}>
                  That's {fmt(bigSavings / 12)} back in their pocket every month
                </div>
              )}
            </div>
          )}

          {bigSavings < 0 && (
            <div style={{ marginTop: 16, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#9a3412', fontWeight: 500 }}>Allstate would cost {fmt(Math.abs(bigSavings))} more per year in this scenario.</div>
            </div>
          )}

          {!hasData && (
            <div style={{ marginTop: 16, textAlign: 'center', padding: '20px 0', color: 'var(--text-4)', fontSize: 13 }}>
              Enter amounts above to see savings
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
