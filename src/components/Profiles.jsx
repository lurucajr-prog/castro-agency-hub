import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { N, R, Card, Btn, Field, Modal, Spinner, IS } from './shared'

const BADGES = [
  { id: 'first_sale',    icon: '🌟', label: 'First Sale',     desc: 'Logged their first sale' },
  { id: 'month_club',   icon: '🏆', label: 'Month Club',     desc: '5+ sales in a month' },
  { id: 'power_month',  icon: '💪', label: 'Power Month',    desc: '10+ sales in a month' },
  { id: 'review_hero',  icon: '⭐', label: 'Review Hero',    desc: '5+ reviews logged' },
  { id: 'streak_master',icon: '🔥', label: 'Streak Master',  desc: '3+ day selling streak' },
]

function calcStreak(sales, uid) {
  const dates = new Set(sales.filter(s=>s.uid===uid).map(s=>new Date(s.created_at).toDateString()))
  let streak=0; const d=new Date()
  if(!dates.has(d.toDateString())) d.setDate(d.getDate()-1)
  while(dates.has(d.toDateString())) { streak++; d.setDate(d.getDate()-1) }
  return streak
}

function getBadges(uid, allSales, monthSales, reviews) {
  const mySales = allSales.filter(s=>s.uid===uid)
  const myMonthSales = monthSales.filter(s=>s.uid===uid)
  const myReviews = reviews.filter(r=>r.asked_by_uid===uid)
  const streak = calcStreak(allSales, uid)
  return BADGES.filter(b => {
    if(b.id==='first_sale')    return mySales.length >= 1
    if(b.id==='month_club')    return myMonthSales.length >= 5
    if(b.id==='power_month')   return myMonthSales.length >= 10
    if(b.id==='review_hero')   return myReviews.length >= 5
    if(b.id==='streak_master') return streak >= 3
    return false
  })
}

