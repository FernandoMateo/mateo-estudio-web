// Reenvío en "casi vivo" de las notificaciones del dashboard al teléfono de Fer por Telegram.
// El dashboard ya escribe en la colección `notifications` (misma que usa el centro de avisos
// de la campanita) cada vez que pasa algo — nueva tarea, factura, pago reportado, solicitud de
// un cliente, etc. Acá no creamos nada nuevo: cada ~20s revisamos si hay avisos sin mandar
// todavía para el usuario admin (Fer) y se los reenviamos por Telegram, marcándolos para no
// repetir. No es "push" real de navegador (eso necesitaría VAPID + service worker aparte), pero
// como el bot de Telegram ya anda probado y llega al teléfono, es la vía más simple y confiable
// que tenemos hoy para avisos en tiempo real.

import { withAuth } from '../pocketbase.js'

const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
const POLL_MS = Number(process.env.NOTIFY_PHONE_POLL_MS) || 20000

const TYPE_EMOJI = { info: 'ℹ️', tarea: '✅', proyecto: '📁', pago: '💸', alerta: '⚠️' }

// La primera vez que corre esto puede haber un backlog viejo de notificaciones sin marcar
// (todo lo generado antes de agregar el campo `telegram_sent`). Las marcamos igual para no
// volver a mirarlas, pero solo reenviamos por Telegram las que sean de después de arrancar el
// agente — así Fer no recibe de golpe meses de avisos viejos la primera vez que se despliega esto.
let startedAt = null

async function broadcast(bot, text) {
  for (const chatId of ALLOWED_CHAT_IDS) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(err => console.error('[notify-phone] telegram error', chatId, err.message))
  }
}

async function tick(bot) {
  const pending = await withAuth((pb) => pb.collection('notifications').getList(1, 20, {
    filter: 'telegram_sent != true',
    sort: '+created',
    expand: 'user,client',
  }))
  if (!pending.items.length) return

  for (const n of pending.items) {
    try {
      const isAdmin = n.expand?.user?.role === 'admin'
      const isFresh = !startedAt || new Date(n.created) >= startedAt
      if (isAdmin && isFresh) {
        const emoji = TYPE_EMOJI[n.type] || '🔔'
        const clientLine = n.expand?.client?.name ? `\n_${n.expand.client.name}_` : ''
        const text = `${emoji} *${n.title}*${n.message ? `\n${n.message}` : ''}${clientLine}`
        await broadcast(bot, text)
      }
      await withAuth((pb) => pb.collection('notifications').update(n.id, { telegram_sent: true }))
    } catch (err) {
      console.error('[notify-phone] error procesando notificación', n.id, err.message)
      // no marcamos telegram_sent — se reintenta en la próxima vuelta
    }
  }
}

export function startPhoneNotifications(bot) {
  if (!ALLOWED_CHAT_IDS.length) {
    console.warn('[notify-phone] TELEGRAM_ALLOWED_CHAT_IDS vacío — no hay a quién reenviar notificaciones.')
    return
  }
  startedAt = new Date()
  const loop = () => tick(bot).catch(err => console.error('[notify-phone] error en el poll:', err.message))
  loop()
  setInterval(loop, POLL_MS)
  console.log(`[notify-phone] activo — reenviando notificaciones del admin a Telegram cada ${POLL_MS / 1000}s`)
}

