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

import * as data from '../data.js'
import { fmtDate, label } from '../lib/format.js'
import { renderSummary } from '../jobs/summaryText.js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY

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
]

const WRITE_TOOLS = new Set(['create_task', 'update_task_status', 'mark_invoice_paid'])

const SYSTEM_PROMPT = `Sos el agente interno del Dashboard Mateo Estudio (agencia de desarrollo web y marketing digital).
Te escriben por Telegram en español rioplatense, de forma informal y directa.
Tu trabajo es responder consultas de estado y, cuando te lo pidan, proponer crear o modificar registros.
Reglas:
- Usá las tools disponibles para responder con datos reales, nunca inventes números ni estados.
- Si el pedido no da para ninguna tool (charla, saludo, pregunta general), respondé en texto sin usar tools.
- Para pedidos de ESCRITURA (crear tarea, cambiar estado, marcar factura pagada) siempre llamá a la tool correspondiente una sola vez — el sistema se encarga de pedir confirmación, vos no confirmes nada.
- Sé breve. Nada de relleno.`

// ────────────────────────────── Punto de entrada único ──────────────────────────────

export async function interpretFreeText(userText) {
  if (ANTHROPIC_KEY) return callClaude(userText)
  if (GROQ_KEY) return callGroq(userText)
  if (GEMINI_KEY) return callGemini(userText)
  return null
}

// ────────────────────────────── Proveedor: Claude (Anthropic) ──────────────────────────────

let anthropicClient = null
async function callClaude(userText) {
  if (!anthropicClient) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_KEY })
  }
  const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

  const msg = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: [{ role: 'user', content: userText }],
  })

  const toolUse = msg.content.find(b => b.type === 'tool_use')
  if (!toolUse) {
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    return { type: 'reply', text: text || 'No entendí bien, ¿podés reformular?' }
  }

  if (WRITE_TOOLS.has(toolUse.name)) return buildWriteAction({ name: toolUse.name, input: toolUse.input })
  return { type: 'read', text: await runReadTool({ name: toolUse.name, input: toolUse.input }) }
}

// ────────────────────────────── Proveedor: Groq (gratis, formato OpenAI) ──────────────────────────────

let groqClient = null
const GROQ_TOOLS = TOOLS.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}))

async function callGroq(userText) {
  if (!groqClient) {
    const { default: Groq } = await import('groq-sdk')
    groqClient = new Groq({ apiKey: GROQ_KEY })
  }
  const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

  const completion = await groqClient.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
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
  return { type: 'read', text: await runReadTool(toolUse) }
}

// ────────────────────────────── Proveedor: Gemini (Google) ──────────────────────────────

let geminiModel = null
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

async function getGeminiModel() {
  if (geminiModel) return geminiModel
  const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(GEMINI_KEY)
  const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const functionDeclarations = TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.input_schema, SchemaType),
  }))
  geminiModel = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations }],
  })
  return geminiModel
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
  return { type: 'read', text: await runReadTool(toolUse) }
}

// ────────────────────────────── Lógica común (agnóstica del proveedor) ──────────────────────────────

async function runReadTool({ name, input }) {
  try {
    switch (name) {
      case 'list_tasks': {
        const tasks = await data.listTasks(input.status ? { status: input.status } : {})
        const filtered = input.status ? tasks : tasks.filter(t => t.status !== 'completada')
        if (!filtered.length) return 'No hay tareas ahí 🎉'
        return filtered.slice(0, 20).map(data.formatTask).join('\n\n')
      }
      case 'get_project_status': {
        const info = await data.getProjectStatus(input.name)
        if (!info) return `No encontré ningún proyecto que coincida con "${input.name}".`
        const pend = info.tasks.filter(t => t.status !== 'completada')
        return `*${info.project.name}* — ${info.client?.name || 'sin cliente'}\nEstado: ${label(info.project.status)} · Progreso: ${info.project.progress || 0}%\nTareas pendientes: ${pend.length}`
      }
      case 'get_client_summary': {
        const info = await data.getClientSummary(input.name)
        if (!info) return `No encontré ningún cliente que coincida con "${input.name}".`
        const pendingInvoices = info.invoices.filter(i => i.status !== 'pagada' && i.status !== 'borrador')
        return `*${info.client.name}*\nProyectos: ${info.projects.length}\nFacturas pendientes: ${pendingInvoices.length}`
      }
      case 'list_invoices': {
        const invoices = await data.listInvoices(input.status ? { status: input.status } : {})
        if (!invoices.length) return 'No hay facturas ahí.'
        return invoices.slice(0, 20).map(data.formatInvoice).join('\n')
      }
      case 'get_summary': {
        const summary = await data.buildSummary({ sinceDays: input.days === 7 ? 7 : 1 })
        return renderSummary(summary, { title: input.days === 7 ? 'Resumen semanal' : 'Resumen del día' })
      }
      default:
        return 'No sé cómo resolver eso todavía.'
    }
  } catch (err) {
    console.error('[ai] error ejecutando tool de lectura', name, err)
    return '⚠️ Tuve un error consultando eso.'
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
}
