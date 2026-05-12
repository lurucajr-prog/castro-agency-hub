import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Spinner, EmptyState, IS } from './shared'

const STATUSES = ['Pending', 'Reviewing', 'In Progress', 'Done']
const STATUS_STYLE = {
  'Pending':    { bg:'#f3f4f6', tx:'#374151' },
  'Reviewing':  { bg:'#dbeafe', tx:'#1e40af' },
  'In Progress':{ bg:'#fef9c3', tx:'#854d0e' },
  'Done':       { bg:'#dcfce7', tx:'#166534' },
}

export default function Suggestions({ user }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [filter, setFilter] = useState('All')

  const isAdmin = user.role === 'admin'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false })
    setSuggestions(data||[])
    setLoading(false)
  }

  async function submit() {
    if(!text.trim()) return
    setSubmitting(true)
    const { data } = await supabase.from('suggestions').insert({ text: text.trim(), status:'Pending', admin_note:'' }).select().single()
    if(data) setSuggestions(ss=>[data,...ss])
    setText(''); setSubmitting(false); setSubmitted(true)
    setTimeout(()=>setSubmitted(false), 3000)
  }

  async function updateStatus(id, status) {
    await supabase.from('suggestions').update({ status }).eq('id', id)
    setSuggestions(ss=>ss.map(s=>s.id===id?{...s,status}:s))
  }

  async function saveNote(id) {
    await supabase.from('suggestions').update({ admin_note: noteDraft }).eq('id', id)
    setSuggestions(ss=>ss.map(s=>s.id===id?{...s,admin_note:noteDraft}:s))
    setEditingNote(null)
  }

  async function deleteSuggestion(id) {
    if(!window.confirm('Delete this suggestion?')) return
    await supabase.from('suggestions').delete().eq('id', id)
    setSuggestions(ss=>ss.filter(s=>s.id!==id))
  }

  if(loading) return <Spinner />

  const filtered = filter==='All' ? suggestions : suggestions.filter(s=>s.status===filter)
  const counts = {}
  STATUSES.forEach(s=>{ counts[s]=suggestions.filter(x=>x.status===s).length })

  return (
    <div style={{padding:22}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:500,color:'#111',marginBottom:2}}>Suggestions 💡</div>
        <div style={{fontSize:12,color:'#6b7280'}}>Submit anonymous ideas or feedback. No names attached.</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1.6fr',gap:14}}>
        {/* Submit box */}
        <div>
          <Card style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:4}}>Share an idea or feedback</div>
            <div style={{fontSize:11,color:'#9ca3af',marginBottom:12}}>100% anonymous — your name is never saved.</div>
            <textarea
              value={text}
              onChange={e=>setText(e.target.value)}
              rows={5}
              placeholder="What's on your mind? Ideas for the office, things to improve, anything goes…"
              style={{...IS,resize:'none',lineHeight:1.65,fontFamily:'inherit',marginBottom:10}}
            />
            {submitted ? (
              <div style={{fontSize:13,color:'#166534',fontWeight:500,textAlign:'center',padding:'8px 0'}}>✓ Submitted! Thank you.</div>
            ) : (
              <Btn onClick={submit} disabled={submitting||!text.trim()} style={{width:'100%',justifyContent:'center'}}>
                {submitting?'Submitting…':'Submit anonymously'}
              </Btn>
            )}
          </Card>

          {/* Status counts */}
          <Card>
            <div style={{fontSize:12,fontWeight:500,color:'#111',marginBottom:10}}>Overview</div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #f3f4f6'}}>
              <span style={{fontSize:11,color:'#6b7280'}}>Total submitted</span>
              <span style={{fontSize:12,fontWeight:500,color:'#111'}}>{suggestions.length}</span>
            </div>
            {STATUSES.map((s,i)=>{
              const st=STATUS_STYLE[s]
              return(
                <div key={s} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:i<STATUSES.length-1?'1px solid #f3f4f6':'none'}}>
                  <span style={{fontSize:11,color:'#6b7280'}}>{s}</span>
                  <span style={{background:st.bg,color:st.tx,padding:'1px 8px',borderRadius:99,fontSize:11,fontWeight:500}}>{counts[s]||0}</span>
                </div>
              )
            })}
          </Card>
        </div>

        {/* All suggestions */}
        <div>
          {/* Filter */}
          <div style={{display:'flex',gap:5,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:11,color:'#9ca3af'}}>Filter:</span>
            {['All',...STATUSES].map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{padding:'3px 10px',borderRadius:99,border:'none',cursor:'pointer',fontSize:11,fontWeight:500,background:filter===s?N:'#f3f4f6',color:filter===s?'#fff':'#6b7280'}}>{s}</button>
            ))}
          </div>

          {filtered.length===0
            ? <EmptyState text={suggestions.length===0?'No suggestions yet. Be the first!':'No suggestions match this filter.'} />
            : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {filtered.map(s=>{
                  const st=STATUS_STYLE[s.status]||STATUS_STYLE['Pending']
                  const isEditingThis=editingNote===s.id
                  return(
                    <div key={s.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'14px 16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:10}}>
                        <div style={{fontSize:13,color:'#111',lineHeight:1.65,flex:1}}>{s.text}</div>
                        <div style={{display:'flex',gap:7,alignItems:'center',flexShrink:0}}>
                          {isAdmin?(
                            <select value={s.status} onChange={e=>updateStatus(s.id,e.target.value)} style={{border:'none',background:st.bg,color:st.tx,fontWeight:600,fontSize:11,padding:'3px 9px',borderRadius:99,cursor:'pointer',outline:'none'}}>
                              {STATUSES.map(o=><option key={o}>{o}</option>)}
                            </select>
                          ):(
                            <span style={{background:st.bg,color:st.tx,padding:'2px 9px',borderRadius:99,fontSize:11,fontWeight:500}}>{s.status}</span>
                          )}
                          {isAdmin&&(
                            <button onClick={()=>deleteSuggestion(s.id)} style={{border:'none',background:'none',cursor:'pointer',color:'#d1d5db',fontSize:14,lineHeight:1}}>🗑</button>
                          )}
                        </div>
                      </div>

                      <div style={{fontSize:10,color:'#9ca3af',marginBottom:s.admin_note||isAdmin?8:0}}>
                        {new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </div>

                      {/* Admin note */}
                      {(s.admin_note||isAdmin)&&(
                        <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:7,padding:'8px 11px'}}>
                          <div style={{fontSize:10,fontWeight:500,color:'#0c4a6e',marginBottom:4,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span>📝 Team response</span>
                            {isAdmin&&!isEditingThis&&(
                              <button onClick={()=>{setEditingNote(s.id);setNoteDraft(s.admin_note||'')}} style={{fontSize:10,color:'#0284c7',background:'none',border:'none',cursor:'pointer'}}>Edit</button>
                            )}
                          </div>
                          {isEditingThis?(
                            <div>
                              <textarea value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} rows={2} placeholder="Add a response for the team…" style={{...IS,resize:'none',fontFamily:'inherit',fontSize:12,lineHeight:1.5,marginBottom:7}} />
                              <div style={{display:'flex',gap:6}}>
                                <Btn sm onClick={()=>saveNote(s.id)}>Save</Btn>
                                <Btn sm variant="outline" onClick={()=>setEditingNote(null)}>Cancel</Btn>
                              </div>
                            </div>
                          ):(
                            <div style={{fontSize:12,color:'#0c4a6e',lineHeight:1.6}}>
                              {s.admin_note||<span style={{color:'#9ca3af',fontStyle:'italic'}}>No response added yet.</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
