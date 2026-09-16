// Modo "lenguaje natural": si hay ANTHROPIC_API_KEY, GROQ_API_KEY o GEMINI_API_KEY configurada,
// cualquier mensaje que no sea un comando "/" se interpreta con un modelo usando tool-use /
// function calling. Las acciones de SOLO LECTURA se ejecutan directo; las de ESCRITURA
// (crear/modificar algo en PocketBase) nunca se ejecutan solas — se arma un texto de
// confirmación y el bot espera un "sí" antes de tocar la base.
//
// Orden de preferencia si hay más de una key configurada: Claude (Anthropic) > Groq > Gemini.
// Groq (https://console.groq.com) tiene un tier gratis generoso y sin tarjeta — recomendado
// si no querés pagar. Gemini hoy (sept. 2026) tiene un bug conocido de Google con las claves
// nuevas formato "AQ." que rompe la autenticación — evitalo hasta que Google lo resuelva.
//
// Redacción de respuestas: las tools específicas (list_tasks, get_summary, etc.) ya devuelven
// texto prolijo en español. Pero query_collection/get_record traen datos crudos de PocketBase
// (JSON), así que antes de contestarle al usuario se los volvemos a pasar al modelo pidiéndole
// que redacte una respuesta natural en base a esos datos — así nunca le llega JSON en Telegram.

import * as data from '../data.js'
import { fmtDate, label } from '../lib/format.js'
import { renderSummary } from '../jobs/summaryText.js'
import { getSchemaMapText, listCollectionNames } from '../schemaMap.js'
import { getExtraInstructionsText } from '../aiSettings.js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

// ── Definición de tools, en formato agnóstico (JSON-schema simple) ──
const TOOLS = [
  {
    name: 'list_tasks',
    description: 'Lista tareas, opcionalmente filtradas por estado (pendiente, en_progreso, completada).',
    input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'] } } },
  },
  {
    name: 'get_project_status',
    description: 'Estado y tareas pendientes de un proyecto por nombre (búsqueda aproximada).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'get_client_summary',
    description: 'Resumen de un cliente (proyectos y facturas pendientes) por nombre.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'list_invoices',
    description: 'Lista facturas, opcionalmente filtradas por estado (borrador, enviada, pagada, vencida).',
    input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['borrador', 'enviada', 'pagada', 'vencida'] } } },
  },
  {
    name: 'get_summary',
    description: 'Resumen general del estudio: tareas completadas recientemente, vencidas, facturas vencidas/pendientes, proyectos activos.',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: '1 para resumen diario, 7 para semanal' } } },
  },
  {
    name: 'create_task',
    description: 'ACCIÓN DE ESCRITURA. Crea una tarea nueva. Requiere confirmación del usuario antes de ejecutarse.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        project_name: { type: 'string' },
        assignee_name: { type: 'string' },
        due_date: { type: 'string', description: 'formato YYYY-MM-DD' },
        priority: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'ACCIÓN DE ESCRITURA. Cambia el estado de una tarea existente (buscada por título). Requiere confirmación.',
    input_schema: {
      type: 'object',
      properties: { task_query: { type: 'string' }, status: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'] } },
      required: ['task_query', 'status'],
    },
  },
  {
    name: 'mark_invoice_paid',
    description: 'ACCIÓN DE ESCRITURA. Marca una factura como pagada (buscada por número o título). Requiere confirmación.',
    input_schema: { type: 'object', properties: { invoice_query: { type: 'string' } }, required: ['invoice_query'] },
  },
  {
    name: 'query_collection',
    description: 'Consulta CUALQUIER colección del sistema (más allá de tareas/facturas: cotizaciones, servicios, servicios recurrentes, gastos recurrentes, planificador de redes, documentos de cliente, comentarios, historial de actividad, usuarios, invitaciones, etc.) usando el mapa de datos que se te dio. Usala para cualquier pregunta que no cubran las tools específicas de arriba.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'nombre exacto de la colección, tal como aparece en el mapa de datos' },
        filter: { type: 'string', description: 'filtro en sintaxis PocketBase, ej: status = "pendiente" && client = "abc123". Vacío para traer todo.' },
        sort: { type: 'string', description: 'ej: -created, due_date' },
        limit: { type: 'number', description: 'máximo de resultados, por defecto 15, tope 50' },
      },
      required: ['collection'],
    },
  },
  {
    name: 'get_record',
    description: 'Trae un registro puntual de cualquier colección por su id (por ejemplo para ver el detalle completo de algo que devolvió query_collection).',
    input_schema: {
      type: 'object',
      properties: { collection: { type: 'string' }, id: { type: 'string' } },
      required: ['collection', 'id'],
    },
  },
  {
    name: 'create_record',
    description: 'ACCIÓN DE ESCRITURA genérica: crea un registro nuevo en CUALQUIER colección del sistema (cotizaciones, servicios, servicios recurrentes, gastos recurrentes, planificador de redes, documentos de cliente, etc.), usando los nombres de campo del mapa de datos. Para tareas y facturas preferí siempre create_task (es más preciso). No sirve para la colección "users" (las altas de usuarios/clientes se hacen desde el dashboard). Requiere confirmación del usuario antes de ejecutarse.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'nombre exacto de la colección, tal como aparece en el mapa de datos' },
        fields: { type: 'object', description: 'campos del registro nuevo como pares clave-valor, según el mapa de datos de esa colección' },
      },
      required: ['collection', 'fields'],
    },
  },
  {
    name: 'update_record',
    description: 'ACCIÓN DE ESCRITURA genérica: modifica campos de un registro existente en CUALQUIER colección, identificado por su id (si no lo tenés, buscalo antes con query_collection). Para tareas y facturas preferí siempre las tools específicas. No sirve para la colección "users". Requiere confirmación del usuario antes de ejecutarse.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        id: { type: 'string' },
        fields: { type: 'object', description: 'solo los campos que hay que cambiar, como pares clave-valor' },
      },
      required: ['collection', 'id', 'fields'],
    },
  },
]

