import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './components/Login'
import TeacherView from './components/TeacherView'
import StudentView from './components/StudentView'
import { getCurrentUser } from './utils/auth'

function RequireAuth({ children, role }){
  const user = getCurrentUser()
  if(!user) return <Navigate to="/login" replace />
  if(role && user.role !== role) return <Navigate to="/" replace />
  return children
}

export default function App(){
  return (
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
  )
}
