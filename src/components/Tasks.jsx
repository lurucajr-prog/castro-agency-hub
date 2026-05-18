// ============================================================
// Castro Agency Hub — Tasks
// Place this file at: src/components/Tasks.jsx
// ============================================================
import { useState, useEffect, useRef } from 'react'
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
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Attachments: { [taskId]: [{ id, file_url, file_name, created_at }] }
  const [attachments,      setAttachments]      = useState({})
  const [expandedTask,     setExpandedTask]      = useState(null)  // taskId with open attachment panel
  const [uploadingTaskId,  setUploadingTaskId]  = useState(null)
  const attachFileRef = useRef(null)
  const attachTaskRef = useRef(null)  // which task the file picker is for

  const isAdmin = user.role === 'admin'
  const members = profiles.filter(p => p.role === 'member' || p.role === 'admin')

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    if (members.length > 0 && !sel) setSel(members[0])
  }, [profiles])

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

  async function fetchAttachments(taskId) {
    if (attachments[taskId]) return  // already loaded
    const { data } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    setAttachments(a => ({ ...a, [taskId]: data || [] }))
  }

  function toggleExpand(taskId) {
    if (expandedTask === taskId) {
      setExpandedTask(null)
    } else {
      setExpandedTask(taskId)
      fetchAttachments(taskId)
    }
  }

  function openFilePicker(taskId) {
    attachTaskRef.current = taskId
    attachFileRef.current?.click()
  }

  async function handleAttachmentUpload(e) {
    const file   = e.target.files[0]
    const taskId = attachTaskRef.current
    if (!file || !taskId) return
    if (file.size > 20 * 1024 * 1024) { alert('File must be under 20MB.'); return }
    setUploadingTaskId(taskId)
    const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storedName = `task-${taskId}-${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage
      .from('task-attachments')
      .upload(storedName, file, { contentType: file.type })
    if (upErr) {
      alert('Upload failed. Make sure the task-attachments storage bucket exists.')
      setUploadingTaskId(null)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(storedName)
    const { data: record } = await supabase.from('task_attachments').insert({
      task_id:     taskId,
      uploaded_by: user.id,
      file_url:    publicUrl,
      file_name:   file.name,
    }).select().single()
    if (record) {
      setAttachments(a => ({ ...a, [taskId]: [...(a[taskId] || []), record] }))
    }
    setUploadingTaskId(null)
    e.target.value = ''
  }

  async function deleteAttachment(taskId, attId) {
    if (!window.confirm('Remove this attachment?')) return
    await supabase.from('task_attachments').delete().eq('id', attId)
    setAttachments(a => ({ ...a, [taskId]: (a[taskId] || []).filter(x => x.id !== attId) }))
  }

  async function toggleTask(id, done) {
    await supabase.from('tasks').update({ done: !done }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !done } : t))
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

  // Inner TaskRow component
  function TaskRow({ t }) {
    const isExpanded    = expandedTask === t.id
    const taskAtts      = attachments[t.id] || []
    const attCount      = taskAtts.length
    const isUploading   = uploadingTaskId === t.id

    return (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Main row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0' }}>
          {/* Checkbox */}
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

          {/* Title + meta */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-1)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
              <Chip label={t.pri} />
              {t.rolled && <Chip label="Rolled Over" />}
            </div>
            {t.note && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.note}</div>}
          </div>

          {/* Attachment toggle button */}
          <button
            onClick={() => toggleExpand(t.id)}
            title="Attachments"
            style={{
              border: `1px solid ${isExpanded ? N : 'var(--border)'}`,
              background: isExpanded ? 'var(--primary-light)' : 'transparent',
              borderRadius: 6, padding: '2px 7px', cursor: 'pointer',
              fontSize: 11, color: isExpanded ? N : 'var(--text-4)',
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            }}
          >
            📎 {attCount > 0 ? attCount : ''}
          </button>

          {/* Delete (admin only) */}
          {isAdmin && (
            <button
              onClick={() => setConfirmDelete(t)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--border-2)', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
              title="Delete task"
            >×</button>
          )}
        </div>

        {/* Attachment panel */}
        {isExpanded && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, margin: '0 0 8px 24px', padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Attachments</div>

            {taskAtts.length === 0 && !isUploading && (
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8 }}>No attachments yet.</div>
            )}

            {taskAtts.map(att => (
              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>📄</span>
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  download={att.file_name}
                  style={{ fontSize: 12, color: N, textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {att.file_name}
                </a>
                {(isAdmin || att.uploaded_by === user.id) && (
                  <button
                    onClick={() => deleteAttachment(t.id, att.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, flexShrink: 0 }}
                    title="Remove attachment"
                  >✕</button>
                )}
              </div>
            ))}

            {isUploading && (
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8 }}>Uploading…</div>
            )}

            <button
              onClick={() => openFilePicker(t.id)}
              disabled={isUploading}
              style={{ fontSize: 11, color: N, background: 'var(--primary-light)', border: `1px solid var(--primary-mid)`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}
            >
              + Attach file
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Hidden file input for task attachments */}
      <input
        ref={attachFileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={handleAttachmentUpload}
      />

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
                  const mt2    = tasks.filter(t => t.uid === m.id)
                  const d      = mt2.filter(t => t.done).length
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
                {pending.length === 0 && done.length === 0 && (
                  <EmptyState text="No tasks yet. Add one above!" icon="☑️" />
                )}
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
          <div style={{ fontSize: 11, color: 'var(--text-4)', padding: '6px 0' }}>
            You can attach files to a task after saving it by clicking the 📎 button on the task row.
          </div>
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