// Colecciones donde las tools genéricas de escritura NUNCA pueden tocar nada, aunque el modelo
// lo pida — altas/bajas de usuarios tienen su propio flujo (contraseñas, portal) en el dashboard.
const WRITE_BLOCKED_COLLECTIONS = new Set(['users'])

const WRITE_TOOLS = new Set(['create_task', 'update_task_status', 'mark_invoice_paid', 'create_record', 'update_record'])

const BASE_SYSTEM_PROMPT = `Sos el agente interno del Dashboard Mateo Estudio (agencia de desarrollo web y marketing digital, con clientes en Argentina, Panamá y Miami).
Te escriben por Telegram en español rioplatense, de forma informal, cálida y directa — como un compañero de equipo copado, nunca como un sistema robótico.

El sistema tiene estos módulos (todos viven en la misma base PocketBase, cada uno con su/s colección/es):
- Clientes y proyectos (con su estado, progreso y renovaciones recurrentes)
- Tareas del equipo (con prioridad, responsable y vencimiento)
- Cotizador: presupuestos/propuestas para clientes, con líneas de servicio y estado de aceptación/rechazo
- Servicios (catálogo, incluidos los de facturación recurrente: mensual/trimestral/anual)
- Facturas y transacciones (pagos, vencimientos, moneda ARS/USD/MXN)
- Gastos recurrentes del estudio
- Planificador de contenido / redes sociales
- Documentos y comentarios de cliente, historial de actividad
- Usuarios y roles (admin, equipo, cliente, colaborador) e invitaciones de clientes al portal

Tu trabajo es responder consultas de estado sobre CUALQUIERA de estos módulos y, cuando te lo pidan, proponer crear o modificar registros.

Reglas:
- Para tareas, proyectos, clientes, facturas y resúmenes usá las tools específicas primero (son más precisas). Para todo lo demás — o si una tool específica no alcanza — usá query_collection/get_record con el mapa de datos de abajo.
- Para pedidos que necesitan varios pasos (por ejemplo: "buscá la cotización de tal cliente y marcala como aceptada") podés encadenar tools: primero consultá con query_collection para encontrar el id, y recién después usá update_record con ese id. No inventes ids.
- Nunca inventes datos, números ni estados: si no tenés la info, consultala con una tool.
- Si el pedido no da para ninguna tool (charla, saludo, pregunta general), respondé en texto sin usar tools.
- Para pedidos de ESCRITURA (crear tarea, cambiar estado, marcar factura pagada, o crear/modificar cualquier otro registro con create_record/update_record) siempre llamá a la tool correspondiente una sola vez — el sistema se encarga de pedir confirmación, vos no confirmes nada. query_collection y get_record son de solo lectura, nunca crean ni modifican nada.
- create_record/update_record son las tools "comodín" para todo lo que no tenga una tool específica: cotizaciones, servicios, gastos recurrentes, planificador de redes, documentos, comentarios, etc. Fijate bien los nombres de campo exactos en el mapa de datos antes de usarlas. Nunca las uses con la colección "users".
- Sé breve. Nada de relleno.

Mapa de datos actual (colección: campos — se actualiza solo cuando se agrega algo nuevo al sistema, no hace falta que lo memorices, es tu referencia en cada mensaje):
{{SCHEMA_MAP}}`

