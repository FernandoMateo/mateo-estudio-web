import cron from 'node-cron'
import * as data from '../data.js'
import { sendEmail } from '../email/mailer.js'
import { renderSummary, toPlainText } from './summaryText.js'

const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)

async function broadcastTelegram(bot, text) {
  for (const chatId of ALLOWED_CHAT_IDS) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(err => console.error('[scheduler] telegram error', chatId, err.message))
  }
}

async function runSummaryJob(bot, { days, title }) {
  console.log(`[scheduler] generando ${title.toLowerCase()}...`)
  const summary = await data.buildSummary({ sinceDays: days })
  const text = renderSummary(summary, { title })
  await broadcastTelegram(bot, text)
  await sendEmail({ subject: `Mateo Estudio · ${title}`, text: toPlainText(text) })
}

async function runOverdueCheck(bot) {
  const [overdueTasks, overdueInvoices] = await Promise.all([data.listOverdueTasks(), data.listOverdueInvoices()])
  if (!overdueTasks.length && !overdueInvoices.length) return
  const lines = [`⚠️ *Alerta de vencidos*`, '']
  if (overdueTasks.length) lines.push(`Tareas vencidas: ${overdueTasks.length}`, ...overdueTasks.slice(0, 8).map(t => '  · ' + t.title))
  if (overdueInvoices.length) lines.push(`Facturas vencidas: ${overdueInvoices.length}`, ...overdueInvoices.slice(0, 8).map(i => '  · ' + (i.number || i.title)))
  const text = lines.join('\n')
  console.log('[scheduler] alerta de vencidos:', overdueTasks.length, 'tareas,', overdueInvoices.length, 'facturas')
  await broadcastTelegram(bot, text)
  await sendEmail({ subject: 'Mateo Estudio · Alerta: vencidos', text: toPlainText(text) })
}

export function startScheduler(bot) {
  const tz = process.env.TZ || 'America/Argentina/Cordoba'
  const daily = process.env.DAILY_SUMMARY_CRON || '0 8 * * 1-5'
  const weekly = process.env.WEEKLY_SUMMARY_CRON || '0 8 * * 1'
  const overdue = process.env.OVERDUE_CHECK_CRON || '0 9,15 * * *'

  cron.schedule(daily, () => runSummaryJob(bot, { days: 1, title: 'Resumen del día' }).catch(err => console.error('[scheduler] daily error', err)), { timezone: tz })
  cron.schedule(weekly, () => runSummaryJob(bot, { days: 7, title: 'Resumen semanal' }).catch(err => console.error('[scheduler] weekly error', err)), { timezone: tz })
  cron.schedule(overdue, () => runOverdueCheck(bot).catch(err => console.error('[scheduler] overdue error', err)), { timezone: tz })

  console.log(`[scheduler] activo — diario: "${daily}", semanal: "${weekly}", vencidos: "${overdue}" (tz ${tz})`)
}
