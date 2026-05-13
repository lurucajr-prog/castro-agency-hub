import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Modal, Chip, Spinner, EmptyState, IS, IS_ERR, ConfirmModal } from './shared'

const PRI_ORDER = { Urgent: 0, Normal: 1, Low: 2 }

export default function Tasks({ user }) {
  const [tasks,         setTasks]         = useState([])
  const [profiles,      setProfiles]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [sel,           setSel]           = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [form,          setForm]          = useState({ title: '', note: '', pri: 'Normal', uid: '' })
  const [errors,        setErrors]        = useState({})
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)  // task object to delete

  const isAdmin = user.role === 'admin'
  const members = profiles.filter(p => p.role === 'member')

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (members.length > 0 && !sel) setSel(members[0]) }, [profiles])

  async function fetchData() {
    const [t, p] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    setTasks(t.data || [])
    setProfiles(p.data || [])
    setForm(f => ({ ...f, uid: p.data?.find(x => x.role === 'member')?.id || '' }))
    setLoading(false)
  }

  async function toggleTask(id, done) {
    await supabase.from('tasks').update({ done: !done }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !done } : t))
  }

  async function confirmDeleteTask() {
    if (!confirmDelete) return
    const { error } = await supabase.from('tasks').delete().eq('id', confirmDelete.id)
    if (error) { console.error('[Tasks] delete error', error); return }
    setTasks(ts => ts.filter(t => t.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  async function addTask() {
    // Inline validation
    const newErrors = {}
    if (!form.title.trim()) newErrors.title = 'Task title is required'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})

    setSaving(true)
    const uid = isAdmin ? form.uid : user.id
    const { data, error } = await supabase
      .from('tasks')
      .insert({ uid, title: form.title.trim(), note: form.note, pri: form.pri, done: false, rolled: false })
      .select().single()
    if (error) { console.error('[Tasks] add error', error); setSaving(false); return }
    if (data) setTasks(ts => [data, ...ts])
    setForm(f => ({ ...f, title: '', note: '' }))
    setShowModal(false)
    setSaving(false)
  }

  if (loading) return <Spinner />

  const vm      = isAdmin ? sel : user
  const mt      = tasks.filter(t => t.uid === vm?.id)
  const pending = mt.filter(t => !t.done).sort((a, b) => PRI_ORDER[a.pri] - PRI_ORDER[b.pri])
  const done    = mt.filter(t => t.done)

  function TaskRow({ t }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
        <div
          onClick={() => toggleTask(t.id, t.done)}
          style={{
            width: 15, height: 15, borderRadius: 3, marginTop: 1, flexShrink: 0, cursor: 'pointer',
            border: `1.5px solid ${t.done ? '#16a34a' : 'var(--border-2)'}`,
            background: t.done ? '#16a34a' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: '#fff', fontWeight: 700,
          }}
        >{t.done ? '✓' : ''}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-1)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
            <Chip label={t.pri} />
            {t.rolled && <Chip label="Rolled Over" />}
          </div>
          {t.note && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.note}</div>}
        </div>
        {isAdmin && (
          <button
            onClick={() => setConfirmDelete(t)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--border-2)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
            title="Delete task"
          >×</button>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>Task board</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{isAdmin ? "Manage your team's tasks" : 'Your tasks for today'}</div>
          </div>
          <Btn onClick={() => { setErrors({}); setShowModal(true) }}>+ Add task</Btn>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {/* Member list (admin only) */}
          {isAdmin && (
            <div style={{ width: 155, flexShrink: 0 }}>
              <Card p={10}>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Team</div>
                {members.map(m => {
                  const mt2   = tasks.filter(t => t.uid === m.id)
                  const d     = mt2.filter(t => t.done).length
                  const active = sel?.id === m.id
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSel(m)}
                      style={{
                        padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                        background: active ? 'var(--primary-light)' : 'transparent',
                        border:     active ? '1px solid var(--primary-mid)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: active ? 500 : 400, color: active ? N : 'var(--text-2)' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{d}/{mt2.length} done</div>
                    </div>
                  )
                })}
              </Card>
            </div>
          )}

          {/* Task list */}
          <div style={{ flex: 1 }}>
            <Card p={0}>
              <div style={{ padding: '11px 15px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{vm?.name}'s tasks</span>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{pending.length} pending · {done.length} done</span>
              </div>
              <div style={{ padding: '0 15px' }}>
                {pending.length === 0 && done.length === 0 && <EmptyState text="No tasks yet. Add one above!" icon="☑️" />}
                {pending.map(t => <TaskRow key={t.id} t={t} />)}
                {done.length > 0 && (
                  <>
                    <div style={{ padding: '8px 0 4px', fontSize: 10, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Completed ({done.length})
                    </div>
                    {done.map(t => <TaskRow key={t.id} t={t} />)}
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Add task modal */}
      {showModal && (
        <Modal title="Add task" onClose={() => { setShowModal(false); setErrors({}) }}>
          <Field label="Task title *" error={errors.title}>
            <input
              style={errors.title ? IS_ERR : IS}
              value={form.title}
              onChange={e => {
                setForm(f => ({ ...f, title: e.target.value }))
                if (errors.title) setErrors(err => ({ ...err, title: '' }))
              }}
              placeholder="e.g. Follow up with Smith renewal"
              autoFocus
            />
          </Field>
          <Field label="Notes">
            <input style={IS} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Any context…" />
          </Field>
          <Field label="Priority">
            <select style={IS} value={form.pri} onChange={e => setForm(f => ({ ...f, pri: e.target.value }))}>
              {['Urgent', 'Normal', 'Low'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          {isAdmin && (
            <Field label="Assign to">
              <select style={IS} value={form.uid} onChange={e => setForm(f => ({ ...f, uid: e.target.value }))}>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="outline" onClick={() => { setShowModal(false); setErrors({}) }}>Cancel</Btn>
            <Btn onClick={addTask} disabled={saving}>{saving ? 'Saving…' : 'Add task'}</Btn>
          </div>
        </Modal>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete this task?"
          message={`"${confirmDelete.title}" will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteTask}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