function buildSystemPrompt() {
  let prompt = BASE_SYSTEM_PROMPT.replace('{{SCHEMA_MAP}}', getSchemaMapText())
  const extra = getExtraInstructionsText()
  if (extra) {
    prompt += `\n\nInstrucciones adicionales que te dejó el equipo de Mateo Estudio desde el módulo "Herramienta IA" (seguilas siempre; si entran en conflicto con algo de arriba, priorizalas a ellas):\n${extra}`
  }
  return prompt
}

// Prompt para la segunda pasada: redactar en natural el JSON crudo que devuelve PocketBase.
function buildNarratePrompt(userText, rawData) {
  return `El usuario te preguntó esto por Telegram: "${userText}"

Corriste una consulta a la base de datos y esto es lo que encontraste (JSON crudo, puede ser un array o un solo objeto):
${JSON.stringify(rawData)}

Redactá la respuesta para el usuario en español rioplatense, natural y conversacional — como si se lo estuvieras contando vos, no como un volcado de datos. Reglas:
- NUNCA muestres JSON, llaves, corchetes, ids técnicos ni nombres de campos en inglés (collectionId, fx_rate, etc.).
- Si hay varios resultados, armá una lista prolija (con guiones o numeración), lo más relevante primero.
- Si hay montos, mostralos con el símbolo de moneda que corresponda (ARS, USD, MXN) y redondeados si tiene sentido.
- Si algo no tiene dato (vacío, null), simplemente omitilo, no lo menciones como "null" o "undefined".
- Sé breve y directo, pero completo: respondé específicamente lo que te preguntaron.
- No inventes nada que no esté en los datos de arriba.`
}

// ────────────────────────────── Punto de entrada único ──────────────────────────────

export async function interpretFreeText(userText) {
  if (ANTHROPIC_KEY) return callClaude(userText)
  if (GROQ_KEY) return callGroq(userText)
  if (GEMINI_KEY) return callGemini(userText)
  return null
}

// ────────────────────────────── Proveedor: Claude (Anthropic) ──────────────────────────────

let anthropicClient = null
async function ensureAnthropicClient() {
  if (!anthropicClient) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_KEY })
  }
  return anthropicClient
}

