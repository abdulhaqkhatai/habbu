import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { weeklyAndMonthlyStats } from '../utils/stats'
import { apiFetch } from '../utils/api'
import { SUBJECTS } from '../utils/subjects'
import { getCurrentUser } from '../utils/auth'

export default function SubjectProgress({ darkMode, setDarkMode }) {
    const [tests, setTests] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedSubject, setSelectedSubject] = useState(null)
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

    // Calculate subject progress data
    const subjectProgressData = useMemo(() => {
        if (!tests.length) return []

        return SUBJECTS.map(subject => {
            // Filter tests that have this subject
            const subjectTests = tests.filter(t => t.marks && t.marks[subject.key])

            if (subjectTests.length === 0) {
                return {
                    subject: subject.key,
                    label: subject.label,
                    totalTests: 0,
                    averageScore: null,
                    highest: null,
                    lowest: null,
                    progressRate: null
                }
            }

            // Calculate statistics
            const scores = subjectTests.map(t => {
                const m = t.marks[subject.key]
                const obtained = m?.obtained ?? m ?? 0
                const total = m?.total ?? (typeof m === 'number' ? 100 : 0)
                return total > 0 ? (obtained / total) * 100 : 0
            })

            const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length
            const highest = Math.max(...scores)
            const lowest = Math.min(...scores)

            // Calculate progress rate using linear regression (slope of the trend line)
            // This gives us the rate of change in percentage points per test
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

                // Calculate slope (m) of the regression line: y = mx + b
                // Slope represents the average change in score per test
                const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
                progressRate = Math.round(slope * 100) / 100 // Round to 2 decimal places
            }

            return {
                subject: subject.key,
                label: subject.label,
                totalTests: subjectTests.length,
                averageScore: Math.round(averageScore * 10) / 10,
                highest: Math.round(highest * 10) / 10,
                lowest: Math.round(lowest * 10) / 10,
                progressRate
            }
        })
    }, [tests])

    useEffect(() => {
        if (SUBJECTS.length > 0 && !selectedSubject) {
            setSelectedSubject(SUBJECTS[0].key)
        }
    }, [selectedSubject])

    const currentSubjectData = useMemo(() => {
        return subjectProgressData.find(s => s.subject === selectedSubject) || null
    }, [subjectProgressData, selectedSubject])

    function goBack() {
        if (user?.role === 'teacher') navigate('/teacher')
        else navigate('/student')
    }

    const getProgressRateIcon = (rate) => {
        if (rate === null) return '—'
        if (rate > 0) return '📈'
        if (rate < 0) return '📉'
        return '➡️'
    }

    const getProgressRateColor = (rate) => {
        if (rate === null) return 'var(--muted)'
        if (rate > 0) return '#22c55e'
        if (rate < 0) return '#ef4444'
        return 'var(--muted)'
    }

    return (
        <div className="page">
            <header className="header" style={{ marginBottom: 24 }}>
                <h1>Subject Progress Analysis</h1>
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
            ) : tests.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <h3>No data available yet.</h3>
                    <p className="hint">Start adding marks to see your subject progress.</p>
                    <button onClick={goBack} className="btn primary" style={{ marginTop: 16 }}>Back</button>
                </div>
            ) : (
                <>
                    <section className="card">
                        <h2 style={{ marginBottom: 20 }}>Overall Subject Performance</h2>
                        <div className="stat-grid">
                            {subjectProgressData.map(s => {
                                const score = s.averageScore
                                return (
                                    <div
                                        key={s.subject}
                                        className="stat-card"
                                        style={{
                                            cursor: 'pointer',
                                            background: selectedSubject === s.subject ? 'var(--accent-soft)' : undefined,
                                            borderColor: selectedSubject === s.subject ? 'var(--accent)' : undefined
                                        }}
                                        onClick={() => setSelectedSubject(s.subject)}
                                    >
                                        <div className="stat-label">{s.label}</div>
                                        <div className="stat-value" style={{ opacity: score != null ? 1 : 0.3 }}>
                                            {score != null ? `${score}%` : '—'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                                            {s.totalTests} test{s.totalTests !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {currentSubjectData && (
                        <section className="card">
                            <h2 style={{ marginBottom: 20 }}>
                                Detailed Analysis: {currentSubjectData.label}
                            </h2>

                            {currentSubjectData.totalTests === 0 ? (
                                <p className="hint">No tests recorded for this subject yet.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                                    <div className="statRow" style={{ padding: '20px' }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Average Score</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>
                                            {currentSubjectData.averageScore}%
                                        </div>
                                    </div>

                                    <div className="statRow" style={{ padding: '20px' }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Highest Score</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>
                                            {currentSubjectData.highest}%
                                        </div>
                                    </div>

                                    <div className="statRow" style={{ padding: '20px' }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Lowest Score</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
                                            {currentSubjectData.lowest}%
                                        </div>
                                    </div>

                                    <div className="statRow" style={{ padding: '20px' }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Progress Rate</div>
                                        <div style={{
                                            fontSize: '2rem',
                                            fontWeight: 700,
                                            color: getProgressRateColor(currentSubjectData.progressRate),
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <span>{getProgressRateIcon(currentSubjectData.progressRate)}</span>
                                            <span style={{ fontSize: '1.2rem' }}>
                                                {currentSubjectData.progressRate !== null
                                                    ? `${currentSubjectData.progressRate > 0 ? '+' : ''}${currentSubjectData.progressRate}%`
                                                    : 'N/A'
                                                }
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8 }}>
                                            per test
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 30, padding: '20px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                                <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Performance Insights</h3>
                                {currentSubjectData.totalTests === 0 ? (
                                    <p className="hint">No insights available yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {currentSubjectData.averageScore >= 80 && (
                                            <p style={{ margin: 0, color: '#22c55e' }}>
                                                ✅ Excellent performance in {currentSubjectData.label}! Keep up the great work.
                                            </p>
                                        )}
                                        {currentSubjectData.averageScore >= 60 && currentSubjectData.averageScore < 80 && (
                                            <p style={{ margin: 0, color: 'var(--accent)' }}>
                                                👍 Good performance in {currentSubjectData.label}. There's room for improvement.
                                            </p>
                                        )}
                                        {currentSubjectData.averageScore < 60 && (
                                            <p style={{ margin: 0, color: '#ef4444' }}>
                                                ⚠️ {currentSubjectData.label} needs more attention. Consider additional practice.
                                            </p>
                                        )}

                                        {currentSubjectData.progressRate !== null && currentSubjectData.progressRate > 2 && (
                                            <p style={{ margin: 0, color: '#22c55e' }}>
                                                📈 Great progress! Your scores are improving by {currentSubjectData.progressRate.toFixed(1)}% per test on average.
                                            </p>
                                        )}
                                        {currentSubjectData.progressRate !== null && currentSubjectData.progressRate < -2 && (
                                            <p style={{ margin: 0, color: '#ef4444' }}>
                                                📉 Your scores are declining by {Math.abs(currentSubjectData.progressRate).toFixed(1)}% per test. Focus on reviewing recent topics.
                                            </p>
                                        )}
                                        {currentSubjectData.progressRate !== null && Math.abs(currentSubjectData.progressRate) <= 2 && (
                                            <p style={{ margin: 0 }}>
                                                ➡️ Your performance is stable with minimal change ({currentSubjectData.progressRate > 0 ? '+' : ''}{currentSubjectData.progressRate.toFixed(1)}% per test).
                                            </p>
                                        )}

                                        {currentSubjectData.highest - currentSubjectData.lowest > 30 && (
                                            <p style={{ margin: 0 }}>
                                                ⚡ Your performance varies significantly. Focus on consistency.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    )
}
