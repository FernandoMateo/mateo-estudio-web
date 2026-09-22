// Generador de propuestas comerciales con IA. Fer completa unos campos en el dashboard
// (módulo "Propuestas"), el frontend crea un registro en `proposals` con status="pendiente",
// y acá lo tomamos: armamos un prompt con la info real del estudio + el catálogo de servicios
// + los datos que cargó Fer, le pedimos a la IA (mismo proveedor que ya usa el bot de Telegram:
// Anthropic > Groq > Gemini) que redacte la propuesta completa en JSON estructurado, la
// guardamos, y avisamos por Telegram con un resumen — así llega al teléfono apenas está lista.

import { withAuth } from '../pocketbase.js'
import { generateText } from '../ai/agent.js'
import { getExtraInstructionsText } from '../aiSettings.js'
import { fmtByCurrency } from '../lib/format.js'

const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
const POLL_MS = Number(process.env.PROPOSAL_POLL_MS) || 15000
const DASHBOARD_URL = (process.env.DASHBOARD_URL || 'https://mateoestudio.cloud').replace(/\/$/, '')

const STUDIO_PROFILE = `Mateo Estudio es una agencia de desarrollo web y marketing digital, con
operación en Córdoba (Argentina), Panamá y Miami. Combina diseño, desarrollo de software a medida
(sitios, plataformas, paneles internos) y estrategia de marketing digital (redes, contenido,
performance). Trabaja de forma cercana y directa con cada cliente, con entregas iterativas y
comunicación constante. Se destaca por combinar criterio de diseño de alto nivel con ejecución
técnica sólida — no es una agencia que solo "arma piezas", resuelve el negocio completo del cliente.`

const TONE_GUIDE = {
  cercano: 'Tono cercano y humano, en español rioplatense neutro, como si Fer le escribiera directamente al cliente — cálido pero profesional, sin sonar robotizado ni genérico.',
  formal: 'Tono formal y corporativo, cuidando cada palabra, apropiado para una empresa grande o una licitación — sin perder calidez, pero con más distancia y precisión.',
  premium: 'Tono premium y aspiracional, transmitiendo exclusividad y alto valor — lenguaje cuidado, seguro de sí mismo, orientado a resultados de negocio, sin caer en exagerado ni vacío.',
}

const JSON_SHAPE = `{
  "headline": "título gancho de la propuesta, menciona el proyecto o la necesidad del cliente",
  "subheadline": "una sola línea que resume qué se propone",
  "intro": "párrafo de apertura, personalizado con el nombre del destinatario/empresa si se dio",
  "understanding": "párrafo que demuestra que se entendió el objetivo/problema puntual del cliente",
  "sections": [ { "title": "string", "body": "string" } ],
  "services": [ { "name": "string", "description": "string, cómo aplica este servicio a este cliente puntual", "deliverables": ["string", "string"] } ],
  "timeline": [ { "label": "string, ej. Semana 1-2", "detail": "string" } ],
  "investment_note": "cómo se presenta la inversión — si hay un monto de referencia usalo como estimado, si no, decí que se ajusta según alcance final sin inventar cifras",
  "why_us": ["string", "string", "string"],
  "next_steps": "cierre con llamado a la acción concreto"
}`

