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

// Pesos argentinos (moneda principal)
export const fmtARS = n => '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
// Dólares estadounidenses
export const fmtUSD = n => 'US$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
// Pesos mexicanos
export const fmtMXN = n => 'MX$' + (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })
// Formatea según la moneda indicada (ARS por defecto)
export const fmtByCurrency = (n, currency) => currency === 'USD' ? fmtUSD(n) : currency === 'MXN' ? fmtMXN(n) : fmtARS(n)
// Alias retrocompatible (algunos módulos ya usan fmtMoney para ARS)
export const fmtMoney = fmtARS

/* ── Historial de cambios: registra quién hizo qué y cuándo ── */
export async function logActivity({ action, entity, entity_name, summary = '' }) {
  try {
    const me = getAuth()?.record
    if (!me) return
    await createRec('activity_log', { user: me.id, action, entity, entity_name, summary })
  } catch { /* nunca bloquea la acción principal */ }
}
export async function notifyUser(userId, { title, message = '', type = 'info', task = '', project = '', client = '' }) {
  if (!userId) return
  try { await createRec('notifications', { user: userId, title, message, type, task, project, client, read: false }) }
  catch { /* si falla, no bloqueamos la acción principal */ }
}

export async function notifyTeam({ title, message = '', type = 'info', task = '', project = '', client = '' }) {
  try {
    const team = await list('users', '&filter=' + encodeURIComponent('role="admin" || role="equipo"'))
    await Promise.all(team.map(u => notifyUser(u.id, { title, message, type, task, project, client })))
  } catch { /* silencioso */ }
  sendEmailAlert({ subject: title, title, message })
}

/* ── Reenvío de avisos del equipo a un correo real, vía EmailJS (no requiere servidor propio) ── */
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const ALERT_EMAIL = import.meta.env.VITE_ALERT_EMAIL

export async function sendEmailAlert({ subject, title, message = '' }) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !ALERT_EMAIL) return // no configurado todavía
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: { to_email: ALERT_EMAIL, subject, title, message: message || subject },
      }),
    })
  } catch { /* si falla el email, no afecta el resto de la app */ }
}