// Claude puede encadenar varios pasos de lectura antes de contestar (por ejemplo: "buscá la
// cotización de Aires y contame el total" primero busca con query_collection y recién ahí
// redacta). Si en algún paso pide una tool de ESCRITURA, cortamos ahí mismo: se arma el texto
// de confirmación y no se sigue de largo — nunca se escribe nada sin que el usuario diga "sí".
// Tope de 5 idas y vueltas por mensaje, para no gastar de más si el modelo se traba en loop.
async function callClaude(userText) {
  const client = await ensureAnthropicClient()
  const system = buildSystemPrompt()
  const messages = [{ role: 'user', content: userText }]

  for (let step = 0; step < 5; step++) {
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages,
    })

    const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use')
    if (!toolUseBlocks.length) {
      const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      return { type: 'reply', text: text || 'No entendí bien, ¿podés reformular?' }
    }

    const writeBlock = toolUseBlocks.find(b => WRITE_TOOLS.has(b.name))
    if (writeBlock) return buildWriteAction({ name: writeBlock.name, input: writeBlock.input })

    // Todas las tools pedidas en este paso son de lectura: las corremos y le devolvemos los
    // resultados al modelo para que siga razonando (o redacte la respuesta final).
    messages.push({ role: 'assistant', content: msg.content })
    const toolResults = []
    for (const block of toolUseBlocks) {
      const result = await runReadTool({ name: block.name, input: block.input })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result.raw !== undefined ? result.raw : result.text),
      })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return { type: 'reply', text: 'Se me complicó resolver eso en varios pasos — probá pedírmelo más simple o de a partes.' }
}

// ────────────────────────────── Proveedor: Groq (gratis, formato OpenAI) ──────────────────────────────

let groqClient = null
const GROQ_TOOLS = TOOLS.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}))

async function ensureGroqClient() {
  if (!groqClient) {
    const { default: Groq } = await import('groq-sdk')
    groqClient = new Groq({ apiKey: GROQ_KEY })
  }
  return groqClient
}

async function callGroq(userText) {
  const client = await ensureGroqClient()

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: userText },
    ],
    tools: GROQ_TOOLS,
    tool_choice: 'auto',
  })

  const choice = completion.choices[0].message
  const toolCall = choice.tool_calls?.[0]
  if (!toolCall) {
    return { type: 'reply', text: choice.content?.trim() || 'No entendí bien, ¿podés reformular?' }
  }

  let input = {}
  try { input = JSON.parse(toolCall.function.arguments || '{}') } catch { /* deja input vacío si viene mal formado */ }
  const toolUse = { name: toolCall.function.name, input }
  if (WRITE_TOOLS.has(toolUse.name)) return buildWriteAction(toolUse)
  const result = await runReadTool(toolUse)
  return { type: 'read', text: await finalizeReadResult(userText, result, narrateGroq) }
}

async function narrateGroq(prompt) {
  const client = await ensureGroqClient()
  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
  })
  return completion.choices[0].message.content?.trim() || ''
}

// ────────────────────────────── Proveedor: Gemini (Google) ──────────────────────────────

function toGeminiSchema(schema, SchemaType) {
  if (!schema) return undefined
  const typeMap = { object: SchemaType.OBJECT, string: SchemaType.STRING, number: SchemaType.NUMBER, boolean: SchemaType.BOOLEAN, array: SchemaType.ARRAY }
  const out = { type: typeMap[schema.type] || SchemaType.STRING }
  if (schema.description) out.description = schema.description
  if (schema.enum) out.enum = schema.enum
  if (schema.properties) {
    out.properties = {}
    for (const [k, v] of Object.entries(schema.properties)) out.properties[k] = toGeminiSchema(v, SchemaType)
  }
  if (schema.required) out.required = schema.required
  if (schema.items) out.items = toGeminiSchema(schema.items, SchemaType)
  return out
}

let geminiGenAI = null
let geminiSchemaTypeRef = null
async function ensureGeminiGenAI() {
  if (!geminiGenAI) {
    const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai')
    geminiGenAI = new GoogleGenerativeAI(GEMINI_KEY)
    geminiSchemaTypeRef = SchemaType
  }
  return geminiGenAI
}

async function getGeminiModel() {
  const genAI = await ensureGeminiGenAI()
  // Se reconstruye en cada llamada (es liviano) para que el system prompt siempre lleve el
  // mapa de datos al día, incluso si se agregó una colección desde la última vez.
  const functionDeclarations = TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.input_schema, geminiSchemaTypeRef),
  }))
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: buildSystemPrompt(),
    tools: [{ functionDeclarations }],
  })
}

