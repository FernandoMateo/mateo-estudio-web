import { fmtDate, fmtByCurrency, PRIORITY_EMOJI } from '../lib/format.js'

/** Arma el texto del resumen (se usa tal cual para Telegram en Markdown, y se reusa para el email). */
export function renderSummary(summary, { title = 'Resumen' } = {}) {
  const { completedRecently, overdueTasks, overdueInvoices, dueSoonInvoices, activeProjects } = summary
  const lines = [`*${title}*`, '']

  lines.push(`📁 Proyectos activos: *${activeProjects.length}*`)
  lines.push(`✅ Tareas completadas: *${completedRecently.length}*`)
  lines.push('')

  if (overdueTasks.length) {
    lines.push(`⚠️ *Tareas vencidas (${overdueTasks.length})*`)
    overdueTasks.slice(0, 10).forEach(t => {
      const a = t.expand?.assigned_to?.name || t.expand?.assigned_to?.email || 'sin asignar'
      lines.push(`  ${PRIORITY_EMOJI[t.priority] || '⚪'} ${t.title} — ${a} — vencía ${fmtDate(t.due_date)}`)
    })
    if (overdueTasks.length > 10) lines.push(`  …y ${overdueTasks.length - 10} más`)
    lines.push('')
  } else {
    lines.push('✅ No hay tareas vencidas.')
    lines.push('')
  }

  if (overdueInvoices.length) {
    lines.push(`💸 *Facturas vencidas (${overdueInvoices.length})*`)
    overdueInvoices.slice(0, 10).forEach(i => {
      const client = i.expand?.client?.name || '—'
      lines.push(`  ${i.number || i.title} — ${client} — ${fmtByCurrency(i.total, i.currency)} — vencía ${fmtDate(i.due_date)}`)
    })
    if (overdueInvoices.length > 10) lines.push(`  …y ${overdueInvoices.length - 10} más`)
    lines.push('')
  }

  if (dueSoonInvoices.length) {
    lines.push(`📨 Facturas enviadas, esperando pago: *${dueSoonInvoices.length}*`)
    lines.push('')
  }

  return lines.join('\n').trim()
}

export function toPlainText(markdown) {
  return markdown.replace(/\*/g, '').replace(/_/g, '')
}
