// Nahuel — sale a buscar clientes potenciales en Google Maps (por defecto: Miami, Ciudad de
// México y Ciudad de Panamá) en los rubros configurados, priorizando los negocios que NO
// tienen sitio web cargado en su ficha — el perfil ideal para Mateo Estudio. Guarda todo en
// `leads` (nunca toca `clients`) y avisa por Telegram lo nuevo que encuentra en cada corrida.
//
// Necesita GOOGLE_MAPS_API_KEY: en Google Cloud Console, un proyecto con facturación activa
// (tarjeta cargada — Google da uso gratis mensual, pero hace falta habilitarla igual) y la
// "Places API" habilitada. Sin esa key, Nahuel se queda pausado y lo avisa en el panel.

import cron from 'node-cron'
import { withAuth } from '../pocketbase.js'
import { isEnabled, reportRun, getState, setState } from '../agents.js'

const KEY = 'nahuel'
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
const API_KEY = process.env.GOOGLE_MAPS_API_KEY
const CITIES = (process.env.NAHUEL_CITIES || 'Miami,Ciudad de México,Ciudad de Panamá').split(',').map((s) => s.trim()).filter(Boolean)
const CATEGORIES = (process.env.NAHUEL_CATEGORIES || 'restaurantes,clínicas dentales,estudios de abogados,inmobiliarias,gimnasios,spas y centros de estética,hoteles boutique,concesionarias de autos').split(',').map((s) => s.trim()).filter(Boolean)
const MAX_RESULTS_PER_RUN = Number(process.env.NAHUEL_MAX_RESULTS) || 10

async function broadcast(bot, text) {
  for (const chatId of ALLOWED_CHAT_IDS) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch((err) => console.error('[nahuel] telegram error', chatId, err.message))
  }
}

// Rota una combinación ciudad+rubro por corrida (guardado en el `state` de Fabian) — así, con
// el tiempo, cubre todo el mapa de búsquedas sin repetir siempre lo mismo ni pegarle 24 veces
// seguidas a la API en una sola corrida.
function nextCombo() {
  const total = CITIES.length * CATEGORIES.length
  const idx = (Number(getState(KEY)?.cursor) || 0) % total
  const city = CITIES[Math.floor(idx / CATEGORIES.length)]
  const category = CATEGORIES[idx % CATEGORIES.length]
  setState(KEY, { cursor: (idx + 1) % total })
  return { city, category }
}

async function textSearch(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`
  const res = await fetch(url)
  const json = await res.json()
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places textsearch: ${json.status} ${json.error_message || ''}`.trim())
  }
  return json.results || []
}

async function placeDetails(placeId) {
  const fields = 'website,formatted_phone_number,url,rating,user_ratings_total,formatted_address'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`
  const res = await fetch(url)
  const json = await res.json()
  return json.status === 'OK' ? json.result : null
}

async function leadExists(placeId) {
  try {
    await withAuth((pb) => pb.collection('leads').getFirstListItem(`place_id = "${placeId}"`))
    return true
  } catch { return false }
}

async function tick(bot) {
  if (!API_KEY) {
    await reportRun(KEY, { status: 'error', message: 'Falta GOOGLE_MAPS_API_KEY en el .env.' })
    return
  }
  if (!(await isEnabled(KEY))) return

  const { city, category } = nextCombo()
  const query = `${category} en ${city}`
  const results = await textSearch(query)
  const toCheck = results.slice(0, MAX_RESULTS_PER_RUN)

  const created = []
  for (const r of toCheck) {
    if (!r.place_id || (await leadExists(r.place_id))) continue
    const details = await placeDetails(r.place_id).catch(() => null)
    const website = details?.website || ''
    const lead = await withAuth((pb) => pb.collection('leads').create({
      name: r.name,
      category,
      city,
      address: details?.formatted_address || r.formatted_address || '',
      phone: details?.formatted_phone_number || '',
      website,
      maps_url: details?.url || '',
      place_id: r.place_id,
      rating: details?.rating ?? r.rating ?? null,
      ratings_total: details?.user_ratings_total ?? r.user_ratings_total ?? null,
      no_website: !website,
      status: 'nuevo',
      source: 'google_maps',
    }))
    created.push(lead)
  }

  const withoutSite = created.filter((l) => l.no_website)
  const message = `"${query}": ${created.length} lead(s) nuevo(s), ${withoutSite.length} sin sitio web.`
  await reportRun(KEY, { status: 'ok', message })

  if (created.length) {
    const lines = [`🗺️ *Nahuel* — ${message}`, '']
    created.slice(0, 10).forEach((l) => {
      lines.push(`  · ${l.no_website ? '🔴' : '⚪'} *${l.name}* — ${l.phone || 'sin teléfono'}${l.no_website ? ' _(sin sitio web!)_' : ''}`)
    })
    lines.push('', '_Los 🔴 sin sitio son los que más rápido podés cerrar._')
    await broadcast(bot, lines.join('\n'))
  }
}

export function startNahuel(bot) {
  const cronExpr = process.env.NAHUEL_CRON || '0 10 * * 1'
  const tz = process.env.TZ || 'America/Argentina/Cordoba'
  cron.schedule(cronExpr, () => tick(bot).catch((err) => { console.error('[nahuel] error', err); reportRun(KEY, { status: 'error', message: err.message }) }), { timezone: tz })
  console.log(`[nahuel] activo — prospección "${cronExpr}" (tz ${tz})${API_KEY ? '' : ' — ⚠️ falta GOOGLE_MAPS_API_KEY'}`)
}

export const runOnce = tick
