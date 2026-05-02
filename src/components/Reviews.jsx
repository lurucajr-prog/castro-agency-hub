import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Modal, Chip, Spinner, EmptyState, IS } from './shared'

const RESULTS = ['Pending', 'Left a Review', 'Declined', 'No Response']
const TEMPLATES = [
  { label: 'Text message', text: 'Hi [Client Name], it was great helping you with your [policy type] today! If you have a moment, we\'d really appreciate a Google review — it helps our small agency a lot. [Google Review Link]. Thank you!' },
  { label: 'Email', text: 'Hi [Client Name], thank you for trusting us with your insurance. If you\'ve had a good experience, a quick Google review would mean the world to our team. It only takes a minute: [Google Review Link]. We really appreciate it!' },
  { label: 'Phone script', text: '"Before I let you go — we\'re always trying to grow. Would you be open to leaving us a quick Google review? I can text you the link right now."' },
]

export default function Reviews({ user }) {
  const [revs, setRevs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [copied, setCopied] = useState(null)
  const [form, setForm] = useState({ client: '', policy_type: 'Auto', trigger_type: 'New Policy', method: 'Text', result: 'Pending' })
  const [saving, setSaving] = useState(false)

  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchRevs() }, [])

  async function fetchRevs() {
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
    setRevs(data || [])
    setLoading(false)
  }

  async function addRev() {
    if (!form.client.trim()) return
    setSaving(true)
    const { data } = await supabase.from('reviews')
      .insert({ ...form, asked_by_name: user.name, asked_by_uid: user.id })
      .select().single()
    if (data) setRevs(rs => [data, ...rs])
    setForm({ client: '', policy_type: 'Auto', trigger_type: 'New Policy', method: 'Text', result: 'Pending' })
    setSaving(false)
  }

  async function updateResult(id, result) {
    await supabase.from('reviews').update({ result }).eq('id', id)
    setRevs(rs => rs.map(r => r.id === id ? { ...r, result } : r))
  }

  function copyTemplate(text, i) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <Spinner />

  const done = revs.filter(r => r.result === 'Left a Review').length

  return (
    <>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 2 }}>Review requests</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Track every ask and build accountability</div>
          </div>
          <Btn variant="outline" onClick={() => setShowTemplates(true)}>Templates</Btn>
        </div>

        {/* Stats (admin only) */}
        {isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total requests', val: revs.length, c: '#1e40af' },
              { label: 'Left a review', val: done, c: '#166534' },
              { label: 'Pending', val: revs.filter(r => r.result === 'Pending').length, c: '#92400e' },
              { label: 'Conversion', val: revs.length ? Math.round(done / revs.length * 100) + '%' : '0%', c: N },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: s.c }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Log form */}
        <Card mb={14}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 11 }}>Log a review request</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <Field label="Client name *">
              <input style={IS} value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Smith, John" />
            </Field>
            <Field label="Policy type">
              <select style={IS} value={form.policy_type} onChange={e => setForm(f => ({ ...f, policy_type: e.target.value }))}>
                {['Auto', 'Home', 'Life', 'Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Trigger">
              <select style={IS} value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                {['New Policy', 'Renewal'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Method">
              <select style={IS} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {['Text', 'Email', 'Phone', 'In Person'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Result">
              <select style={IS} value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
                {RESULTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Btn onClick={addRev} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving…' : 'Log request'}
              </Btn>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card p={0}>
          {revs.length === 0
            ? <EmptyState text="No review requests logged yet." />
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Client', 'Policy', 'Date', 'Method', 'Asked by', 'Result'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revs.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.policy_type}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.method}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.asked_by_name}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <select
                          value={r.result}
                          onChange={e => updateResult(r.id, e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', color: '#111' }}
                        >
                          {RESULTS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Card>
      </div>

      {showTemplates && (
        <Modal title="Review templates" onClose={() => setShowTemplates(false)}>
          {TEMPLATES.map((t, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{t.label}</span>
                <Btn sm variant="outline" onClick={() => copyTemplate(t.text, i)}>
                  {copied === i ? '✓ Copied' : 'Copy'}
                </Btn>
              </div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '10px 12px', fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                {t.text}
              </div>
            </div>
          ))}
        </Modal>
      )}
    </>
  )
}
