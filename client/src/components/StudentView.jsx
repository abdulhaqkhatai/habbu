import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { weeklyAndMonthlyStats, calculateConsistency } from '../utils/stats'
import { logout, getCurrentUser } from '../utils/auth'
import { apiFetch } from '../utils/api'
import { SUBJECTS } from '../utils/subjects'

export default function StudentView({ darkMode, setDarkMode }) {
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showConsistencyInfo, setShowConsistencyInfo] = useState(false)

  useEffect(() => {
    let mounted = true
    // Delay loading slightly to not compete with login
    const timer = setTimeout(() => {
      apiFetch('/api/tests').then(data => {
        if (!mounted) return
        if (Array.isArray(data)) setTests(data.map(t => ({ ...t, id: t._id })))
        setLoading(false)
      }).catch(err => {
        ikconsole.error(err)
        setLoading(false)
      })
    }, 100) // Reduced from 500ms

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  function doLogout() {
    logout()
    window.location.href = '/login'
  }

  // prepare month-grouped entries once - optimize with better memoization
  const entries = React.useMemo(() => {
    if (!tests.length) return []
    const arr = []
    tests.forEach(t => {
      const id = t.id || t._id
      const date = t.date
      Object.entries(t.marks || {}).forEach(([sub, m]) => {
        const obtained = m?.obtained ?? m ?? 0
        const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
        const d = new Date(date)
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        arr.push({ id, date, monthKey, subject: sub, obtained, total })
      })
    })
    return arr
  }, [tests.length]) // Only depend on tests length, not full tests array

  const grouped = React.useMemo(() => {
    if (!entries.length) return {}
    return entries.reduce((acc, e) => {
      acc[e.monthKey] = acc[e.monthKey] || []
      acc[e.monthKey].push(e)
      return acc
    }, {})
  }, [entries.length]) // Only depend on entries length

  const months = React.useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped])

  useEffect(() => {
    if (months.length && !selectedMonth) setSelectedMonth(months[0])
  }, [months])

  const filteredTests = React.useMemo(() => {
    if (!selectedMonth) return []
    return tests.filter(t => {
      const d = new Date(t.date)
      const monKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return monKey === selectedMonth
    })
  }, [tests, selectedMonth])

  const stats = weeklyAndMonthlyStats(filteredTests)
  // allTimeStats: calculate overall stats across ALL tests (all months)
  const allTimeStats = React.useMemo(() => weeklyAndMonthlyStats(tests), [tests])

  // Annual selection
  const [selectedYear, setSelectedYear] = useState(null)

  // Update annual helper when allTimeStats changes
  useEffect(() => {
    if (allTimeStats.annual && allTimeStats.annual.length > 0 && !selectedYear) {
      setSelectedYear(allTimeStats.annual[0].year)
    }
  }, [allTimeStats, selectedYear])

  const weeklyStats = stats.weekly || []
  const cumulativeWeekly = React.useMemo(() => {
    if (!weeklyStats || weeklyStats.length === 0) return []
    const parseWeekIndex = (wk) => {
      const m = wk.match(/-w(\d+)$/)
      if (m) return Number(m[1])
      const d = new Date(wk)
      return d.getTime()
    }
    const sorted = [...weeklyStats].sort((a, b) => parseWeekIndex(a.week) - parseWeekIndex(b.week))
    const cum = []
    const subjAcc = {}
    let overallSum = 0, overallCount = 0
    sorted.forEach(s => {
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
    // Always return Week N. Prefer explicit t.week when available in filteredTests.
    try {
      for (const t of filteredTests) {
        const d = new Date(t.date)
        if (t.week && Number.isInteger(Number(t.week))) {
          const testWeekKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-w${t.week}`
          if (String(testWeekKey) === String(wk)) return `Week ${t.week}`
        }
      }
    } catch (e) {/* ignore */ }

    const m = String(wk).match(/-w(\d+)$/)
    if (m) return `Week ${m[1]}`
    const d = new Date(wk)
    if (!Number.isNaN(d.getTime())) {
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, color: 'var(--muted)' }}>{getCurrentUser()?.username}</span>
          <button onClick={() => setDarkMode(!darkMode)} className="theme-toggle" title={darkMode ? 'Light Mode' : 'Dark Mode'} style={{ position: 'static' }}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={doLogout} className="btn">Logout</button>
        </div>
      </header>

      <section className="card">
        <h2>Your Marks History</h2>
        {loading ? <p className="hint">Loading marks...</p> : tests.length === 0 && <p className="hint">No marks available yet.</p>}
        {(() => {
          if (!months.length) return null

          function toReadable(mKey) { try { const d = new Date(mKey + '-01'); return d.toLocaleString(undefined, { month: 'long', year: 'numeric' }) } catch (e) { return mKey } }

          function prev() {
            const idx = months.indexOf(selectedMonth)
            if (idx < months.length - 1) setSelectedMonth(months[idx + 1])
          }

          function next() {
            const idx = months.indexOf(selectedMonth)
            if (idx > 0) setSelectedMonth(months[idx - 1])
          }

          const rows = grouped[selectedMonth] || []

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <button onClick={prev} className="btn" disabled={!selectedMonth || selectedMonth === months[months.length - 1]}>&larr; Prev</button>
                <strong style={{ fontSize: '1.1rem', minWidth: '180px', textAlign: 'center' }}>{toReadable(selectedMonth || months[0])}</strong>
                <button onClick={next} className="btn" disabled={!selectedMonth || selectedMonth === months[0]}>Next &rarr;</button>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Subject</th><th>Obtained</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id + '_' + row.subject + '_' + row.date}>
                        <td style={{ color: 'var(--muted)' }}>{new Date(row.date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 500 }}>{row.subject}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{row.obtained}</td>
                        <td>{row.total}</td>
                      </tr>
                    ))}
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
                  pointerEvents: 'none' // Let parent handle events to prevent flickering or double triggers
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
          <span>Annual Review <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}> (Year: {selectedYear}) </span></span>
          <span style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}>In-depth Stats &rarr;</span>
        </h2>
        {(() => {
          const annual = allTimeStats.annual || []
          if (!annual.length) return <p className="hint">No annual data yet.</p>

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
                  <div className="stat-label" style={{ color: 'var(--accent)' }}>Yearly Average</div>
                  <div className="stat-value" style={{ color: 'var(--accent)' }}>{currentYearStats.stats.overall != null ? `${currentYearStats.stats.overall}%` : '—'}</div>
                </div>
              </div>
            </div>
          )
        })()}
      </section>

      <section className="card">
        <h2>Overall Academic Summary</h2>
        {(!allTimeStats.overall) ? <p className="hint">No overall data recorded.</p> : (
          <div className="stat-grid">
            {SUBJECTS.map(s => (
              <div key={s.key} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{allTimeStats.overall.perSubject?.[s.key] != null ? `${allTimeStats.overall.perSubject[s.key]}%` : '—'}</div>
              </div>
            ))}
            <div className="stat-card" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
              <div className="stat-label" style={{ color: 'var(--muted)' }}>Cumulative Overall</div>
              <div className="stat-value" style={{ color: 'inherit' }}>{allTimeStats.overall.overall != null ? `${allTimeStats.overall.overall}%` : '—'}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