async function callGemini(userText) {
  const model = await getGeminiModel()
  const result = await model.generateContent(userText)
  const response = result.response
  const calls = response.functionCalls?.() || []

  if (!calls.length) {
    const text = response.text()?.trim()
    return { type: 'reply', text: text || 'No entendí bien, ¿podés reformular?' }
  }

  const call = calls[0]
  const toolUse = { name: call.name, input: call.args || {} }
  if (WRITE_TOOLS.has(toolUse.name)) return buildWriteAction(toolUse)
  const toolResult = await runReadTool(toolUse)
  return { type: 'read', text: await finalizeReadResult(userText, toolResult, narrateGemini) }
}

async function narrateGemini(prompt) {
  const genAI = await ensureGeminiGenAI()
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
  const result = await model.generateContent(prompt)
  return result.response.text()?.trim() || ''
}

// ────────────────────────────── Lógica común (agnóstica del proveedor) ──────────────────────────────

// Si el resultado de la tool trae datos crudos (query_collection/get_record), le pide al
// modelo que los redacte en natural antes de devolvérselos al usuario. Si ya viene un texto
// prolijo (list_tasks, get_summary, etc.) lo devuelve tal cual, sin gastar una llamada extra.
async function finalizeReadResult(userText, result, narrateFn) {
  if (!result.raw) return result.text
  try {
    const prompt = buildNarratePrompt(userText, result.raw)
    const narrated = await narrateFn(prompt)
    return narrated || result.text
  } catch (err) {
    console.error('[ai] error redactando respuesta natural, devuelvo el resumen crudo:', err)
    return result.text
  }
}

async function runReadTool({ name, input }) {
  try {
    switch (name) {
      case 'list_tasks': {
        const tasks = await data.listTasks(input.status ? { status: input.status } : {})
        const filtered = input.status ? tasks : tasks.filter(t => t.status !== 'completada')
        if (!filtered.length) return { text: 'No hay tareas ahí 🎉' }
        return { text: filtered.slice(0, 20).map(data.formatTask).join('\n\n') }
      }
      case 'get_project_status': {
        const info = await data.getProjectStatus(input.name)
        if (!info) return { text: `No encontré ningún proyecto que coincida con "${input.name}".` }
        const pend = info.tasks.filter(t => t.status !== 'completada')
        return { text: `*${info.project.name}* — ${info.client?.name || 'sin cliente'}\nEstado: ${label(info.project.status)} · Progreso: ${info.project.progress || 0}%\nTareas pendientes: ${pend.length}` }
      }
      case 'get_client_summary': {
        const info = await data.getClientSummary(input.name)
        if (!info) return { text: `No encontré ningún cliente que coincida con "${input.name}".` }
        const pendingInvoices = info.invoices.filter(i => i.status !== 'pagada' && i.status !== 'borrador')
        return { text: `*${info.client.name}*\nProyectos: ${info.projects.length}\nFacturas pendientes: ${pendingInvoices.length}` }
      }
      case 'list_invoices': {
        const invoices = await data.listInvoices(input.status ? { status: input.status } : {})
        if (!invoices.length) return { text: 'No hay facturas ahí.' }
        return { text: invoices.slice(0, 20).map(data.formatInvoice).join('\n') }
      }
      case 'get_summary': {
        const summary = await data.buildSummary({ sinceDays: input.days === 7 ? 7 : 1 })
        return { text: renderSummary(summary, { title: input.days === 7 ? 'Resumen semanal' : 'Resumen del día' }) }
      }
      case 'query_collection': {
        const { error, items } = await data.queryCollection({
          collection: input.collection, filter: input.filter, sort: input.sort, limit: input.limit,
        })
        if (error) return { text: `⚠️ ${error}` }
        if (!items.length) return { text: `No encontré nada en "${input.collection}" con eso.` }
        return { text: `Encontré ${items.length} resultado(s) en "${input.collection}".`, raw: items }
      }
      case 'get_record': {
        const { error, item } = await data.getRecordById({ collection: input.collection, id: input.id })
        if (error) return { text: `⚠️ ${error}` }
        return { text: `Encontré el registro en "${input.collection}".`, raw: item }
      }
      default:
        return { text: 'No sé cómo resolver eso todavía.' }
    }
  } catch (err) {
    console.error('[ai] error ejecutando tool de lectura', name, err)
    return { text: '⚠️ Tuve un error consultando eso.' }
  }
}

