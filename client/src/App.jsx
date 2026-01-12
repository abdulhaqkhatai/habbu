import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { getCurrentUser } from './utils/auth'

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
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/teacher" element={
          <RequireAuth role="teacher">
            <TeacherView />
          </RequireAuth>
        } />
        <Route path="/student" element={
          <RequireAuth role="student">
            <StudentView />
          </RequireAuth>
        } />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
