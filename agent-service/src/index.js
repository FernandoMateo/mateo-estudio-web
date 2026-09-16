import 'dotenv/config'
import { ensureAuth } from './pocketbase.js'
import { bot } from './telegram/bot.js'
import { startScheduler } from './jobs/scheduler.js'
import { refreshSchemaMap } from './schemaMap.js'
import { refreshAiSettings } from './aiSettings.js'

async function main() {
  console.log('[agent] iniciando agente Mateo Estudio…')
  await ensureAuth()
  await Promise.all([refreshSchemaMap(), refreshAiSettings()])
  // El mapa de datos se refresca cada 6hs: si agregás una colección o un campo nuevo en el
  // dashboard, el agente lo va a "saber" en la próxima corrida sin que haya que redeployar nada.
  setInterval(() => refreshSchemaMap().catch(err => console.error('[schema] error refrescando', err)), 6 * 60 * 60 * 1000)
  // Las instrucciones del módulo "Herramienta IA" se refrescan más seguido (cada 15 min), para
  // que un cambio que Fer guarde ahí se note casi al toque sin tener que mandar /actualizar.
  setInterval(() => refreshAiSettings().catch(err => console.error('[ai-settings] error refrescando', err)), 15 * 60 * 1000)
  startScheduler(bot)
  console.log('[agent] listo. Escuchando Telegram por polling.')
}

main().catch((err) => {
  console.error('[agent] error fatal al iniciar:', err)
  process.exit(1)
})

process.on('unhandledRejection', (err) => console.error('[agent] unhandledRejection:', err))
process.on('SIGTERM', () => { console.log('[agent] SIGTERM recibido, cerrando…'); process.exit(0) })
