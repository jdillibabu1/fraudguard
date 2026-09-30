const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('Cannot reach the API. Is the backend running on ' + BASE + '?')
  }
  let body = null
  try { body = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    const detail = body?.detail
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${res.status})`)
  }
  return body
}

const qs = (params) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null && v !== 'ALL') p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  health: () => request('/health'),
  stats: () => request('/dashboard/stats'),
  transactions: (params) => request(`/transactions${qs(params)}`),
  flags: (params) => request(`/fraud/flags${qs(params)}`),
  flag: (id) => request(`/fraud/flags/${id}`),
  review: (id, body) => request(`/fraud/flags/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }),
  createTransaction: (body) => request('/transactions', { method: 'POST', body: JSON.stringify(body) }),
}
