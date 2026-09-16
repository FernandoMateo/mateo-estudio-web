// Mapa de esquema en vivo: en vez de tener hardcodeado a mano qué colecciones/campos existen,
// el agente le pregunta directamente a PocketBase qué hay — así, cuando se agrega una colección
// o un campo nuevo en el dashboard, el agente lo "aprende" solo en la próxima actualización de
// este mapa, sin que haya que tocar código ni volver a desplegar nada.

import { withAuth } from './pocketbase.js'

// Colecciones de sistema o sensibles que no tiene sentido (o no conviene) exponerle al modelo.
const HIDDEN = new Set(['_superusers', '_admins', '_authOrigins', '_externalAuths', '_mfas', '_otps'])
// Campos técnicos que no aportan nada a la descripción para el modelo.
const HIDDEN_FIELDS = new Set(['id', 'created', 'updated', 'password', 'tokenKey'])

let cache = { text: 'Todavía no se cargó el mapa de datos.', names: [], fetchedAt: 0 }

function describeField(f) {
  const opts = []
  if (f.type === 'select' && f.values?.length) opts.push(f.values.join('|'))
  if (f.type === 'relation' && f.collectionId) opts.push('relation')
  return `${f.name}${f.required ? '*' : ''}:${f.type}${opts.length ? `(${opts.join(',')})` : ''}`
}

/** Vuelve a consultarle el esquema completo a PocketBase y actualiza el mapa en memoria. */
export async function refreshSchemaMap() {
  try {
    const collections = await withAuth((pb) => pb.collections.getFullList())
    const visible = collections.filter(c => c.type !== 'view' && !HIDDEN.has(c.name) && !c.name.startsWith('_'))
    const lines = visible.map((c) => {
      const fields = (c.fields || c.schema || [])
        .filter(f => !HIDDEN_FIELDS.has(f.name) && !f.system)
        .map(describeField)
      return `- ${c.name}: ${fields.join(', ') || '(sin campos propios)'}`
    })
    cache = {
      text: lines.join('\n'),
      names: visible.map(c => c.name),
      fetchedAt: Date.now(),
    }
    console.log(`[schema] mapa actualizado — ${visible.length} colecciones.`)
  } catch (err) {
    console.error('[schema] no pude actualizar el mapa de datos:', err.message)
  }
  return cache
}

/** Texto listo para inyectar en el system prompt. */
export function getSchemaMapText() {
  return cache.text
}

/** Nombres de colección válidos, para validar lo que pida el modelo antes de consultarlas. */
export function listCollectionNames() {
  return cache.names
}

export function schemaAge() {
  return cache.fetchedAt ? Date.now() - cache.fetchedAt : Infinity
}

