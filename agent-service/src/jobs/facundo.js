// Facundo — recordatorio PREVENTIVO de facturas: la alerta de vencidos del scheduler ya te
// avisa cuando una factura VENCIÓ; Facundo avisa ANTES de que eso pase, para cobrar más
// rápido y con menos fricción. No crea ni modifica nada — solo lee y avisa.

import cron from 'node-cron'
import * as data from '../data.js'
import { isEnabled, reportRun } from '../agents.js'
import { fmtByCurrency, fmtDate } from '../lib/format.js'

const KEY = 'facundo'
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
const DUE_SOON_DAYS = Number(process.env.FACUNDO_DUE_SOON_DAYS) || 3

async function broadcast(bot, text) {
  for (const chatId of ALLOWED_CHAT_IDS) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch((err) => console.error('[facundo] telegram error', chatId, err.message))
  }
}

export async function findInvoicesDueSoon() {
  const invoices = await data.listInvoices({ status: 'enviada' })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const limit = new Date(today.getTime() + DUE_SOON_DAYS * 86400000)
  return invoices.filter((i) => {
    if (!i.due_date) return false
    const d = new Date(String(i.due_date).slice(0, 10) + 'T00:00:00')
    return d >= today && d <= limit
  })
}

async function tick(bot) {
  if (!(await isEnabled(KEY))) return
  const dueSoon = await findInvoicesDueSoon()

  if (!dueSoon.length) {
    await reportRun(KEY, { status: 'ok', message: 'Sin facturas por vencer en la ventana.' })
    return
  }

  const lines = [`💰 *Facundo* — ${dueSoon.length} factura(s) vencen en los próximos ${DUE_SOON_DAYS} días:`, '']
  dueSoon.forEach((i) => {
    const client = i.expand?.client?.name || '—'
    lines.push(`  · *${i.number || i.title}* — ${client} — ${fmtByCurrency(i.total, i.currency)} — vence ${fmtDate(i.due_date)}`)
  })
  lines.push('', '_Un empujoncito ahora evita perseguir el pago después._')

  await broadcast(bot, lines.join('\n'))
  await reportRun(KEY, { status: 'ok', message: `${dueSoon.length} factura(s) por vencer avisada(s).` })
}

export function startFacundo(bot) {
  const cronExpr = process.env.FACUNDO_CRON || '5 9 * * 1-5'
  const tz = process.env.TZ || 'America/Argentina/Cordoba'
  cron.schedule(cronExpr, () => tick(bot).catch((err) => { console.error('[facundo] error', err); reportRun(KEY, { status: 'error', message: err.message }) }), { timezone: tz })
  console.log(`[facundo] activo — reviso facturas por vencer "${cronExpr}" (tz ${tz}, ventana ${DUE_SOON_DAYS}d)`)
}

export const runOnce = tick
