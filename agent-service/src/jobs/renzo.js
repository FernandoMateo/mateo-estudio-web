// Renzo — detecta clientes sin actividad reciente (sin proyecto activo ni facturación en los
// últimos X días) y avisa por Telegram para que Fer retome el contacto antes de que se
// enfríen del todo. Solo LEE — nunca toca ni modifica nada de negocio.

import cron from 'node-cron'
import { withAuth } from '../pocketbase.js'
import { isEnabled, reportRun } from '../agents.js'

const KEY = 'renzo'
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
const INACTIVE_DAYS = Number(process.env.RENZO_INACTIVE_DAYS) || 45

async function broadcast(bot, text) {
  for (const chatId of ALLOWED_CHAT_IDS) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch((err) => console.error('[renzo] telegram error', chatId, err.message))
  }
}

function daysAgo(dateStr) {
  if (!dateStr) return Infinity
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

/** Un proyecto "en_progreso" o todavía en etapa "propuesta" cuenta como relación activa —
 *  el resto (completado, pausado, cancelado) no alcanza para considerar al cliente activo. */
const ACTIVE_PROJECT_STATUSES = new Set(['en_progreso', 'propuesta'])

export async function findInactiveClients() {
  const [clients, projects, invoices] = await Promise.all([
    withAuth((pb) => pb.collection('clients').getFullList()),
    withAuth((pb) => pb.collection('projects').getFullList()),
    withAuth((pb) => pb.collection('invoices').getFullList({ sort: '-issue_date' })),
  ])

  const results = []
  for (const c of clients) {
    const cProjects = projects.filter((p) => p.client === c.id)
    if (cProjects.some((p) => ACTIVE_PROJECT_STATUSES.has(p.status))) continue

    const cInvoices = invoices.filter((i) => i.client === c.id)
    const lastInvoiceDate = cInvoices[0]?.issue_date || null
    const lastProjectDate = cProjects.map((p) => p.updated).filter(Boolean).sort().reverse()[0] || null
    const lastActivity = [lastInvoiceDate, lastProjectDate].filter(Boolean).sort().reverse()[0] || null
    const idleDays = daysAgo(lastActivity)

    if (idleDays >= INACTIVE_DAYS) results.push({ client: c, idleDays: idleDays === Infinity ? null : idleDays })
  }
  return results.sort((a, b) => (b.idleDays ?? 9e9) - (a.idleDays ?? 9e9))
}

async function tick(bot) {
  if (!(await isEnabled(KEY))) return
  const inactive = await findInactiveClients()

  if (!inactive.length) {
    await reportRun(KEY, { status: 'ok', message: 'Sin clientes inactivos detectados.' })
    return
  }

  const lines = [`🔍 *Renzo* — ${inactive.length} cliente(s) sin actividad hace ${INACTIVE_DAYS}+ días:`, '']
  inactive.slice(0, 12).forEach(({ client, idleDays }) => {
    lines.push(`  · *${client.name}* — ${idleDays === null ? 'sin actividad registrada' : `hace ${idleDays} días`}`)
  })
  if (inactive.length > 12) lines.push(`  …y ${inactive.length - 12} más`)
  lines.push('', '_Che, capaz vale la pena escribirles antes de que se enfríen del todo._')

  await broadcast(bot, lines.join('\n'))
  await reportRun(KEY, { status: 'ok', message: `${inactive.length} cliente(s) inactivo(s) detectado(s).` })
}

export function startRenzo(bot) {
  const cronExpr = process.env.RENZO_CRON || '0 9 * * 1-5'
  const tz = process.env.TZ || 'America/Argentina/Cordoba'
  cron.schedule(cronExpr, () => tick(bot).catch((err) => { console.error('[renzo] error', err); reportRun(KEY, { status: 'error', message: err.message }) }), { timezone: tz })
  console.log(`[renzo] activo — reviso clientes inactivos "${cronExpr}" (tz ${tz}, umbral ${INACTIVE_DAYS}d)`)
}

export const runOnce = tick
