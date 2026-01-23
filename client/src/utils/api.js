const API_BASE = import.meta.env.VITE_API_URL

export async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {}
  // Break circular dependency with auth.js by reading token directly
  const token = localStorage.getItem('ma_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const base = API_BASE || ''
  const url = `${base}${path}`

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

  try {
    const res = await fetch(url, {
      ...opts,
      headers,
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (res.status === 401) {
      // unauthorized - clear token
      localStorage.removeItem('ma_token')
      localStorage.removeItem('ma_current')
      // let caller handle redirect
    }
    const text = await res.text()
    try { return JSON.parse(text) } catch (e) { return text }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server may be starting up. Please try again.')
    }
    throw error
  }
}