function buildPrompt(proposal, client, services) {
  const recipient = client?.name || proposal.recipient_name || 'el destinatario'
  const company = client?.company || proposal.recipient_company || ''
  const servicesText = services.length
    ? services.map(s => `- ${s.name} (${s.category || 'servicio'})${s.description ? ': ' + s.description : ''}${s.price ? ` — precio de referencia: ${fmtByCurrency(s.price, s.price_currency || 'ARS')}` : ''}`).join('\n')
    : '(Fer no seleccionó servicios puntuales del catálogo — proponé el enfoque en base al objetivo, sin inventar servicios que el estudio no ofrece.)'
  const budgetText = proposal.budget_hint
    ? `Monto de referencia que Fer quiere reflejar (como estimado, orientativo): ${fmtByCurrency(proposal.budget_hint, proposal.currency || 'ARS')}`
    : 'No se dio un monto de referencia — no inventes cifras, dejá la inversión abierta a definir según alcance.'
  const extra = getExtraInstructionsText()

  return `Redactá una propuesta comercial completa para ${recipient}${company ? ` (${company})` : ''}.

Objetivo/contexto que cargó Fer (el dueño del estudio):
"""${proposal.objective}"""

${proposal.extra_notes ? `Notas adicionales de Fer: """${proposal.extra_notes}"""\n` : ''}
Servicios del catálogo real de Mateo Estudio a incluir:
${servicesText}

${budgetText}
${proposal.timeline_hint ? `Plazo de referencia que dio Fer: ${proposal.timeline_hint}` : ''}

Tono: ${TONE_GUIDE[proposal.tone] || TONE_GUIDE.cercano}
${extra ? `\nInstrucciones adicionales que Fer dejó cargadas para la IA del estudio:\n${extra}\n` : ''}

Devolvé ÚNICAMENTE un JSON válido (sin \`\`\`, sin texto antes ni después) con exactamente esta forma:
${JSON_SHAPE}

No inventes servicios, precios ni plazos que no se te dieron. Escribí todo en español.`
}

async function fetchClient(id) {
  if (!id) return null
  try { return await withAuth((pb) => pb.collection('clients').getOne(id)) } catch { return null }
}

async function fetchServices(ids) {
  if (!ids?.length) return []
  try {
    const results = await Promise.all(ids.map(id => withAuth((pb) => pb.collection('services').getOne(id)).catch(() => null)))
    return results.filter(Boolean)
  } catch { return [] }
}

async function broadcast(bot, text) {
  for (const chatId of ALLOWED_CHAT_IDS) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(err => console.error('[proposals] telegram error', chatId, err.message))
  }
}

function stripJsonFences(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

async function processOne(bot, proposal) {
  await withAuth((pb) => pb.collection('proposals').update(proposal.id, { status: 'generando' }))
  try {
    const [client, services] = await Promise.all([
      fetchClient(proposal.client),
      fetchServices(proposal.services),
    ])
    const prompt = buildPrompt(proposal, client, services)
    const raw = await generateText({
      system: `Sos el redactor de propuestas comerciales de Mateo Estudio.\n\n${STUDIO_PROFILE}`,
      prompt,
      maxTokens: 4096,
    })
    const parsed = JSON.parse(stripJsonFences(raw))

    await withAuth((pb) => pb.collection('proposals').update(proposal.id, {
      status: 'listo',
      generated_json: JSON.stringify(parsed),
      generated_at: new Date().toISOString(),
    }))

    const link = `${DASHBOARD_URL}/app/propuestas`
    const recipient = client?.name || proposal.recipient_name || 'el cliente'
    await broadcast(bot, `✦ *Propuesta lista*\n"${proposal.title}" para *${recipient}*\n\n_${parsed.subheadline || ''}_\n\n${link}`)
    console.log('[proposals] generada OK:', proposal.id)
  } catch (err) {
    console.error('[proposals] error generando', proposal.id, err.message)
    await withAuth((pb) => pb.collection('proposals').update(proposal.id, {
      status: 'error',
      error_message: err.message?.slice(0, 500) || 'Error desconocido',
    })).catch(() => {})
    await broadcast(bot, `⚠️ No pude generar la propuesta "${proposal.title}" — revisala en el dashboard.`)
  }
}

async function tick(bot) {
  const pending = await withAuth((pb) => pb.collection('proposals').getList(1, 5, {
    filter: 'status = "pendiente"',
    sort: '+created',
  }))
  for (const proposal of pending.items) {
    await processOne(bot, proposal)
  }
}

export function startProposalGenerator(bot) {
  const loop = () => tick(bot).catch(err => console.error('[proposals] error en el poll:', err.message))
  loop()
  setInterval(loop, POLL_MS)
  console.log(`[proposals] activo — generando propuestas pendientes cada ${POLL_MS / 1000}s`)
}