export default function Profiles({ user }) {
  const [profiles, setProfiles] = useState([])
  const [allSales, setAllSales] = useState([])
  const [monthSales, setMonthSales] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [p, allS, mS, r] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('sales').select('uid, created_at, premium'),
      supabase.from('sales').select('uid, premium').gte('created_at', monthStart),
      supabase.from('reviews').select('asked_by_uid'),
    ])
    setProfiles(p.data||[])
    setAllSales(allS.data||[])
    setMonthSales(mS.data||[])
    setReviews(r.data||[])
    setLoading(false)
  }

  async function saveBio() {
    if(!selected) return
    setSaving(true)
    await supabase.from('profiles').update({ bio: bioDraft }).eq('id', selected.id)
    setProfiles(ps => ps.map(p => p.id===selected.id ? {...p, bio:bioDraft} : p))
    setSelected(s => s ? {...s, bio:bioDraft} : s)
    setEditing(false)
    setSaving(false)
  }

  async function uploadPhoto(file) {
    if(!file||!file.type.startsWith('image/')) return
    if(file.size > 3*1024*1024) { alert('Photo must be under 3MB.'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()||'jpg'
    const fileName = `${selected.id}-avatar.${ext}`
    await supabase.storage.from('profile-photos').upload(fileName, file, { upsert:true, contentType:file.type })
    const { data:{ publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(fileName)
    await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', selected.id)
    setProfiles(ps => ps.map(p => p.id===selected.id ? {...p, photo_url:publicUrl} : p))
    setSelected(s => s ? {...s, photo_url:publicUrl} : s)
    setUploading(false)
  }

  if(loading) return <Spinner />

  const members = profiles.filter(p=>p.role==='member')

  return (
    <>
      <div style={{padding:22}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:500,color:'#111',marginBottom:2}}>Team profiles</div>
          <div style={{fontSize:12,color:'#6b7280'}}>Meet the Castro Agency team</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
          {[...profiles.filter(p=>p.role==='admin'), ...members].map(p => {
            const mPrem = monthSales.filter(s=>s.uid===p.id).reduce((s,x)=>s+(x.premium||0),0)
            const mItems = monthSales.filter(s=>s.uid===p.id).length
            const badges = getBadges(p.id, allSales, monthSales, reviews)
            const streak = calcStreak(allSales, p.id)
            const isMe = p.id === user.id

            return (
              <div key={p.id} onClick={()=>setSelected(p)} style={{ background:'#fff', border:`1.5px solid ${isMe?N:'#e5e7eb'}`, borderRadius:12, padding:'18px 16px', cursor:'pointer', textAlign:'center', transition:'box-shadow .15s' }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                {/* Avatar */}
                <div style={{position:'relative',display:'inline-block',marginBottom:10}}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover',border:`2px solid ${p.role==='admin'?R:N}`}} />
                    : <div style={{width:64,height:64,borderRadius:'50%',background:p.role==='admin'?R:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:600,color:p.role==='admin'?'#fff':'#1e40af',margin:'0 auto'}}>{p.ini}</div>
                  }
                  {streak>0&&<div style={{position:'absolute',bottom:-2,right:-2,background:'#fff',borderRadius:99,fontSize:11,padding:'1px 4px',border:'1px solid #e5e7eb'}}>🔥{streak}</div>}
                </div>
                <div style={{fontSize:14,fontWeight:600,color:'#111',marginBottom:2}}>{p.name}</div>
                <div style={{fontSize:11,color:'#6b7280',marginBottom:8}}>{p.title}</div>
                {p.role==='admin'&&<div style={{fontSize:10,fontWeight:500,color:R,marginBottom:8}}>Admin</div>}
                <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:10}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:16,fontWeight:600,color:N}}>{mItems}</div>
                    <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase',letterSpacing:.4}}>Items</div>
                  </div>
                  <div style={{width:1,background:'#f3f4f6'}} />
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:16,fontWeight:600,color:'#166534'}}>${mPrem>=1000?Math.round(mPrem/1000)+'k':mPrem}</div>
                    <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase',letterSpacing:.4}}>Premium</div>
                  </div>
                </div>
                {badges.length>0&&(
                  <div style={{display:'flex',justifyContent:'center',gap:4,flexWrap:'wrap'}}>
                    {badges.map(b=><span key={b.id} title={b.desc} style={{fontSize:16}}>{b.icon}</span>)}
                  </div>
                )}
                {isMe&&<div style={{fontSize:10,color:N,fontWeight:500,marginTop:8}}>You</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Profile detail modal */}
      {selected && (
        <Modal title={selected.name} onClose={()=>{setSelected(null);setEditing(false)}} width={520}>
          <div style={{display:'flex',gap:18,marginBottom:18,alignItems:'flex-start'}}>
            {/* Photo */}
            <div style={{flexShrink:0,textAlign:'center'}}>
              {selected.photo_url
                ? <img src={selected.photo_url} alt={selected.name} style={{width:80,height:80,borderRadius:'50%',objectFit:'cover',border:`2px solid ${selected.role==='admin'?R:N}`}} />
                : <div style={{width:80,height:80,borderRadius:'50%',background:selected.role==='admin'?R:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:600,color:selected.role==='admin'?'#fff':'#1e40af'}}>{selected.ini}</div>
              }
              {selected.id===user.id&&(
                <>
                  <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{marginTop:8,fontSize:10,color:N,background:'none',border:`1px solid ${N}`,borderRadius:5,padding:'3px 9px',cursor:'pointer',display:'block',width:'100%'}}>{uploading?'Uploading…':'Change photo'}</button>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])uploadPhoto(e.target.files[0]);e.target.value=''}} />
                </>
              )}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:600,color:'#111'}}>{selected.name}</div>
              <div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>{selected.title}</div>
              {selected.role==='admin'&&<span style={{fontSize:10,fontWeight:500,color:R,background:'#fee2e2',padding:'2px 7px',borderRadius:99}}>Admin</span>}
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
            {[
              {label:'Items this month',val:monthSales.filter(s=>s.uid===selected.id).length,c:N},
              {label:'Premium this month',val:'$'+(monthSales.filter(s=>s.uid===selected.id).reduce((s,x)=>s+(x.premium||0),0)).toLocaleString(),c:'#166534'},
              {label:'All-time sales',val:allSales.filter(s=>s.uid===selected.id).length,c:'#6d28d9'},
              {label:'Selling streak',val:calcStreak(allSales,selected.id)+'d',c:'#d97706'},
            ].map(s=>(
              <div key={s.label} style={{background:'#f9fafb',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
                <div style={{fontSize:16,fontWeight:600,color:s.c}}>{s.val}</div>
                <div style={{fontSize:9,color:'#9ca3af',marginTop:2,lineHeight:1.3}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Badges */}
          {(() => {
            const bs = getBadges(selected.id, allSales, monthSales, reviews)
            return bs.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:500,color:'#6b7280',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Badges</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {bs.map(b=>(
                    <div key={b.id} style={{display:'flex',alignItems:'center',gap:5,background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:99,padding:'4px 10px'}}>
                      <span style={{fontSize:14}}>{b.icon}</span>
                      <span style={{fontSize:11,fontWeight:500,color:'#374151'}}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Bio */}
          <div>
            <div style={{fontSize:11,fontWeight:500,color:'#6b7280',textTransform:'uppercase',letterSpacing:.5,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              About
              {selected.id===user.id&&!editing&&(
                <button onClick={()=>{setBioDraft(selected.bio||'');setEditing(true)}} style={{fontSize:10,color:N,background:'none',border:`1px solid ${N}`,borderRadius:5,padding:'2px 8px',cursor:'pointer'}}>✏ Edit</button>
              )}
            </div>
            {editing&&selected.id===user.id?(
              <>
                <textarea value={bioDraft} onChange={e=>setBioDraft(e.target.value)} rows={3} placeholder="Tell the team a little about yourself…" style={{...IS,resize:'none',lineHeight:1.6,fontFamily:'inherit'}} />
                <div style={{display:'flex',gap:7,marginTop:8}}>
                  <Btn onClick={saveBio} disabled={saving}>{saving?'Saving…':'Save'}</Btn>
                  <Btn variant="outline" onClick={()=>setEditing(false)}>Cancel</Btn>
                </div>
              </>
            ):(
              <div style={{fontSize:13,color:selected.bio?'#374151':'#9ca3af',lineHeight:1.65}}>
                {selected.bio||`${selected.name} hasn't added a bio yet.`}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
