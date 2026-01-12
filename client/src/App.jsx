import React, { Suspense, lazy, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { getCurrentUser } from './utils/auth'

// Dark mode and dark theme support
// Lazy load components for better performance
const Login = lazy(() => import('./components/Login'))
const TeacherView = lazy(() => import('./components/TeacherView'))
const StudentView = lazy(() => import('./components/StudentView'))

// Loading component
function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '1.2rem',
      color: '#666'
    }}>
      Loading...
    </div>
  )
}

function RequireAuth({ children, role }){
  const user = getCurrentUser()
  if(!user) return <Navigate to="/login" replace />
  if(role && user.role !== role) return <Navigate to="/" replace />
  return children
}

// Preload components on user interaction
const preloadTeacherView = () => import('./components/TeacherView')
const preloadStudentView = () => import('./components/StudentView')

export default function App(){
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if(darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [darkMode])

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login darkMode={darkMode} setDarkMode={setDarkMode} />} />
        <Route path="/teacher" element={
          <RequireAuth role="teacher">
            <TeacherView darkMode={darkMode} setDarkMode={setDarkMode} />
          </RequireAuth>
        } />
        <Route path="/student" element={
          <RequireAuth role="student">
            <StudentView darkMode={darkMode} setDarkMode={setDarkMode} />
          </RequireAuth>
        } />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
