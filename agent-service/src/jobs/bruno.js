// Bruno — detecta tareas del Kanban que llevan varios días sin moverse de estado y avisa
// quién es el responsable, para destrabar cuellos de botella del equipo sin que Fer tenga
// que ir a mirar el tablero él mismo. Solo lee — nunca cambia nada.

import cron from 'node-cron'
import * as data from '../data.js'
import { isEnabled, reportRun } from '../agents.js'

const KEY = 'bruno'
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
const STALLED_DAYS = Number(process.env.BRUNO_STALLED_DAYS) || 5

async function broadcast(bot, text) {
  for (const chatId of ALLOWED_CHAT_IDS) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch((err) => console.error('[bruno] telegram error', chatId, err.message))
  }
}

export async function findStalledTasks() {
  const tasks = await data.listTasks({})
  const limit = Date.now() - STALLED_DAYS * 86400000
  return tasks.filter((t) => t.status !== 'completada' && new Date(t.updated).getTime() <= limit)
}

async function tick(bot) {
  if (!(await isEnabled(KEY))) return
  const stalled = await findStalledTasks()

  if (!stalled.length) {
    await reportRun(KEY, { status: 'ok', message: 'Sin tareas estancadas.' })
    return
  }

  const lines = [`📋 *Bruno* — ${stalled.length} tarea(s) sin moverse hace ${STALLED_DAYS}+ días:`, '']
  stalled.slice(0, 15).forEach((t) => {
    const a = t.expand?.assigned_to?.name || t.expand?.assigned_to?.email || 'sin asignar'
    const days = Math.floor((Date.now() - new Date(t.updated).getTime()) / 86400000)
    lines.push(`  · *${t.title}* — 👤 ${a} — quieta hace ${days} días`)
  })
  if (stalled.length > 15) lines.push(`  …y ${stalled.length - 15} más`)

  await broadcast(bot, lines.join('\n'))
  await reportRun(KEY, { status: 'ok', message: `${stalled.length} tarea(s) estancada(s) detectada(s).` })
}

export function startBruno(bot) {
  const cronExpr = process.env.BRUNO_CRON || '10 9 * * 1-5'
  const tz = process.env.TZ || 'America/Argentina/Cordoba'
  cron.schedule(cronExpr, () => tick(bot).catch((err) => { console.error('[bruno] error', err); reportRun(KEY, { status: 'error', message: err.message }) }), { timezone: tz })
  console.log(`[bruno] activo — reviso tareas estancadas "${cronExpr}" (tz ${tz}, umbral ${STALLED_DAYS}d)`)
}

export const runOnce = tick
