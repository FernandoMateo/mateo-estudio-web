// Instrucciones extra que Fer carga desde el módulo "Herramienta IA" del dashboard
// (colección `ai_settings` en PocketBase, un solo registro). Se cachean acá y se
// refrescan cada tanto — así, cuando Fer guarda un cambio ahí, el agente lo aprende
// solo en la próxima actualización, sin tocar código ni redeployar nada.

import { withAuth } from './pocketbase.js'

let cache = { text: '', fetchedAt: 0 }

export async function refreshAiSettings() {
  try {
    const rows = await withAuth((pb) => pb.collection('ai_settings').getFullList({ sort: '-updated' }))
    cache = { text: (rows[0]?.extra_instructions || '').trim(), fetchedAt: Date.now() }
    console.log(`[ai-settings] instrucciones extra actualizadas (${cache.text ? cache.text.length + ' caracteres' : 'sin contenido'}).`)
  } catch (err) {
    // Si la colección "ai_settings" todavía no existe en PocketBase (por ejemplo, recién se
    // está armando el módulo en el dashboard), no rompemos el agente — seguimos sin instrucciones extra.
    if (!cache.fetchedAt) cache = { text: '', fetchedAt: Date.now() }
    console.warn('[ai-settings] no pude leer instrucciones extra (¿existe la colección "ai_settings"?):', err.message)
  }
  return cache
}

export function getExtraInstructionsText() {
  return cache.text
}

