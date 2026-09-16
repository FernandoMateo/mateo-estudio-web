// Mismas convenciones de formato que src/lib/api.js del dashboard, para que los
// mensajes del agente se vean consistentes con la UI.

export const fmtARS = n => '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
export const fmtUSD = n => 'US$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
export const fmtMXN = n => 'MX$' + (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })
export const fmtByCurrency = (n, currency) =>
  currency === 'USD' ? fmtUSD(n) : currency === 'MXN' ? fmtMXN(n) : fmtARS(n)

export const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(String(d).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return String(d).slice(0, 10)
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const isOverdue = (dueDate) => {
  if (!dueDate) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(String(dueDate).slice(0, 10) + 'T00:00:00')
  return d < today
}

export const STATUS_LABEL = {
  // tareas
  pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada',
  // proyectos
  propuesta: 'Propuesta', pausado: 'Pausado', completado: 'Completado', cancelado: 'Cancelado',
  // facturas / transacciones
  borrador: 'Borrador', enviada: 'Enviada', pagada: 'Pagada', vencida: 'Vencida', pagado: 'Pagado', vencido: 'Vencido',
}
export const label = (s) => STATUS_LABEL[s] || s || '—'

export const PRIORITY_EMOJI = { baja: '🔵', media: '🟡', alta: '🟠', urgente: '🔴' }
