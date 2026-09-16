import 'dotenv/config'
import { ensureAuth } from './pocketbase.js'
import { bot } from './telegram/bot.js'
import { startScheduler } from './jobs/scheduler.js'
import { refreshSchemaMap } from './schemaMap.js'

async function main() {
  console.log('[agent] iniciando agente Mateo Estudio…')
  await ensureAuth()
  await refreshSchemaMap()
  // Se refresca solo cada 6hs: si agregás una colección o un campo nuevo en el dashboard,
  // el agente lo va a "saber" en la próxima corrida sin que haya que redeployar nada.
  setInterval(() => refreshSchemaMap().catch(err => console.error('[schema] error refrescando', err)), 6 * 60 * 60 * 1000)
  startScheduler(bot)
  console.log('[agent] listo. Escuchando Telegram por polling.')
}

main().catch((err) => {
  console.error('[agent] error fatal al iniciar:', err)
  process.exit(1)
})

process.on('unhandledRejection', (err) => console.error('[agent] unhandledRejection:', err))
process.on('SIGTERM', () => { console.log('[agent] SIGTERM recibido, cerrando…'); process.exit(0) })
