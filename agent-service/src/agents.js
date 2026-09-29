// Fabian — el orquestador. No toca datos de negocio: registra a los demás agentes en la
// colección `agents`, guarda su estado (activo/pausado, última corrida, último resultado) y
// le da al resto de los jobs una forma simple de preguntar "¿estoy pausado?" y de avisar "ya
// corrí, esto encontré". El dashboard (módulo Agentes) y el comando /agentes de Telegram leen
// esta misma colección — así hay un solo lugar de verdad para ver y administrar a todos.

import { withAuth } from './pocketbase.js'

export const AGENTS = [
  { key: 'toto', display_name: 'Toto', icon: '🤖', role: 'Asistente general del estudio: responde por Telegram (comandos y lenguaje natural), manda resúmenes y emails automáticos.', schedule_label: 'Siempre activo (Telegram)' },
  { key: 'renzo', display_name: 'Renzo', icon: '🔍', role: 'Detecta clientes sin actividad reciente (sin proyecto activo ni facturación) y avisa para retomar el contacto antes de perderlos.', schedule_label: 'Diario 09:00' },
  { key: 'facundo', display_name: 'Facundo', icon: '💰', role: 'Avisa facturas por vencer ANTES del vencimiento, para cobrar más rápido y con menos fricción.', schedule_label: 'Diario 09:05' },
  { key: 'bruno', display_name: 'Bruno', icon: '📋', role: 'Detecta tareas del Kanban que llevan días sin moverse y avisa quién es el responsable.', schedule_label: 'Diario 09:10' },
  { key: 'nahuel', display_name: 'Nahuel', icon: '🗺️', role: 'Sale a buscar clientes potenciales en Google Maps (Miami, Ciudad de México y Panamá), priorizando negocios sin sitio web.', schedule_label: 'Semanal (lunes 10:00) + /prospectar' },
  { key: 'lautaro', display_name: 'Lautaro', icon: '🎯', role: 'Cerrador de ventas: arma propuestas innovadoras y con diseño poco convencional a partir de un audio tuyo por Telegram.', schedule_label: 'Bajo demanda (nota de voz)' },
  { key: 'fabian', display_name: 'Fabian', icon: '🧠', role: 'Orquesta al resto de los agentes: los registra, guarda su estado y te deja pausarlos o reanudarlos.', schedule_label: 'Siempre activo' },
]

const cache = new Map() // key -> registro de PocketBase

/** Se llama una vez al arrancar el servicio: da de alta en `agents` el que no exista todavía,
 *  y si ya existe lo cachea tal cual está (para no pisar un enabled/estado que Fer haya
 *  tocado desde el dashboard). Si la colección todavía no fue importada, avisa y sigue sin
 *  romper nada — ningún job depende de que esto exista para funcionar. */
export async function ensureAgentsRegistered() {
  for (const def of AGENTS) {
    try {
      const existing = await withAuth((pb) => pb.collection('agents').getFirstListItem(`name = "${def.key}"`)).catch(() => null)
      if (existing) { cache.set(def.key, existing); continue }
      const rec = await withAuth((pb) => pb.collection('agents').create({
        name: def.key, display_name: def.display_name, icon: def.icon, role: def.role,
        schedule_label: def.schedule_label, enabled: true, status: 'inactivo', last_message: '',
      }))
      cache.set(def.key, rec)
    } catch (err) {
      console.warn(`[agents] no pude registrar "${def.key}" — ¿existe la colección "agents"? (importá pb-schema-agents.json):`, err.message)
    }
  }
  console.log(`[agents] Fabian activo — ${cache.size}/${AGENTS.length} agentes registrados.`)
}

/** true si el agente puede correr (colección sin importar todavía = nunca bloquea, para no
 *  frenar nada por un detalle de configuración pendiente). */
export async function isEnabled(key) {
  const rec = cache.get(key)
  if (!rec) return true
  try {
    const fresh = await withAuth((pb) => pb.collection('agents').getOne(rec.id))
    cache.set(key, fresh)
    return fresh.enabled !== false
  } catch {
    return rec.enabled !== false
  }
}

export async function setEnabled(key, enabled) {
  const rec = cache.get(key)
  if (!rec) return false
  const updated = await withAuth((pb) => pb.collection('agents').update(rec.id, { enabled }))
  cache.set(key, updated)
  return true
}

/** Cada job la llama después de correr (con éxito o con error) para dejar constancia de
 *  cuándo corrió y qué encontró — es lo que alimenta el panel del dashboard y /agentes. */
export async function reportRun(key, { status = 'ok', message = '' } = {}) {
  const rec = cache.get(key)
  if (!rec) return
  try {
    const updated = await withAuth((pb) => pb.collection('agents').update(rec.id, {
      status, last_run: new Date().toISOString(), last_message: String(message).slice(0, 480),
    }))
    cache.set(key, updated)
  } catch (err) {
    console.warn(`[agents] no pude reportar la corrida de "${key}":`, err.message)
  }
}

/** Estado liviano por agente (JSON libre) — por ejemplo, Nahuel lo usa para recordar por
 *  qué combinación de ciudad/rubro va, sin necesitar una colección aparte. */
export function getState(key) {
  const rec = cache.get(key)
  if (!rec?.state) return null
  try { return JSON.parse(rec.state) } catch { return null }
}

export function setState(key, patch) {
  const rec = cache.get(key)
  if (!rec) return
  const merged = { ...(getState(key) || {}), ...patch }
  const stateStr = JSON.stringify(merged)
  cache.set(key, { ...rec, state: stateStr })
  withAuth((pb) => pb.collection('agents').update(rec.id, { state: stateStr }))
    .catch((err) => console.warn(`[agents] no pude guardar el estado de "${key}":`, err.message))
}

export function agentDefs() {
  return AGENTS
}

/** Para /agentes en Telegram y para cualquier lugar que necesite el estado fresco de todos
 *  de una — trae el registro más reciente de cada uno. */
export async function listAgentStatuses() {
  const out = []
  for (const def of AGENTS) {
    const rec = cache.get(def.key)
    let fresh = rec
    if (rec) {
      try {
        fresh = await withAuth((pb) => pb.collection('agents').getOne(rec.id))
        cache.set(def.key, fresh)
      } catch { /* seguimos con lo que había en cache */ }
    }
    out.push({
      ...def,
      enabled: fresh?.enabled !== false,
      status: fresh?.status || 'inactivo',
      last_run: fresh?.last_run || null,
      last_message: fresh?.last_message || '',
    })
  }
  return out
}
