import 'dotenv/config'
import { ensureAuth } from './pocketbase.js'
import { bot } from './telegram/bot.js'
import { startScheduler } from './jobs/scheduler.js'

async function main() {
  console.log('[agent] iniciando agente Mateo Estudio…')
  await ensureAuth()
  startScheduler(bot)
  console.log('[agent] listo. Escuchando Telegram por polling.')
}

main().catch((err) => {
  console.error('[agent] error fatal al iniciar:', err)
  process.exit(1)
})

process.on('unhandledRejection', (err) => console.error('[agent] unhandledRejection:', err))
process.on('SIGTERM', () => { console.log('[agent] SIGTERM recibido, cerrando…'); process.exit(0) })
