import React, { useEffect, useState } from 'react'
import { weeklyAndMonthlyStats } from '../utils/stats'
import { logout, getCurrentUser } from '../utils/auth'
import { apiFetch } from '../utils/api'
import { SUBJECTS } from '../utils/subjects'

export default function StudentView(){
  const [tests, setTests] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null)

  useEffect(()=>{
    let mounted = true
    apiFetch('/api/tests').then(data=>{
      if(!mounted) return
      if(Array.isArray(data)) setTests(data.map(t=> ({ ...t, id: t._id })))
    }).catch(err=> console.error(err))
    return ()=> mounted = false
  },[])

  function doLogout(){
    logout()
    window.location.href = '/login'
  }

  // prepare month-grouped entries once
  const entries = React.useMemo(() => {
    const arr = []
    tests.forEach(t => {
      const id = t.id || t._id
      const date = t.date
      Object.entries(t.marks || {}).forEach(([sub, m]) => {
        const obtained = m?.obtained ?? m ?? 0
        const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
        const d = new Date(date)
        const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        arr.push({ id, date, monthKey, subject: sub, obtained, total })
      })
    })
    return arr
  }, [tests])

  const grouped = React.useMemo(() => {
    return entries.reduce((acc, e) => {
      acc[e.monthKey] = acc[e.monthKey] || []
      acc[e.monthKey].push(e)
      return acc
    }, {})
  }, [entries])

  const months = React.useMemo(() => Object.keys(grouped).sort((a,b)=>b.localeCompare(a)), [grouped])

  useEffect(()=>{
    if(months.length && !selectedMonth) setSelectedMonth(months[0])
  }, [months])

  const filteredTests = React.useMemo(()=>{
    if(!selectedMonth) return []
    return tests.filter(t => {
      const d = new Date(t.date)
      const monKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      return monKey === selectedMonth
    })
  }, [tests, selectedMonth])

  const stats = weeklyAndMonthlyStats(filteredTests)
  // monthlyTrend: show history across all months
  const monthlyTrend = React.useMemo(() => weeklyAndMonthlyStats(tests).monthly || [], [tests])

  const weeklyStats = stats.weekly || []
  const cumulativeWeekly = React.useMemo(() => {
    if(!weeklyStats || weeklyStats.length===0) return []
    const parseWeekIndex = (wk) => {
      const m = wk.match(/-w(\d+)$/)
      if(m) return Number(m[1])
      const d = new Date(wk)
      return d.getTime()
    }
    const sorted = [...weeklyStats].sort((a,b)=> parseWeekIndex(a.week) - parseWeekIndex(b.week))
    const cum = []
    const subjAcc = {}
    let overallSum = 0, overallCount = 0
    sorted.forEach(s => {
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
    // Always return Week N. Prefer explicit t.week when available in filteredTests.
    try{
      for(const t of filteredTests){
        const d = new Date(t.date)
        if(t.week && Number.isInteger(Number(t.week))){
          const testWeekKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-w${t.week}`
          if(String(testWeekKey) === String(wk)) return `Week ${t.week}`
        }
      }
    }catch(e){/* ignore */}

    const m = String(wk).match(/-w(\d+)$/)
    if(m) return `Week ${m[1]}`
    const d = new Date(wk)
    if(!Number.isNaN(d.getTime())){
      const day = d.getDate()
      const weekOfMonth = Math.floor((day - 1) / 7) + 1
      return `Week ${weekOfMonth}`
    }
    return String(wk)
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Student Dashboard</h1>
        <div>
          <span>{getCurrentUser()?.username}</span>
          <button onClick={doLogout}>Logout</button>
        </div>
      </header>

      <section className="card">
          <h2>Marks (by Month)</h2>
          {tests.length===0 && <p>No marks yet.</p>}
          {(() => {
            if(!months.length) return <p>No marks yet.</p>

            function toReadable(mKey){ try{ const d = new Date(mKey + '-01'); return d.toLocaleString(undefined, { month: 'long', year: 'numeric' }) }catch(e){ return mKey } }

            function prev(){
              if(!months.length) return
              const cur = selectedMonth || months[0]
              const idx = months.indexOf(cur)
              const nextIdx = idx === -1 ? 0 : idx + 1
              if(nextIdx < months.length) setSelectedMonth(months[nextIdx])
            }

            function next(){
              if(!months.length) return
              const cur = selectedMonth || months[0]
              const idx = months.indexOf(cur)
              const prevIdx = idx === -1 ? 0 : idx - 1
              if(prevIdx >= 0){
                const key = months[prevIdx]
                const now = new Date()
                const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
                if(key > currentKey) return
                setSelectedMonth(key)
              }
            }

            const rows = grouped[selectedMonth] || []

            return (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                  <button onClick={prev} aria-label="previous" disabled={(() => {
                    if(!months.length) return true
                    const cur = selectedMonth || months[0]
                    const idx = months.indexOf(cur)
                    return idx === -1 || idx === months.length-1
                  })()}>&lt;</button>
                  <strong style={{ minWidth:220, textAlign:'center' }}>{toReadable(selectedMonth || months[0])}</strong>
                  <button onClick={next} aria-label="next" disabled={(() => {
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
                    <tr><th>Date</th><th>Subject</th><th>Obtained</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id + '_' + row.subject + '_' + row.date}>
                        <td>{new Date(row.date).toLocaleDateString()}</td>
                        <td>{row.subject}</td>
                        <td>{row.obtained}</td>
                        <td>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
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
        <h2>Monthly Averages</h2>
        {(!stats.monthly || stats.monthly.length===0) ? <p>No monthly stats</p> : (
          <div>
            {stats.monthly.map(m=> (
              <div key={m.month} className="statRow">
                <strong>Month {m.month}</strong>
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
