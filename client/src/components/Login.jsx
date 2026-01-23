import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../utils/auth'

export default function Login({ darkMode, setDarkMode }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Signing in...')
  const loadingTimerRef = useRef(null)
  const nav = useNavigate()

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
      }
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setLoadingMessage('Signing in...')

    // After 3 seconds, show cold start message
    loadingTimerRef.current = setTimeout(() => {
      setLoadingMessage('Server is waking up, please wait... (first visit may take 30-60 seconds)')
    }, 3000)

    const res = await login(username.trim(), password)

    // Clear the timer since request completed
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
    }

    if (res.success) {
      const role = res.user.role
      nav(role === 'teacher' ? '/teacher' : '/student')
    } else {
      setError('Invalid username or password')
      setLoading(false)
    }
  }

  return (
    <div className="page login-page">
      <button onClick={() => setDarkMode(!darkMode)} className="theme-toggle" title={darkMode ? 'Light Mode' : 'Dark Mode'}>
        {darkMode ? '☀️' : '🌙'}
      </button>
      <div className="login-card card">
        <h1 className="title">habbu classes</h1>
        <p className="subtitle">Teacher and Student portal — weekly & monthly stats</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">Username
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. student" disabled={loading} autoComplete="username" />
          </label>
          <label className="field">Password
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="your password" disabled={loading} autoComplete="current-password" />
          </label>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? loadingMessage : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
