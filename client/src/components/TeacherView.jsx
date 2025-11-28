import React, { useEffect, useState } from 'react'
import { weeklyAndMonthlyStats } from '../utils/stats'
import { logout, getCurrentUser } from '../utils/auth'
import { apiFetch } from '../utils/api'
import { SUBJECTS, SUBJECT_KEYS } from '../utils/subjects'

export default function TeacherView(){
  const [tests, setTests] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [weekNum, setWeekNum] = useState('1')
  const [subject, setSubject] = useState(SUBJECT_KEYS[0])
  const emptyMarks = SUBJECT_KEYS.reduce((acc,k)=> (acc[k]={ obtained:'', total:'' }, acc), {})
  const [marks, setMarks] = useState(emptyMarks)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // initialize selected month from existing tests if any
    try{
      const entries = []
      // tests may be empty at first; return null
      return null
    }catch(e){ return null }
  })
  const [editingRows, setEditingRows] = useState({})

  useEffect(()=>{
    // load from API
    let mounted = true
    apiFetch('/api/tests').then(data=>{
      if(!mounted) return
      if(Array.isArray(data)) setTests(data.map(t=> ({ ...t, id: t._id })))
    }).catch(err=> console.error(err))
    return ()=> mounted = false
  },[])

  async function addTest(){
    const payload = { date: new Date(date).toISOString(), marks: {} }
    // Only include the selected subject's marks
    const obj = marks[subject] || {}
    const obtained = Number(obj.obtained) || 0
    const total = Number(obj.total) || 0
    payload.marks[subject] = { obtained, total }
    payload.week = Number(weekNum)
    try{
      const created = await apiFetch('/api/tests', { method: 'POST', body: JSON.stringify(payload) })
      const next = [{ ...created, id: created._id }, ...tests]
      setTests(next)
      setMarks(emptyMarks)
    }catch(err){
      console.error(err)
      alert('Failed to add test')
    }
  }

  async function remove(id){
    try{
      await apiFetch(`/api/tests/${id}`, { method: 'DELETE' })
      setTests(tests.filter(t=>t.id!==id))
    }catch(err){
      console.error(err)
      alert('Failed to delete')
    }
  }

  async function editMark(id, subject, field, value){
    const updated = tests.map(t=> {
      if(t.id!==id) return t
      const marks = { ...t.marks }
      const obj = { ...(marks[subject] || {}) }
      obj[field] = Number(value) || 0
      marks[subject] = obj
      return { ...t, marks }
    })
    setTests(updated)
    const t = updated.find(x=>x.id===id)
    try{
      await apiFetch(`/api/tests/${id}`, { method: 'PUT', body: JSON.stringify({ marks: t.marks, date: t.date }) })
    }catch(err){
      console.error(err)
      alert('Failed to save')
    }
  }

  function doLogout(){
    logout()
    window.location.href = '/login'
  }

  // compute stats only for the selected month (if set), otherwise use all tests
  const filteredTests = React.useMemo(() => {
    if(!selectedMonth) return tests
    return tests.filter(t => {
      const d = new Date(t.date)
      const monKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      return monKey === selectedMonth
    })
  }, [tests, selectedMonth])

  const stats = weeklyAndMonthlyStats(filteredTests)
  // monthlyTrend: compute across all tests (history), used to show month-by-month trend
  const monthlyTrend = React.useMemo(() => {
    return weeklyAndMonthlyStats(tests).monthly || []
  }, [tests])

  // weeklyStats (for selected month) and cumulative per-week averages
  const weeklyStats = stats.weekly || []
  const cumulativeWeekly = React.useMemo(() => {
    if(!weeklyStats || weeklyStats.length===0) return []
    // sort weeklyStats ascending by week index (handle '-wN' or ISO date)
    const parseWeekIndex = (wk) => {
      const m = wk.match(/-w(\d+)$/)
      if(m) return Number(m[1])
      // fallback: use date string
      const d = new Date(wk)
      return d.getTime()
    }
    const sorted = [...weeklyStats].sort((a,b)=> parseWeekIndex(a.week) - parseWeekIndex(b.week))
    const cum = []
    const subjAcc = {}
    let overallSum = 0, overallCount = 0
    sorted.forEach(s => {
      // s.stats.perSubject and s.stats.overall
      Object.entries(s.stats.perSubject || {}).forEach(([k,v]) => {
        subjAcc[k] = subjAcc[k] || { sum:0, count:0 }
        subjAcc[k].sum += v
        subjAcc[k].count += 1
      })
      if(typeof s.stats.overall === 'number'){
        overallSum += s.stats.overall
        overallCount += 1
      }
      const perSubjectCum = {}
      Object.entries(subjAcc).forEach(([k,v]) => { perSubjectCum[k] = +(v.sum / v.count).toFixed(2) })
      const overallCum = overallCount>0 ? +(overallSum/overallCount).toFixed(2) : null
      cum.push({ week: s.week, stats: { perSubject: perSubjectCum, overall: overallCum } })
    })
    return cum
  }, [weeklyStats])

  function formatWeekLabel(wk){
    // Always show week number (Week 1..5). Prefer explicit t.week when available.
    try{
      for(const t of filteredTests){
        const d = new Date(t.date)
        let testWeekKey
        if(t.week && Number.isInteger(Number(t.week))){
          testWeekKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-w${t.week}`
          if(String(testWeekKey) === String(wk)) return `Week ${t.week}`
        }
      }
    }catch(e){/* ignore */}

    // If wk is a week-of-month key like YYYY-MM-wN
    const m = String(wk).match(/-w(\d+)$/)
    if(m) return `Week ${m[1]}`

    // If wk is an ISO week-start date, compute week-of-month from its day
    const d = new Date(wk)
    if(!Number.isNaN(d.getTime())){
      const day = d.getDate()
      const weekOfMonth = Math.floor((day - 1) / 7) + 1
      return `Week ${weekOfMonth}`
    }

    return String(wk)
  }

  useEffect(()=>{
    // when tests change, ensure we have a selected month (prefer latest)
    const entries = []
    tests.forEach(t => {
      const date = t.date
      Object.entries(t.marks || {}).forEach(([sub, m]) => {
        const d = new Date(date)
        const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        entries.push(monthKey)
      })
    })
    const months = Array.from(new Set(entries)).sort((a,b)=>b.localeCompare(a))
    if(months.length && !selectedMonth) setSelectedMonth(months[0])
  }, [tests])

  return (
    <div className="page">
      <header className="header">
        <h1>Teacher Dashboard</h1>
        <div>
          <span>{getCurrentUser()?.username}</span>
          <button onClick={doLogout}>Logout</button>
        </div>
      </header>
      <section className="card">
        <h2>Add Marks</h2>
        <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <label>Week of month
          <select value={weekNum} onChange={e=>setWeekNum(e.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>
        <label>Subject
          <select value={subject} onChange={e=>setSubject(e.target.value)}>
            {SUBJECTS.map(s=> <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <input className="input" type="number" min="0" placeholder="obtained" value={marks[subject].obtained} onChange={e=>setMarks(prev=>({ ...prev, [subject]: { ...prev[subject], obtained: e.target.value } }))} />
          <input className="input" type="number" min="0" placeholder="total" value={marks[subject].total} onChange={e=>setMarks(prev=>({ ...prev, [subject]: { ...prev[subject], total: e.target.value } }))} />
        </div>
        <div style={{ marginTop:12 }}>
          <button onClick={addTest}>Add Marks</button>
        </div>
      </section>

      <section className="card">
        <h2>Marks (by Month)</h2>
        {tests.length===0 && <p>No marks yet.</p>}
        {(() => {
          // transform tests into per-subject entries and group by month
          const entries = []
          tests.forEach(t => {
            const id = t.id || t._id
            const date = t.date
            Object.entries(t.marks || {}).forEach(([sub, m]) => {
              const obtained = m?.obtained ?? m ?? 0
              const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
              const d = new Date(date)
              const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
              entries.push({ id, date, monthKey, subject: sub, obtained, total })
            })
          })

          const grouped = entries.reduce((acc, e) => {
            acc[e.monthKey] = acc[e.monthKey] || []
            acc[e.monthKey].push(e)
            return acc
          }, {})

          const months = Object.keys(grouped).sort((a,b)=>b.localeCompare(a))

          // initialize selectedMonth to latest available month
          if(months.length && !selectedMonth) setSelectedMonth(months[0])

          function toReadable(mKey){
            try{
              const d = new Date(mKey + '-01')
              return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
            }catch(e){ return mKey }
          }

          function prevMonth(){
            if(!months.length) return
            const cur = selectedMonth || months[0]
            const idx = months.indexOf(cur)
            const nextIdx = idx === -1 ? 0 : idx + 1
            if(nextIdx < months.length) setSelectedMonth(months[nextIdx])
          }

          function nextMonth(){
            if(!months.length) return
            const cur = selectedMonth || months[0]
            const idx = months.indexOf(cur)
            const prevIdx = idx === -1 ? 0 : idx - 1
            if(prevIdx >= 0){
              const key = months[prevIdx]
              // prevent navigating to future months beyond current month
              const now = new Date()
              const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
              if(key > currentKey) return
              setSelectedMonth(key)
            }
          }

          if(!months.length) return <p>No marks yet.</p>

          const rows = grouped[selectedMonth] || []

          return (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                <button onClick={prevMonth} aria-label="previous" disabled={(() => {
                  if(!months.length) return true
                  const cur = selectedMonth || months[0]
                  const idx = months.indexOf(cur)
                  return idx === -1 || idx === months.length-1
                })()}>&lt;</button>
                <strong style={{ minWidth:220, textAlign:'center' }}>{toReadable(selectedMonth || months[0])}</strong>
                <button onClick={nextMonth} aria-label="next" disabled={(() => {
                  if(!months.length) return true
                  const cur = selectedMonth || months[0]
                  const idx = months.indexOf(cur)
                  if(idx <= 0) return true
                  const now = new Date()
                  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
                  return (cur >= currentKey)
                })()}>&gt;</button>
              </div>
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Subject</th><th>Obtained</th><th>Total</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const key = `${row.id}_${row.subject}`
                    const isEditing = !!editingRows[key]
                    const editState = editingRows[key] || { obtained: row.obtained, total: row.total }
                    return (
                      <tr key={row.id + '_' + row.subject + '_' + row.date}>
                        <td>{new Date(row.date).toLocaleDateString()}</td>
                        <td>{row.subject}</td>
                        <td>
                          {isEditing ? (
                            <input type="number" min="0" className="input" style={{ width:90 }} value={editState.obtained} onChange={e=> setEditingRows(prev=>({ ...prev, [key]: { ...prev[key], obtained: e.target.value } }))} />
                          ) : (
                            row.obtained
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input type="number" min="0" className="input" style={{ width:90 }} value={editState.total} onChange={e=> setEditingRows(prev=>({ ...prev, [key]: { ...prev[key], total: e.target.value } }))} />
                          ) : (
                            row.total
                          )}
                        </td>
                        <td style={{ display:'flex', gap:6 }}>
                          {isEditing ? (
                            <>
                              <button onClick={async ()=>{
                                // save edit
                                const obtained = Number(editingRows[key].obtained) || 0
                                const total = Number(editingRows[key].total) || 0
                                // update local state
                                const updated = tests.map(t=> {
                                  if(t.id !== row.id) return t
                                  const marks = { ...t.marks }
                                  marks[row.subject] = { obtained, total }
                                  return { ...t, marks }
                                })
                                setTests(updated)
                                try{
                                  await apiFetch(`/api/tests/${row.id}`, { method: 'PUT', body: JSON.stringify({ marks: updated.find(x=>x.id===row.id).marks, date: row.date }) })
                                  setEditingRows(prev=>{ const copy = { ...prev }; delete copy[key]; return copy })
                                }catch(err){
                                  console.error(err)
                                  alert('Failed to save')
                                }
                              }}>Save</button>
                              <button onClick={()=> setEditingRows(prev=>{ const copy={...prev}; delete copy[key]; return copy })}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={()=> setEditingRows(prev=>({ ...prev, [key]: { obtained: row.obtained, total: row.total } }))}>Edit</button>
                              <button onClick={()=>remove(row.id)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()
        }
      </section>

      <section className="card">
        <h2>Weekly Averages (selected month)</h2>
        {(!weeklyStats || weeklyStats.length===0) ? <p>No weekly stats for this month</p> : (
          <div>
            {weeklyStats.map(w=> (
              <div key={w.week} className="statRow">
                <strong>{formatWeekLabel(w.week)}</strong>
                {SUBJECTS.map(s=> (
                  <div key={s.key}>{s.label}: {w.stats.perSubject?.[s.key] != null ? `${w.stats.perSubject[s.key]}%` : '—'}</div>
                ))}
                <div>Overall: {w.stats.overall != null ? `${w.stats.overall}%` : '—'}</div>
              </div>
            ))}

            <div style={{ marginTop:8 }}>
              <strong>Cumulative (through selected month)</strong>
              {cumulativeWeekly.map(cw => (
                <div key={cw.week} style={{ marginTop:6 }}>
                  <em>{formatWeekLabel(cw.week)}</em>
                  {SUBJECTS.map(s=> (
                    <div key={s.key}>{s.label}: {cw.stats.perSubject?.[s.key] != null ? `${cw.stats.perSubject[s.key]}%` : '—'}</div>
                  ))}
                  <div><strong>Overall: {cw.stats.overall != null ? `${cw.stats.overall}%` : '—'}</strong></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Monthly Trend (history)</h2>
        {(!monthlyTrend || monthlyTrend.length===0) ? <p>No monthly data</p> : (
          <div>
            {monthlyTrend.map(m=> (
              <div key={m.month} className="statRow">
                <strong>{m.month}</strong>
                {SUBJECTS.map(s=> (
                  <div key={s.key}>{s.label}: {m.stats.perSubject?.[s.key] != null ? `${m.stats.perSubject[s.key]}%` : '—'}</div>
                ))}
                <div>Overall: {m.stats.overall != null ? `${m.stats.overall}%` : '—'}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Average (Overall)</h2>
        {(!stats.overall) ? <p>No data</p> : (
          <div className="statRow">
            {SUBJECTS.map(s=> (
              <div key={s.key}>{s.label}: {stats.overall.perSubject?.[s.key] != null ? `${stats.overall.perSubject[s.key]}%` : '—'}</div>
            ))}
            <div><strong>Overall: {stats.overall.overall != null ? `${stats.overall.overall}%` : '—'}</strong></div>
          </div>
        )}
      </section>

    </div>
  )
}
