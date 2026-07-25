export const PB_URL = import.meta.env.VITE_PB_URL || window.location.origin

export function getAuth() {
  try { return JSON.parse(localStorage.getItem('pb_auth')) } catch { return null }
}
export function setAuth(a) { localStorage.setItem('pb_auth', JSON.stringify(a)) }
export function clearAuth() { localStorage.removeItem('pb_auth') }

export async function api(path, opts = {}) {
  const a = getAuth()
  const headers = { ...(opts.headers || {}) }
  if (a?.token) headers.Authorization = a.token
  if (opts.json) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json) }
  const res = await fetch(PB_URL + path, { ...opts, headers })
  if (res.status === 401) { clearAuth(); window.location.href = '/'; throw new Error('401') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error('api_error'), { data })
  return data
}

export const list = (col, params = '') =>
  api(`/api/collections/${col}/records?perPage=200${params}`).then(d => d.items || [])
export const createRec = (col, body, isForm) =>
  api(`/api/collections/${col}/records`, isForm ? { method: 'POST', body } : { method: 'POST', json: body })
export const updateRec = (col, id, body, isForm) =>
  api(`/api/collections/${col}/records/${id}`, isForm ? { method: 'PATCH', body } : { method: 'PATCH', json: body })
export const removeRec = (col, id) =>
  api(`/api/collections/${col}/records/${id}`, { method: 'DELETE' })

export const fileUrl = (col, id, name, thumb) =>
  `${PB_URL}/api/files/${col}/${id}/${encodeURIComponent(name)}${thumb ? `?thumb=${thumb}` : ''}`

export async function auth(identity, password) {
  const data = await api('/api/collections/users/auth-with-password', {
    method: 'POST',
    json: { identity, password },
  })
  setAuth(data)
  return data
}

// Pesos argentinos (moneda principal)
export const fmtARS = n => '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
// Dólares estadounidenses
export const fmtUSD = n => 'US$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
// Alias retrocompatible (algunos módulos ya usan fmtMoney para ARS)
export const fmtMoney = fmtARS
