import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../utils/auth'

export default function Login(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()

  async function handleSubmit(e){
    e.preventDefault()
    setError('')
    const res = await login(username.trim(), password)
    if(res.success){
      const role = res.user.role
      nav(role === 'teacher' ? '/teacher' : '/student')
    } else {
      setError('Invalid username or password')
    }
  }

  return (
    <div className="page login-page">
      <div className="login-card card">
        <h1 className="title">Marks Analysis</h1>
        <p className="subtitle">Teacher and Student portal — weekly & monthly stats</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">Username
            <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. student" />
          </label>
          <label className="field">Password
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="your password" />
          </label>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button className="btn primary" type="submit">Sign in</button>
          </div>
        </form>
      </div>
    </div>
  )
}
