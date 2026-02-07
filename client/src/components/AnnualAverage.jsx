import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { weeklyAndMonthlyStats } from '../utils/stats'
import { apiFetch } from '../utils/api'
import { SUBJECTS } from '../utils/subjects'
import { getCurrentUser } from '../utils/auth'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AnnualAverage({ darkMode, setDarkMode }) {
    const [tests, setTests] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedYear, setSelectedYear] = useState(null)
    const navigate = useNavigate()
    const user = getCurrentUser()

    useEffect(() => {
        let mounted = true
        apiFetch('/api/tests').then(data => {
            if (!mounted) return
            if (Array.isArray(data)) setTests(data.map(t => ({ ...t, id: t._id })))
            setLoading(false)
        }).catch(err => {
            console.error(err)
            setLoading(false)
        })
        return () => { mounted = false }
    }, [])

    const allTimeStats = useMemo(() => weeklyAndMonthlyStats(tests), [tests])
    const annual = allTimeStats.annual || []

    useEffect(() => {
        if (annual.length > 0 && !selectedYear) {
            setSelectedYear(annual[0].year)
        }
    }, [annual, selectedYear])

    const currentYearStats = useMemo(() => {
        return annual.find(a => a.year === selectedYear) || annual[0] || null
    }, [annual, selectedYear])

    const years = useMemo(() => annual.map(a => a.year), [annual])

    // Calculate monthly progression data for the selected year
    const monthlyChartData = useMemo(() => {
        if (!selectedYear || !tests.length) return []

        // Filter tests for selected year and group by month
        const yearTests = tests.filter(t => {
            const d = new Date(t.date)
            return String(d.getFullYear()) === String(selectedYear)
        })

        if (yearTests.length === 0) return []

        // Group by month
        const byMonth = {}
        yearTests.forEach(t => {
            const d = new Date(t.date)
            const monthKey = d.getMonth() // 0-11
            if (!byMonth[monthKey]) byMonth[monthKey] = []
            byMonth[monthKey].push(t)
        })

        // Calculate averages for each month
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const chartData = []

        Object.keys(byMonth).sort((a, b) => Number(a) - Number(b)).forEach(monthKey => {
            const monthTests = byMonth[monthKey]
            const dataPoint = { month: monthNames[monthKey] }

            // Calculate average for each subject
            SUBJECTS.forEach(subject => {
                const subjectTests = monthTests.filter(t => t.marks && t.marks[subject.key])
                if (subjectTests.length > 0) {
                    const scores = subjectTests.map(t => {
                        const m = t.marks[subject.key]
                        const obtained = m?.obtained ?? m ?? 0
                        const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
                        return total > 0 ? (obtained / total) * 100 : 0
                    })
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
                    dataPoint[subject.key] = Math.round(avg * 10) / 10
                }
            })

            chartData.push(dataPoint)
        })

        return chartData
    }, [tests, selectedYear])

    // Calculate top 3 tests and best month for the selected year
    const bestPerformance = useMemo(() => {
        if (!selectedYear || !tests.length) return { topTests: [], bestMonth: null }

        // Filter tests for selected year
        const yearTests = tests.filter(t => {
            const d = new Date(t.date)
            return String(d.getFullYear()) === String(selectedYear)
        })

        if (yearTests.length === 0) return { topTests: [], bestMonth: null }

        // Calculate overall percentage for each test
        const testsWithScores = yearTests.map(test => {
            const subjects = Object.entries(test.marks || {})
            if (subjects.length === 0) return null

            let totalScore = 0
            let count = 0

            subjects.forEach(([subKey, m]) => {
                const obtained = m?.obtained ?? m ?? 0
                const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
                if (total > 0) {
                    totalScore += (obtained / total) * 100
                    count++
                }
            })

            const overallPct = count > 0 ? totalScore / count : 0

            // Find the best subject in this test
            let bestSubject = null
            let bestSubjectScore = 0
            subjects.forEach(([subKey, m]) => {
                const obtained = m?.obtained ?? m ?? 0
                const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
                const pct = total > 0 ? (obtained / total) * 100 : 0
                if (pct > bestSubjectScore) {
                    bestSubjectScore = pct
                    const subjectObj = SUBJECTS.find(s => s.key === subKey)
                    bestSubject = { name: subjectObj?.label || subKey, score: pct, obtained, total }
                }
            })

            return {
                ...test,
                overallPct: Math.round(overallPct * 10) / 10,
                bestSubject
            }
        }).filter(t => t !== null)

        // Get top 3 tests
        const topTests = testsWithScores
            .sort((a, b) => b.overallPct - a.overallPct)
            .slice(0, 3)

        // Calculate best month
        const monthlyData = {}
        yearTests.forEach(t => {
            const d = new Date(t.date)
            const monthKey = d.getMonth()
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { tests: [], month: monthKey }
            }
            monthlyData[monthKey].tests.push(t)
        })

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

        const monthsWithAvg = Object.values(monthlyData).map(({ month, tests: monthTests }) => {
            let totalScore = 0
            let count = 0

            monthTests.forEach(test => {
                Object.entries(test.marks || {}).forEach(([_, m]) => {
                    const obtained = m?.obtained ?? m ?? 0
                    const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
                    if (total > 0) {
                        totalScore += (obtained / total) * 100
                        count++
                    }
                })
            })

            const avg = count > 0 ? totalScore / count : 0
            return {
                month: monthNames[month],
                monthKey: month,
                average: Math.round(avg * 10) / 10,
                testCount: monthTests.length
            }
        })

        const topMonths = monthsWithAvg.length > 0
            ? monthsWithAvg.sort((a, b) => b.average - a.average).slice(0, 3)
            : []

        return { topTests, topMonths }
    }, [tests, selectedYear])

    function goBack() {
        if (user?.role === 'teacher') navigate('/teacher')
        else navigate('/student')
    }

    return (
        <div className="page">
            <header className="header" style={{ marginBottom: 24 }}>
                <h1>Annual Performance</h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span>{user?.username}</span>
                    <button onClick={() => setDarkMode(!darkMode)} className="btn" title={darkMode ? 'Light Mode' : 'Dark Mode'}>
                        {darkMode ? '☀️' : '🌙'}
                    </button>
                    <button onClick={goBack} className="btn primary">Back to Dashboard</button>
                </div>
            </header>

            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading stats...</p>
                </div>
            ) : annual.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <h3>No stats available yet.</h3>
                    <p className="hint">Start adding marks to see your annual performance.</p>
                    <button onClick={goBack} className="btn primary" style={{ marginTop: 16 }}>Back</button>
                </div>
            ) : (
                <>
                    <section className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ margin: 0 }}>Yearly Overview</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button
                                    onClick={() => {
                                        const idx = years.indexOf(selectedYear)
                                        if (idx < years.length - 1) setSelectedYear(years[idx + 1])
                                    }}
                                    className="btn"
                                    disabled={years.indexOf(selectedYear) >= years.length - 1}
                                >
                                    &lt; Previous Year
                                </button>
                                <strong style={{ fontSize: '1.2rem', minWidth: 100, textAlign: 'center' }}>{selectedYear}</strong>
                                <button
                                    onClick={() => {
                                        const idx = years.indexOf(selectedYear)
                                        if (idx > 0) setSelectedYear(years[idx - 1])
                                    }}
                                    className="btn"
                                    disabled={years.indexOf(selectedYear) <= 0}
                                >
                                    Next Year &gt;
                                </button>
                            </div>
                        </div>

                        <div className="stat-grid">
                            {SUBJECTS.map(s => {
                                const score = currentYearStats?.stats.perSubject?.[s.key]
                                return (
                                    <div key={s.key} className="stat-card">
                                        <div className="stat-label">{s.label}</div>
                                        <div className="stat-value" style={{ opacity: score != null ? 1 : 0.3 }}>
                                            {score != null ? `${score}%` : '—'}
                                        </div>
                                    </div>
                                )
                            })}
                            <div className="stat-card" style={{
                                background: 'var(--accent-soft)',
                                borderColor: 'var(--accent)',
                                gridColumn: '1 / -1',
                                marginTop: '16px'
                            }}>
                                <div className="stat-label" style={{ color: 'var(--accent)', fontSize: '1rem' }}>Overall Year Average</div>
                                <div className="stat-value" style={{ fontSize: '3.5rem', textShadow: '0 4px 12px var(--accent-soft)' }}>
                                    {currentYearStats?.stats.overall != null ? `${currentYearStats.stats.overall}%` : '—'}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <h2>🏆 Best Performance of {selectedYear}</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '20px' }}>
                            {/* Top 3 Tests */}
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--accent)' }}>Top 3 Tests</h3>
                                {bestPerformance.topTests.length === 0 ? (
                                    <p className="hint">No tests available for this year.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {bestPerformance.topTests.map((test, index) => (
                                            <div key={test.id} style={{
                                                padding: '16px',
                                                background: index === 0 ? 'linear-gradient(135deg, var(--accent-soft) 0%, var(--card-bg) 100%)' : 'var(--bg)',
                                                border: `2px solid ${index === 0 ? 'var(--accent)' : 'var(--border)'}`,
                                                borderRadius: '12px',
                                                position: 'relative'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '1.5rem' }}>
                                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                                        </span>
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>
                                                                {test.bestSubject?.name || 'Test'}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                                {new Date(test.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: index === 0 ? 'var(--accent)' : 'var(--text)' }}>
                                                            {test.overallPct}%
                                                        </div>
                                                        {test.bestSubject && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                                                                {Math.round(test.bestSubject.obtained)}/{test.bestSubject.total}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Top 3 Months */}
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--accent)' }}>Top 3 Months</h3>
                                {bestPerformance.topMonths.length === 0 ? (
                                    <p className="hint">No monthly data available.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {bestPerformance.topMonths.map((monthData, index) => (
                                            <div key={monthData.monthKey} style={{
                                                padding: '16px',
                                                background: index === 0 ? 'linear-gradient(135deg, var(--accent-soft) 0%, var(--card-bg) 100%)' : 'var(--bg)',
                                                border: `2px solid ${index === 0 ? 'var(--accent)' : 'var(--border)'}`,
                                                borderRadius: '12px'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '1.5rem' }}>
                                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                                        </span>
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '1.1rem' }}>
                                                                {monthData.month}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                                {monthData.testCount} test{monthData.testCount !== 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: index === 0 ? 'var(--accent)' : 'var(--text)' }}>
                                                        {monthData.average}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="card">
                        <h2>Monthly Performance Progression</h2>
                        {monthlyChartData.length === 0 ? (
                            <p className="hint">No monthly data available for {selectedYear}. Add marks across different months to see the progression.</p>
                        ) : (
                            <div style={{ width: '100%', height: 400, marginTop: 20 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={monthlyChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis
                                            dataKey="month"
                                            stroke="var(--text)"
                                            style={{ fontSize: '0.875rem' }}
                                        />
                                        <YAxis
                                            domain={[0, 100]}
                                            stroke="var(--text)"
                                            style={{ fontSize: '0.875rem' }}
                                            label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', style: { fill: 'var(--text)' } }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--card-bg)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                color: 'var(--text)'
                                            }}
                                            formatter={(value) => `${value}%`}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '0.875rem', color: 'var(--text)' }}
                                        />
                                        {SUBJECTS.map((subject, index) => {
                                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
                                            return (
                                                <Line
                                                    key={subject.key}
                                                    type="monotone"
                                                    dataKey={subject.key}
                                                    name={subject.label}
                                                    stroke={colors[index % colors.length]}
                                                    strokeWidth={2}
                                                    dot={{ r: 4 }}
                                                    activeDot={{ r: 6 }}
                                                />
                                            )
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    )
}