function buildWriteAction({ name, input }) {
  if (name === 'create_task') {
    return {
      type: 'write',
      confirmText: `Crear tarea *${input.title}*${input.project_name ? ` (proyecto: ${input.project_name})` : ''}${input.assignee_name ? ` (responsable: ${input.assignee_name})` : ''}${input.due_date ? ` (vence: ${fmtDate(input.due_date)})` : ''}`,
      execute: async () => {
        const { project, assignee, projectNotFound, assigneeNotFound } = await data.createTask({
          title: input.title, projectName: input.project_name, assignedToName: input.assignee_name,
          dueDate: input.due_date, priority: input.priority,
        })
        await data.notifyAdmins({ title: 'Nueva tarea (agente)', message: input.title, type: 'tarea', project: project?.id || '' })
        const warnings = [
          projectNotFound && `⚠️ no encontré el proyecto "${input.project_name}"`,
          assigneeNotFound && `⚠️ no encontré a "${input.assignee_name}"`,
        ].filter(Boolean)
        return [`✅ Tarea creada: *${input.title}*`, ...warnings].join('\n')
      },
    }
  }
  if (name === 'update_task_status') {
    return {
      type: 'write',
      confirmText: `Marcar la tarea "${input.task_query}" como *${label(input.status)}*`,
      execute: async () => {
        const updated = await data.updateTaskStatus(input.task_query, input.status)
        return updated ? `✅ Tarea actualizada: ${updated.title} → ${label(input.status)}` : `No encontré ninguna tarea que coincida con "${input.task_query}".`
      },
    }
  }
  if (name === 'mark_invoice_paid') {
    return {
      type: 'write',
      confirmText: `Marcar la factura "${input.invoice_query}" como *pagada*`,
      execute: async () => {
        const updated = await data.markInvoicePaid(input.invoice_query)
        return updated ? `✅ Factura marcada como pagada: ${updated.number || updated.title}` : `No encontré ninguna factura que coincida con "${input.invoice_query}".`
      },
    }
  }
  if (name === 'create_record' || name === 'update_record') {
    const collection = input.collection
    const blocked = WRITE_BLOCKED_COLLECTIONS.has(collection)
    const known = listCollectionNames()
    const unknown = known.length && !known.includes(collection)
    if (blocked || unknown) {
      return {
        type: 'reply',
        text: blocked
          ? `⚠️ No puedo crear ni modificar registros en "${collection}" — esa colección se maneja desde el dashboard, no desde acá.`
          : `⚠️ "${collection}" no es una colección que exista ahora mismo.`,
      }
    }
    const fieldsPreview = Object.entries(input.fields || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
    if (name === 'create_record') {
      return {
        type: 'write',
        confirmText: `Crear un registro nuevo en *${collection}* con estos datos:\n${fieldsPreview || '(sin campos)'}`,
        execute: async () => {
          const { error, item } = await data.createRecordGeneric({ collection, fields: input.fields || {} })
          if (error) return `⚠️ ${error}`
          return `✅ Listo, creé el registro en *${collection}* (id: ${item.id}).`
        },
      }
    }
    return {
      type: 'write',
      confirmText: `Modificar el registro ${input.id} en *${collection}* — cambiar:\n${fieldsPreview || '(sin campos)'}`,
      execute: async () => {
        const { error, item } = await data.updateRecordGeneric({ collection, id: input.id, fields: input.fields || {} })
        if (error) return `⚠️ ${error}`
        return `✅ Listo, actualicé el registro en *${collection}* (id: ${item.id}).`
      },
    }
  }
}
