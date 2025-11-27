import { getToken } from './auth'

// Default API base points to backend server. During development use localhost:5000
// In production set VITE_BACKEND_URL in Vercel to your Render backend URL.
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

export async function apiFetch(path, opts = {}){
  const headers = opts.headers || {}
  const token = getToken()
  if(token) headers['Authorization'] = `Bearer ${token}`
  if(!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const res = await fetch(API_BASE + path, { ...opts, headers })
  if(res.status === 401){
    // unauthorized - clear token
    localStorage.removeItem('ma_token')
    localStorage.removeItem('ma_current')
    // let caller handle redirect
  }
  const text = await res.text()
  try{ return JSON.parse(text) }catch(e){ return text }
}
