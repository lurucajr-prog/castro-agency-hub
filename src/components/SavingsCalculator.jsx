import { useState } from 'react'
import { N } from './shared'

const fmt = n => n ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
const fmtSavings = n => n > 0 ? `Save ${fmt(n)}` : n < 0 ? `Cost +${fmt(Math.abs(n))}` : '—'
const savingsColor = n => n > 0 ? '#166534' : n < 0 ? '#991b1b' : '#6b7280'

export default function SavingsCalculator({ onClose }) {
  const [tab, setTab] = useState('monthly')
  const [m, setM] = useState({ currAuto: '', currHome: '', allAuto: '', allHome: '' })
  const [f, setF] = useState({ currAuto: '', currHome: '', allAuto: '', allHome: '' })

  function calc(vals) {
    const ca = Number(vals.currAuto) || 0
    const ch = Number(vals.currHome) || 0
    const aa = Number(vals.allAuto) || 0
    const ah = Number(vals.allHome) || 0
    return {
      currAuto: ca, currHome: ch, allAuto: aa, allHome: ah,
      currAutoY: ca * 12, currHomeY: ch * 12,
      allAutoY: aa * 12, allHomeY: ah * 12,
      diffAutoM: ca - aa, diffHomeM: ch - ah,
      diffAutoY: (ca - aa) * 12, diffHomeY: (ch - ah) * 12,
      totalCurrM: ca + ch, totalAllM: aa + ah,
      totalCurrY: (ca + ch) * 12, totalAllY: (aa + ah) * 12,
      totalDiffM: (ca + ch) - (aa + ah),
      totalDiffY: ((ca + ch) - (aa + ah)) * 12,
    }
  }

  const vals = tab === 'monthly' ? m : f
  const setVals = tab === 'monthly' ? setM : setF
  const c = calc(vals)

  const IS = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff', fontFamily: 'inherit' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,29,53,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 560, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ background: N, borderRadius: '14px 14px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>💰 Quick Savings Calculator</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>Show clients exactly how much they save by switching</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 20px' }}>
          {[{ id: 'monthly', label: 'Monthly Plan' }, { id: 'fullpay', label: 'Full Pay Plan' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', border: 'none', borderBottom: tab === t.id ? `2px solid ${N}` : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? N : '#6b7280', marginBottom: -1 }}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {/* Input grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <div />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textAlign: 'center', textTransform: 'uppercase', letterSpacing: .5 }}>Current Carrier</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: N, textAlign: 'center', textTransform: 'uppercase', letterSpacing: .5 }}>Allstate Quote</div>

            <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Auto</div>
            <input style={IS} type="number" value={vals.currAuto} onChange={e => setVals(v => ({ ...v, currAuto: e.target.value }))} placeholder="e.g. 300" />
            <input style={{ ...IS, borderColor: '#bfdbfe' }} type="number" value={vals.allAuto} onChange={e => setVals(v => ({ ...v, allAuto: e.target.value }))} placeholder="e.g. 285" />

            <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Home</div>
            <input style={IS} type="number" value={vals.currHome} onChange={e => setVals(v => ({ ...v, currHome: e.target.value }))} placeholder="e.g. 200" />
            <input style={{ ...IS, borderColor: '#bfdbfe' }} type="number" value={vals.allHome} onChange={e => setVals(v => ({ ...v, allHome: e.target.value }))} placeholder="e.g. 150" />
          </div>

          {/* Results table */}
          <div style={{ background: '#f9fafb', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {['', 'Current Carrier', 'Allstate', 'Monthly Savings', 'Yearly Savings'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === '' ? 'left' : 'right', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Auto', currM: c.currAuto, allM: c.allAuto, currY: c.currAutoY, allY: c.allAutoY, diffM: c.diffAutoM, diffY: c.diffAutoY },
                  { label: 'Home', currM: c.currHome, allM: c.allHome, currY: c.currHomeY, allY: c.allHomeY, diffM: c.diffHomeM, diffY: c.diffHomeY },
                ].map((row, i) => (
                  <tr key={row.label} style={{ borderTop: i > 0 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500, color: '#111' }}>{row.label}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151', textAlign: 'right' }}>{row.currM ? fmt(row.currM) + '/mo' : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: N, textAlign: 'right', fontWeight: 500 }}>{row.allM ? fmt(row.allM) + '/mo' : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: savingsColor(row.diffM), textAlign: 'right' }}>{row.currM || row.allM ? fmtSavings(row.diffM) + '/mo' : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: savingsColor(row.diffY), textAlign: 'right' }}>{row.currM || row.allM ? fmtSavings(row.diffY) + '/yr' : '—'}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #e5e7eb', background: '#fff' }}>
                  <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 700, color: '#111' }}>Total</td>
                  <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'right' }}>{c.totalCurrM ? fmt(c.totalCurrM) + '/mo' : '—'}</td>
                  <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 600, color: N, textAlign: 'right' }}>{c.totalAllM ? fmt(c.totalAllM) + '/mo' : '—'}</td>
                  <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 700, color: savingsColor(c.totalDiffM), textAlign: 'right' }}>{c.totalCurrM || c.totalAllM ? fmtSavings(c.totalDiffM) + '/mo' : '—'}</td>
                  <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 700, color: savingsColor(c.totalDiffY), textAlign: 'right' }}>{c.totalCurrM || c.totalAllM ? fmtSavings(c.totalDiffY) + '/yr' : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Big savings call-out */}
          {c.totalDiffY > 0 && (
            <div style={{ background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#27500A', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>With Allstate, this client saves</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#166534' }}>{fmt(c.totalDiffY)}<span style={{ fontSize: 16, fontWeight: 500 }}> / year</span></div>
              <div style={{ fontSize: 13, color: '#27500A', marginTop: 4 }}>That's {fmt(c.totalDiffM)} back in their pocket every month</div>
            </div>
          )}
          {c.totalDiffY === 0 && c.totalCurrM > 0 && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              Enter both carrier and Allstate quotes to see savings.
            </div>
          )}
          {c.totalDiffY < 0 && c.totalCurrM > 0 && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#991b1b', fontWeight: 600 }}>Allstate would cost this client more. Focus on value and coverage.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
