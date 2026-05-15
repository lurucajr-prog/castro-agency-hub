import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, Card, Btn, Field, Modal, Chip, Spinner, EmptyState, IS, IS_ERR, ConfirmModal } from './shared'

const PRI_ORDER = { Urgent: 0, Normal: 1, Low: 2 }

function DueBadge({ date }) {
  if (!date) return null
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const isOverdue  = date < today
  const isToday    = date === today
  const isTomorrow = date === tomorrow
  let bg, tx, label
  if (isOverdue)       { bg = 'var(--danger-light)';  tx = '#991b1b';       label = '⚠ Overdue' }
  else if (isToday)    { bg = 'var(--warning-light)'; tx = '#92400e';       label = '📅 Due today' }
  else if (isTomorrow) { bg = 'var(--warning-light)'; tx = '#92400e';       label = '📅 Tomorrow' }
  else                 { bg = 'var(--surface-3)';     tx = 'var(--text-4)'; label = '📅 ' + new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  return (
    <span style={{ fontSize: 10, fontWeight: 500, background: bg, color: tx, padding: '2px 7px', borderRadius: 99 }}>
      {label}
    </span>
  )
}

export default function Tasks({ user }) {
  const [tasks,           setTasks]           = useState([])
  const [profiles,        setProfiles]        = useState([])
  const [templates,       setTemplates]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [sel,             setSel]             = useState(null)
  const [showModal,       setShowModal]       = useState(false)
  const [showTplModal,    setShowTplModal]    = useState(false)  // manage templates
  const [form,            setForm]            = useState({ title: '', note: '', pri: 'Normal', uid: '', due_date: '' })
  const [tplForm,         setTplForm]         = useState({ title: '', note: '', pri: 'Normal' })
  const [errors,          setErrors]          = useState({})
  const [saving,          setSaving]          = useState(false)
  const [savingTpl,       setSavingTpl]       = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(null)
  const [confirmDelTpl,   setConfirmDelTpl]   = useState(null)

  const isAdmin = user.role === 'admin'
  const members = profiles  // all profiles can be assigned tasks now (admin + member)
  const today   = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    // Default selector: pick first non-current-user profile, or current user
    if (profiles.length > 0 && !sel) {
      const first = profiles.find(p => p.id !== user.id) || profiles[0]
      setSel(first)
    }
  }, [profiles])

  async function fetchData() {
    const [t, p, tpl] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('task_templates').select('*').order('created_at', { ascending: true }),
    ])
    setTasks(t.data || [])
    setProfiles(p.data || [])
    setTemplates(tpl.data || [])
    // Default assign-to: first profile that isn't current user
    const allP = p.data || []
    const defaultUid = allP.find(x => x.id !== user.id)?.id || user.id
    setForm(f => ({ ...f, uid: defaultUid }))
    setLoading(false)
  }

  async function toggleTask(id, done) {
    const newDone = !done
    await supabase.from('tasks').update({ done: newDone }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: newDone } : t))

    // If task is being marked done, notify the person who assigned it (if not self)
    if (newDone) {
      const task = tasks.find(t => t.id === id)
      if (task?.assigned_by_uid && task.assigned_by_uid !== user.id) {
        await supabase.from('notifications').insert({
          to_uid:     task.assigned_by_uid,
          type:       'task_done',
          title:      '✅ Task completed',
          body:       `${user.name} completed: "${task.title}"`,
          nav_target: 'tasks',
          read:       false,
        })
      }
    }
  }

  async function confirmDeleteTask() {
    if (!confirmDelete) return
    await supabase.from('tasks').delete().eq('id', confirmDelete.id)
    setTasks(ts => ts.filter(t => t.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  async function addTask() {
    const newErrors = {}
    if (!form.title.trim()) newErrors.title = 'Task title is required'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    setSaving(true)
    const uid = isAdmin ? form.uid : user.id
    const assignedProfile = profiles.find(p => p.id === uid)
    const { data, error } = await supabase.from('tasks')
      .insert({
        uid,
        title:            form.title.trim(),
        note:             form.note,
        pri:              form.pri,
        done:             false,
        rolled:           false,
        due_date:         form.due_date || null,
        assigned_by_uid:  user.id,
        assigned_by_name: user.name,
      })
      .select().single()
    if (error) { console.error('[Tasks] add error', error); setSaving(false); return }
    if (data) setTasks(ts => [data, ...ts])

    // Notify the assigned person (if not assigning to yourself)
    if (uid !== user.id) {
      await supabase.from('notifications').insert({
        to_uid:     uid,
        type:       'task_assigned',
        title:      `📋 New task from ${user.name}`,
        body:       form.title.trim() + (form.due_date ? ` · Due ${form.due_date}` : ''),
        nav_target: 'tasks',
        read:       false,
      })
    }

    setForm(f => ({ ...f, title: '', note: '', due_date: '' }))
    setShowModal(false)
    setSaving(false)
  }

  function applyTemplate(tpl) {
    if (!tpl) return
    setForm(f => ({ ...f, title: tpl.title, note: tpl.note || '', pri: tpl.pri }))
  }

  async function saveTemplate() {
    if (!tplForm.title.trim()) return
    setSavingTpl(true)
    const { data } = await supabase.from('task_templates')
      .insert({ title: tplForm.title.trim(), note: tplForm.note, pri: tplForm.pri, created_by: user.id })
      .select().single()
    if (data) setTemplates(ts => [...ts, data])
    setTplForm({ title: '', note: '', pri: 'Normal' })
    setSavingTpl(false)
  }

  async function deleteTemplate() {
    if (!confirmDelTpl) return
    await supabase.from('task_templates').delete().eq('id', confirmDelTpl.id)
    setTemplates(ts => ts.filter(t => t.id !== confirmDelTpl.id))
    setConfirmDelTpl(null)
  }

  if (loading) return <Spinner />

  const vm      = isAdmin ? sel : user
  const mt      = tasks.filter(t => t.uid === vm?.id)

  // Sort: overdue first, then by priority
  const pending = mt.filter(t => !t.done).sort((a, b) => {
    const aOver = a.due_date && a.due_date < today ? 1 : 0
    const bOver = b.due_date && b.due_date < today ? 1 : 0
    if (bOver !== aOver) return bOver - aOver  // overdue first
    return PRI_ORDER[a.pri] - PRI_ORDER[b.pri]
  })
  const done = mt.filter(t => t.done)

  function TaskRow({ t }) {
    const isOverdue = !t.done && t.due_date && t.due_date < today
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0',
        borderBottom: '1px solid var(--border)',
        background: isOverdue ? 'var(--danger-light)' : 'transparent',
        margin: isOverdue ? '0 -15px' : undefined,
        padding: isOverdue ? '9px 15px' : '9px 0',
      }}>
        <div
          onClick={() => toggleTask(t.id, t.done)}
          style={{
            width: 15, height: 15, borderRadius: 3, marginTop: 2, flexShrink: 0, cursor: 'pointer',
            border: `1.5px solid ${t.done ? '#16a34a' : isOverdue ? '#ef4444' : 'var(--border-2)'}`,
            background: t.done ? '#16a34a' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: '#fff', fontWeight: 700,
          }}
        >{t.done ? '✓' : ''}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: isOverdue ? '#991b1b' : 'var(--text-1)', fontWeight: isOverdue ? 600 : 400, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>
              {t.title}
            </span>
            <Chip label={t.pri} />
            {t.rolled && <Chip label="Rolled Over" />}
            <DueBadge date={t.due_date} />
          </div>
          {t.note && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.note}</div>}
        </div>
        {isAdmin && (
          <button
            onClick={() => setConfirmDelete(t)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: isOverdue ? '#ef4444' : 'var(--border-2)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
            title="Delete task"
          >×</button>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>Task board</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{isAdmin ? "Manage your team's tasks" : 'Your tasks for today'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && (
              <Btn variant="outline" sm onClick={() => setShowTplModal(true)}>📋 Templates</Btn>
            )}
            <Btn onClick={() => { setErrors({}); setShowModal(true) }}>+ Add task</Btn>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {/* Member list (admin only) */}
          {isAdmin && (
            <div style={{ width: 155, flexShrink: 0 }}>
              <Card p={10}>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Team</div>
                {members.map(m => {
                  const mt2    = tasks.filter(t => t.uid === m.id)
                  const done2  = mt2.filter(t => t.done).length
                  const over   = mt2.filter(t => !t.done && t.due_date && t.due_date < today).length
                  const active = sel?.id === m.id
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSel(m)}
                      style={{
                        padding: '7px 8px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                        background: active ? 'var(--primary-light)' : 'transparent',
                        border: active ? '1px solid var(--primary-mid)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: active ? 500 : 400, color: active ? N : 'var(--text-2)' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)' }}>
                        {done2}/{mt2.length} done
                        {over > 0 && <span style={{ color: '#ef4444', marginLeft: 4 }}>· {over} overdue</span>}
                      </div>
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

      {/* ── Add task modal ── */}
      {showModal && (
        <Modal title="Add task" onClose={() => { setShowModal(false); setErrors({}) }}>
          {/* Template selector */}
          {templates.length > 0 && (
            <Field label="From template (optional)">
              <select style={IS} defaultValue="" onChange={e => {
                const tpl = templates.find(t => t.id === e.target.value)
                if (tpl) applyTemplate(tpl)
              }}>
                <option value="">— Choose a template —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.title} ({t.pri})</option>)}
              </select>
            </Field>
          )}
          <Field label="Task title *" error={errors.title}>
            <input
              style={errors.title ? IS_ERR : IS}
              value={form.title}
              onChange={e => { setForm(f => ({ ...f, title: e.target.value })); if (errors.title) setErrors(er => ({ ...er, title: '' })) }}
              placeholder="e.g. Follow up with Smith renewal"
              autoFocus
            />
          </Field>
          <Field label="Notes">
            <input style={IS} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Any context…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Priority">
              <select style={IS} value={form.pri} onChange={e => setForm(f => ({ ...f, pri: e.target.value }))}>
                {['Urgent', 'Normal', 'Low'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Due date (optional)">
              <input style={IS} type="date" value={form.due_date} min={today} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </Field>
          </div>
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

      {/* ── Manage templates modal (admin only) ── */}
      {showTplModal && (
        <Modal title="Task templates" onClose={() => setShowTplModal(false)} width={480}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
            Templates let anyone quickly fill in a task with one click. Useful for repetitive tasks like follow-ups or renewals.
          </div>

          {/* Existing templates */}
          {templates.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              {templates.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>{t.title}</div>
                    {t.note && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.note}</div>}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-4)', background: 'var(--surface-3)', borderRadius: 99, padding: '2px 7px' }}>{t.pri}</span>
                  <button onClick={() => setConfirmDelTpl(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 15, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic', marginBottom: 14 }}>No templates yet. Add one below.</div>
          )}

          {/* Add new template */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 10 }}>Add new template</div>
            <Field label="Title *">
              <input style={IS} value={tplForm.title} onChange={e => setTplForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Follow up with renewal client" />
            </Field>
            <Field label="Default note (optional)">
              <input style={IS} value={tplForm.note} onChange={e => setTplForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Check Allstate portal first" />
            </Field>
            <Field label="Default priority">
              <select style={IS} value={tplForm.pri} onChange={e => setTplForm(f => ({ ...f, pri: e.target.value }))}>
                {['Urgent', 'Normal', 'Low'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={saveTemplate} disabled={savingTpl || !tplForm.title.trim()}>
                {savingTpl ? 'Saving…' : '+ Save template'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm delete task */}
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

      {/* Confirm delete template */}
      {confirmDelTpl && (
        <ConfirmModal
          title="Delete this template?"
          message={`"${confirmDelTpl.title}" will be removed from the template list.`}
          confirmLabel="Delete"
          danger
          onConfirm={deleteTemplate}
          onCancel={() => setConfirmDelTpl(null)}
        />
      )}
    </>
  )
}
