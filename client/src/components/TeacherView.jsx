import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { weeklyAndMonthlyStats, calculateConsistency } from '../utils/stats'
import { logout, getCurrentUser } from '../utils/auth'
import { apiFetch } from '../utils/api'
import { SUBJECTS, SUBJECT_KEYS } from '../utils/subjects'

export default function TeacherView({ darkMode, setDarkMode }) {
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [weekNum, setWeekNum] = useState('1')
  const [subject, setSubject] = useState(SUBJECT_KEYS[0])
  const emptyMarks = SUBJECT_KEYS.reduce((acc, k) => (acc[k] = { obtained: '', total: '' }, acc), {})
  const [marks, setMarks] = useState(emptyMarks)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // initialize selected month from existing tests if any
    try {
      const entries = []
      // tests may be empty at first; return null
      return null
    } catch (e) { return null }
  })
  const [editingRows, setEditingRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [showConsistencyInfo, setShowConsistencyInfo] = useState(false)

  useEffect(() => {
    // load from API
    let mounted = true
    // Delay loading slightly to not compete with login
    const timer = setTimeout(() => {
      apiFetch('/api/tests').then(data => {
        if (!mounted) return
        if (Array.isArray(data)) setTests(data.map(t => ({ ...t, id: t._id })))
        setLoading(false)
      }).catch(err => {
        console.error(err)
        setLoading(false)
      })
    }, 100) // Reduced from 500ms

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  async function addTest() {
    const payload = { date: new Date(date).toISOString(), marks: {} }
    // Only include the selected subject's marks
    const obj = marks[subject] || {}
    const obtained = Number(obj.obtained) || 0
    const total = Number(obj.total) || 0
    payload.marks[subject] = { obtained, total }
    payload.week = Number(weekNum)
    try {
      const created = await apiFetch('/api/tests', { method: 'POST', body: JSON.stringify(payload) })
      const next = [{ ...created, id: created._id }, ...tests]
      setTests(next)
      setMarks(emptyMarks)
    } catch (err) {
      console.error(err)
      alert('Failed to add test')
    }
  }

  async function remove(id) {
    try {
      await apiFetch(`/api/tests/${id}`, { method: 'DELETE' })
      setTests(tests.filter(t => t.id !== id))
    } catch (err) {
      console.error(err)
      alert('Failed to delete')
    }
  }

  async function editMark(id, subject, field, value) {
    const updated = tests.map(t => {
      if (t.id !== id) return t
      const marks = { ...t.marks }
      const obj = { ...(marks[subject] || {}) }
      obj[field] = Number(value) || 0
      marks[subject] = obj
      return { ...t, marks }
    })
    setTests(updated)
    const t = updated.find(x => x.id === id)
    try {
      await apiFetch(`/api/tests/${id}`, { method: 'PUT', body: JSON.stringify({ marks: t.marks, date: t.date }) })
    } catch (err) {
      console.error(err)
      alert('Failed to save')
    }
  }

  function doLogout() {
    logout()
    window.location.href = '/login'
  }

  // compute stats only for the selected month (if set), otherwise use all tests
  const filteredTests = React.useMemo(() => {
    if (!tests.length || !selectedMonth) return []
    return tests.filter(t => {
      const d = new Date(t.date)
      const monKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return monKey === selectedMonth
    })
  }, [tests.length, selectedMonth]) // Optimize dependencies

  const stats = weeklyAndMonthlyStats(filteredTests)

  // allTimeStats: compute overall stats across ALL tests (all months)
  const allTimeStats = React.useMemo(() => {
    return weeklyAndMonthlyStats(tests)
  }, [tests])

  // weeklyStats (for selected month) and cumulative per-week averages
  const weeklyStats = stats.weekly || []
  const cumulativeWeekly = React.useMemo(() => {
    if (!weeklyStats || weeklyStats.length === 0) return []
    // sort weeklyStats ascending by week index (handle '-wN' or ISO date)
    const parseWeekIndex = (wk) => {
      const m = wk.match(/-w(\d+)$/)
      if (m) return Number(m[1])
      // fallback: use date string
      const d = new Date(wk)
      return d.getTime()
    }
    const sorted = [...weeklyStats].sort((a, b) => parseWeekIndex(a.week) - parseWeekIndex(b.week))
    const cum = []
    const subjAcc = {}
    let overallSum = 0, overallCount = 0
    sorted.forEach(s => {
      // s.stats.perSubject and s.stats.overall
      Object.entries(s.stats.perSubject || {}).forEach(([k, v]) => {
        subjAcc[k] = subjAcc[k] || { sum: 0, count: 0 }
        subjAcc[k].sum += v
        subjAcc[k].count += 1
      })
      if (typeof s.stats.overall === 'number') {
        overallSum += s.stats.overall
        overallCount += 1
      }
      const perSubjectCum = {}
      Object.entries(subjAcc).forEach(([k, v]) => { perSubjectCum[k] = +(v.sum / v.count).toFixed(2) })
      const overallCum = overallCount > 0 ? +(overallSum / overallCount).toFixed(2) : null
      cum.push({ week: s.week, stats: { perSubject: perSubjectCum, overall: overallCum } })
    })
    return cum
  }, [weeklyStats])

  function formatWeekLabel(wk) {
    // Always show week number (Week 1..5). Prefer explicit t.week when available.
    try {
      for (const t of filteredTests) {
        const d = new Date(t.date)
        let testWeekKey
        if (t.week && Number.isInteger(Number(t.week))) {
          testWeekKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-w${t.week}`
          if (String(testWeekKey) === String(wk)) return `Week ${t.week}`
        }
      }
    } catch (e) {/* ignore */ }

    // If wk is a week-of-month key like YYYY-MM-wN
    const m = String(wk).match(/-w(\d+)$/)
    if (m) return `Week ${m[1]}`

    // If wk is an ISO week-start date, compute week-of-month from its day
    const d = new Date(wk)
    if (!Number.isNaN(d.getTime())) {
      const day = d.getDate()
      const weekOfMonth = Math.floor((day - 1) / 7) + 1
      return `Week ${weekOfMonth}`
    }

    return String(wk)
  }

  // Compute available months from tests
  const months = React.useMemo(() => {
    const entries = []
    tests.forEach(t => {
      const date = t.date
      Object.entries(t.marks || {}).forEach(([sub, m]) => {
        const d = new Date(date)
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        entries.push(monthKey)
      })
    })
    return Array.from(new Set(entries)).sort((a, b) => b.localeCompare(a))
  }, [tests])

  useEffect(() => {
    // when tests change, ensure we have a selected month (prefer latest)
    if (months.length && !selectedMonth) setSelectedMonth(months[0])
  }, [months, selectedMonth])

  // Annual selection
  const [selectedYear, setSelectedYear] = useState(null)

  // Update annual helper when allTimeStats changes
  useEffect(() => {
    if (allTimeStats.annual && allTimeStats.annual.length > 0 && !selectedYear) {
      setSelectedYear(allTimeStats.annual[0].year)
    }
  }, [allTimeStats, selectedYear])

  function toReadable(mKey) {
    try {
      const d = new Date(mKey + '-01')
      return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    } catch (e) { return mKey }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Teacher Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, color: 'var(--muted)' }}>{getCurrentUser()?.username}</span>
          <button onClick={() => setDarkMode(!darkMode)} className="theme-toggle" title={darkMode ? 'Light Mode' : 'Dark Mode'} style={{ position: 'static' }}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={doLogout} className="btn">Logout</button>
        </div>
      </header>

      <section className="card">
        <h2><span style={{ color: 'var(--accent)' }}>+</span> Add Marks</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <label>Date
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>Week of Month
            <select className="input" value={weekNum} onChange={e => setWeekNum(e.target.value)}>
              <option value="1">Week 1</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
              <option value="5">Week 5</option>
            </select>
          </label>
          <label>Subject
            <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', maxWidth: '400px' }}>
          <label>Obtained
            <input className="input" type="number" min="0" placeholder="scored" value={marks[subject].obtained} onChange={e => setMarks(prev => ({ ...prev, [subject]: { ...prev[subject], obtained: e.target.value } }))} />
          </label>
          <label>Total
            <input className="input" type="number" min="0" placeholder="out of" value={marks[subject].total} onChange={e => setMarks(prev => ({ ...prev, [subject]: { ...prev[subject], total: e.target.value } }))} />
          </label>
        </div>

        <div style={{ marginTop: '20px' }}>
          <button onClick={addTest} className="btn primary">Add Test Marks</button>
        </div>
      </section>

      <section className="card">
        <h2>Marks History</h2>
        {loading ? <p className="hint">Loading marks...</p> : tests.length === 0 && <p className="hint">No marks recorded yet.</p>}
        {(() => {
          const entries = []
          tests.forEach(t => {
            const id = t.id || t._id
            const date = t.date
            Object.entries(t.marks || {}).forEach(([sub, m]) => {
              const obtained = m?.obtained ?? m ?? 0
              const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
              const d = new Date(date)
              const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              entries.push({ id, date, monthKey, subject: sub, obtained, total })
            })
          })

          const grouped = entries.reduce((acc, e) => {
            acc[e.monthKey] = acc[e.monthKey] || []
            acc[e.monthKey].push(e)
            return acc
          }, {})

          const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

          function prevMonth() {
            if (!months.length || !selectedMonth) return
            const idx = months.indexOf(selectedMonth)
            if (idx < months.length - 1) setSelectedMonth(months[idx + 1])
          }

          function nextMonth() {
            if (!months.length || !selectedMonth) return
            const idx = months.indexOf(selectedMonth)
            if (idx > 0) setSelectedMonth(months[idx - 1])
          }

          if (!months.length) return null

          const rows = grouped[selectedMonth] || []

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <button onClick={prevMonth} className="btn" disabled={!selectedMonth || selectedMonth === months[months.length - 1]}>&larr; Prev</button>
                <strong style={{ fontSize: '1.1rem', minWidth: '180px', textAlign: 'center' }}>{toReadable(selectedMonth || months[0])}</strong>
                <button onClick={nextMonth} className="btn" disabled={!selectedMonth || selectedMonth === months[0]}>Next &rarr;</button>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Subject</th><th>Score</th><th>Total</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const key = `${row.id}_${row.subject}`
                      const isEditing = !!editingRows[key]
                      const editState = editingRows[key] || { obtained: row.obtained, total: row.total }
                      return (
                        <tr key={row.id + '_' + row.subject + '_' + row.date}>
                          <td style={{ color: 'var(--muted)' }}>{new Date(row.date).toLocaleDateString()}</td>
                          <td style={{ fontWeight: 500 }}>{row.subject}</td>
                          <td>
                            {isEditing ? (
                              <input type="number" min="0" className="input" style={{ width: 80, padding: '4px 8px' }} value={editState.obtained} onChange={e => setEditingRows(prev => ({ ...prev, [key]: { ...prev[key], obtained: e.target.value } }))} />
                            ) : (
                              row.obtained
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input type="number" min="0" className="input" style={{ width: 80, padding: '4px 8px' }} value={editState.total} onChange={e => setEditingRows(prev => ({ ...prev, [key]: { ...prev[key], total: e.target.value } }))} />
                            ) : (
                              row.total
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {isEditing ? (
                                <>
                                  <button className="btn primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={async () => {
                                    const obtained = Number(editingRows[key].obtained) || 0
                                    const total = Number(editingRows[key].total) || 0
                                    const updated = tests.map(t => {
                                      if (t.id !== row.id) return t
                                      const marks = { ...t.marks }
                                      marks[row.subject] = { obtained, total }
                                      return { ...t, marks }
                                    })
                                    setTests(updated)
                                    try {
                                      await apiFetch(`/api/tests/${row.id}`, { method: 'PUT', body: JSON.stringify({ marks: updated.find(x => x.id === row.id).marks, date: row.date }) })
                                      setEditingRows(prev => { const copy = { ...prev }; delete copy[key]; return copy })
                                    } catch (err) { alert('Failed to save') }
                                  }}>Save</button>
                                  <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setEditingRows(prev => { const copy = { ...prev }; delete copy[key]; return copy })}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setEditingRows(prev => ({ ...prev, [key]: { obtained: row.obtained, total: row.total } }))}>Edit</button>
                                  <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--error)' }} onClick={() => remove(row.id)}>Delete</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </section>

      <section className="card">
        <h2>Monthly Averages</h2>
        {(!stats.monthly || stats.monthly.length === 0) ? <p className="hint">No monthly stats for selected month.</p> : (
          <div>
            {stats.monthly.map(m => (
              <div key={m.month} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Month {m.month}</h3>
                </div>
                <div className="stat-grid">
                  {SUBJECTS.map(s => (
                    <div key={s.key} className="stat-card">
                      <div className="stat-label">{s.label}</div>
                      <div className="stat-value">{m.stats.perSubject?.[s.key] != null ? `${m.stats.perSubject[s.key]}%` : '—'}</div>
                    </div>
                  ))}
                  <div className="stat-card" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
                    <div className="stat-label" style={{ color: 'var(--accent)' }}>Month Average</div>
                    <div className="stat-value" style={{ color: 'var(--accent)' }}>{m.stats.overall != null ? `${m.stats.overall}%` : '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        <section className="card">
          <h2
            onClick={() => navigate('/subject-progress')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>Progress by Subject</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}>View Details &rarr;</span>
          </h2>
          {tests.length === 0 ? <p className="hint">No data available yet.</p> : (() => {
            // Calculate subject progress rate using linear regression
            const subjectStats = SUBJECTS.map(subject => {
              const subjectTests = tests.filter(t => t.marks && t.marks[subject.key])

              if (subjectTests.length === 0) {
                return { subject: subject.key, label: subject.label, progressRate: null, count: 0 }
              }

              const scores = subjectTests.map(t => {
                const m = t.marks[subject.key]
                const obtained = m?.obtained ?? m ?? 0
                const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
                return total > 0 ? (obtained / total) * 100 : 0
              })

              // Calculate progress rate using linear regression
              let progressRate = null
              if (scores.length >= 2) {
                const n = scores.length
                let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0

                scores.forEach((score, index) => {
                  sumX += index
                  sumY += score
                  sumXY += index * score
                  sumXX += index * index
                })

                const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
                progressRate = Math.round(slope * 100) / 100
              }

              return {
                subject: subject.key,
                label: subject.label,
                progressRate,
                count: subjectTests.length
              }
            })

            const getProgressColor = (rate) => {
              if (rate === null) return 'var(--muted)'
              if (rate > 0) return '#22c55e'
              if (rate < 0) return '#ef4444'
              return 'var(--muted)'
            }

            const getProgressIcon = (rate) => {
              if (rate === null) return ''
              if (rate > 0) return '📈 '
              if (rate < 0) return '📉 '
              return '➡️ '
            }

            return (
              <div className="stat-grid">
                {subjectStats.map(s => (
                  <div key={s.subject} className="stat-card">
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{
                      opacity: s.progressRate != null ? 1 : 0.3,
                      color: getProgressColor(s.progressRate),
                      fontSize: '1.5rem'
                    }}>
                      {s.progressRate != null
                        ? `${getProgressIcon(s.progressRate)}${s.progressRate > 0 ? '+' : ''}${s.progressRate}%`
                        : '—'
                      }
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                      {s.progressRate != null ? 'per test • ' : ''}{s.count} test{s.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </section>

        <section className="card" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Consistency Score</h2>
            <div
              onMouseEnter={() => setShowConsistencyInfo(true)}
              style={{ display: 'inline-block', cursor: 'pointer' }}
            >
              <button
                onClick={() => setShowConsistencyInfo(true)}
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  pointerEvents: 'none'
                }}
                title="What does this mean?"
              >
                ?
              </button>
            </div>
          </div>

          {tests.length === 0 ? <p className="hint">No data available.</p> : (
            <div className="stat-grid">
              {calculateConsistency(tests).map(stat => (
                <div key={stat.subject} className="stat-card" style={{ borderColor: stat.color }}>
                  <div className="stat-label">{stat.subject}</div>
                  <div className="stat-value" style={{ color: stat.color, fontSize: '1.2rem' }}>
                    {stat.status}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                    Variation: ±{stat.variation}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {showConsistencyInfo && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }} onClick={() => setShowConsistencyInfo(false)}>
              <div style={{
                background: 'var(--card-bg)',
                padding: '24px',
                borderRadius: '12px',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                position: 'relative'
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>Understanding Consistency</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  This score measures how much marks vary from test to test (Standard Deviation).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }}></div>
                    <div>
                      <strong>Very Stable</strong> (±0-5%)
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Excellent consistency.</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)' }}></div>
                    <div>
                      <strong>Consistent</strong> (±5-10%)
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Good steady performance.</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#eab308' }}></div>
                    <div>
                      <strong>Variable</strong> (±10-15%)
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Performance fluctuates noticeably.</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
                    <div>
                      <strong>Volatile</strong> ({'>'}15%)
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Highly unstable performance.</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowConsistencyInfo(false)}
                  className="btn primary"
                  style={{ width: '100%', marginTop: '20px' }}
                >
                  Got it
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2
          onClick={() => navigate('/annual-average')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>Annual Performance <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}> (Selected Year: {selectedYear}) </span></span>
          <span style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}>Detailed Analysis &rarr;</span>
        </h2>
        {(() => {
          const annual = allTimeStats.annual || []
          if (!annual.length) return <p className="hint">No annual stats available yet.</p>

          const years = annual.map(a => a.year)
          const currentYearStats = annual.find(a => a.year === selectedYear) || annual[0]

          function prevYear() {
            const idx = years.indexOf(selectedYear)
            if (idx < years.length - 1) setSelectedYear(years[idx + 1])
          }

          function nextYear() {
            const idx = years.indexOf(selectedYear)
            if (idx > 0) setSelectedYear(years[idx - 1])
          }

          if (!currentYearStats) return null

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
                <button onClick={prevYear} className="btn" disabled={years.indexOf(selectedYear) >= years.length - 1}>&larr;</button>
                <strong style={{ fontSize: '1.2rem', minWidth: '100px', textAlign: 'center' }}>{currentYearStats.year}</strong>
                <button onClick={nextYear} className="btn" disabled={years.indexOf(selectedYear) <= 0}>&rarr;</button>
              </div>
              <div className="stat-grid">
                {SUBJECTS.map(s => (
                  <div key={s.key} className="stat-card">
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value">{currentYearStats.stats.perSubject?.[s.key] != null ? `${currentYearStats.stats.perSubject[s.key]}%` : '—'}</div>
                  </div>
                ))}
                <div className="stat-card" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
                  <div className="stat-label" style={{ color: 'var(--accent)' }}>Overall Year</div>
                  <div className="stat-value" style={{ color: 'var(--accent)' }}>{currentYearStats.stats.overall != null ? `${currentYearStats.stats.overall}%` : '—'}</div>
                </div>
              </div>
            </div>
          )
        })()}
      </section>

      <section className="card">
        <h2>All-Time Stats (Overall)</h2>
        {(!allTimeStats.overall) ? <p className="hint">No data.</p> : (
          <div className="stat-grid">
            {SUBJECTS.map(s => (
              <div key={s.key} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{allTimeStats.overall.perSubject?.[s.key] != null ? `${allTimeStats.overall.perSubject[s.key]}%` : '—'}</div>
              </div>
            ))}
            <div className="stat-card" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
              <div className="stat-label" style={{ color: 'var(--muted)' }}>Grand Total</div>
              <div className="stat-value" style={{ color: 'inherit' }}>{allTimeStats.overall.overall != null ? `${allTimeStats.overall.overall}%` : '—'}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
