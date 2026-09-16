import TelegramBot from 'node-telegram-bot-api'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as data from '../data.js'
import { fmtByCurrency, fmtDate, label } from '../lib/format.js'
import { renderSummary } from '../jobs/summaryText.js'
import { interpretFreeText } from '../ai/agent.js'
import { transcribeAudio } from '../ai/transcribe.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ALLOWED = new Set((process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean))

if (!TOKEN) throw new Error('Falta TELEGRAM_BOT_TOKEN en el .env del agente.')
if (!ALLOWED.size) console.warn('[telegram] ⚠️  TELEGRAM_ALLOWED_CHAT_IDS está vacío: el bot no le va a responder a NADIE hasta que lo completes (por seguridad).')

export const bot = new TelegramBot(TOKEN, { polling: true })

// Estado de confirmación pendiente por chat (para acciones de escritura pedidas en lenguaje natural)
const pendingConfirm = new Map() // chatId -> { action, params, expiresAt }

function isAllowed(chatId) { return ALLOWED.has(String(chatId)) }

function reply(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(async () => {
    // si Markdown rompe el mensaje por algún caracter raro, reintenta en texto plano
    await bot.sendMessage(chatId, text.replace(/[*_`]/g, ''))
  })
}

bot.on('polling_error', (err) => console.error('[telegram] polling_error:', err.message))

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const isVoice = !!(msg.voice || msg.audio)
  const text = (msg.text || msg.caption || '').trim()
  console.log('[telegram] mensaje recibido de', chatId, '— voice:', !!msg.voice, 'audio:', !!msg.audio, 'text:', JSON.stringify(msg.text || ''))
  if (!text && !isVoice) return

  if (!isAllowed(chatId)) {
    console.warn(`[telegram] mensaje ignorado de chat no autorizado: ${chatId} ("${msg.from?.username || msg.from?.first_name}")`)
    // Respuesta mínima para que sepas el chat_id la primera vez que lo pruebes vos mismo.
    return bot.sendMessage(chatId, `No tenés acceso a este agente. Tu chat_id es: ${chatId}`)
  }

  try {
    if (isVoice) return await handleVoiceMessage(chatId, msg)

    if (text.startsWith('/')) return await handleCommand(chatId, text)

    // confirmación pendiente ("sí" / "confirmar" / "no")
    const pending = pendingConfirm.get(chatId)
    if (pending) {
      pendingConfirm.delete(chatId)
      if (/^(s[ií]|confirmar|dale|ok(ay)?)$/i.test(text)) return await executeConfirmedAction(chatId, pending)
      return reply(chatId, 'Cancelado, no hice ningún cambio.')
    }

    return await handleFreeText(chatId, text)
  } catch (err) {
    console.error('[telegram] error manejando mensaje:', err)
    return reply(chatId, '⚠️ Algo falló procesando eso. Probá de nuevo o usá /ayuda para ver los comandos.')
  }
})

// ────────────────────────────── Notas de voz ──────────────────────────────

async function handleVoiceMessage(chatId, msg) {
  const fileId = msg.voice?.file_id || msg.audio?.file_id
  console.log('[telegram] audio recibido, file_id:', fileId)
  bot.sendChatAction(chatId, 'typing').catch(() => {})

  let filePath
  try {
    filePath = await bot.downloadFile(fileId, os.tmpdir())
    // Telegram guarda las notas de voz como .oga (mismo formato que .ogg, pero Groq solo
    // reconoce la extensión ".ogg" — renombramos para que la acepte.
    if (path.extname(filePath).toLowerCase() === '.oga') {
      const renamed = filePath.slice(0, -4) + '.ogg'
      fs.renameSync(filePath, renamed)
      filePath = renamed
    }
  } catch (err) {
    console.error('[telegram] error descargando audio:', err)
    return reply(chatId, '⚠️ No pude descargar el audio.')
  }

  let text = null
  let transcribeError = false
  try {
    text = await transcribeAudio(filePath)
  } catch (err) {
    console.error('[telegram] error transcribiendo audio:', err)
    transcribeError = true
  } finally {
    fs.unlink(filePath, () => {})
  }

  if (transcribeError) {
    return reply(chatId, '⚠️ Tuve un error transcribiendo el audio. Mirá la consola del agente para más detalle.')
  }
  if (text === null) {
    return reply(chatId, 'No puedo transcribir audios todavía: falta `GROQ_API_KEY` en el `.env` (es gratis, en https://console.groq.com/keys).')
  }
  if (!text.trim()) {
    return reply(chatId, 'No entendí nada en el audio, ¿podés repetirlo o escribirlo?')
  }

  await reply(chatId, `🎙️ _"${text.trim()}"_`)

  if (text.trim().startsWith('/')) return handleCommand(chatId, text.trim())

  const pending = pendingConfirm.get(chatId)
  if (pending) {
    pendingConfirm.delete(chatId)
    if (/^(s[ií]|confirmar|dale|ok(ay)?)$/i.test(text.trim())) return executeConfirmedAction(chatId, pending)
    return reply(chatId, 'Cancelado, no hice ningún cambio.')
  }

  return handleFreeText(chatId, text.trim())
}

// ────────────────────────────── Comandos ──────────────────────────────

async function handleCommand(chatId, text) {
  const [cmdRaw, ...restParts] = text.slice(1).split(' ')
  const cmd = cmdRaw.toLowerCase()
  const rest = restParts.join(' ').trim()

  switch (cmd) {
    case 'start':
    case 'ayuda':
    case 'help':
      return reply(chatId, HELP_TEXT)

    case 'tareas': {
      const status = rest === 'todas' ? undefined : (rest || 'pendiente')
      const tasks = await data.listTasks(status && status !== 'pendiente' ? { status } : {})
      const filtered = status === undefined ? tasks : tasks.filter(t => t.status !== 'completada')
      if (!filtered.length) return reply(chatId, 'No hay tareas ahí 🎉')
      return reply(chatId, filtered.slice(0, 20).map(data.formatTask).join('\n\n'))
    }

    case 'vencidas': {
      const [tasks, invoices] = await Promise.all([data.listOverdueTasks(), data.listOverdueInvoices()])
      if (!tasks.length && !invoices.length) return reply(chatId, 'No hay nada vencido 🎉')
      const parts = []
      if (tasks.length) parts.push('⚠️ *Tareas vencidas*\n' + tasks.map(data.formatTask).join('\n\n'))
      if (invoices.length) parts.push('💸 *Facturas vencidas*\n' + invoices.map(data.formatInvoice).join('\n'))
      return reply(chatId, parts.join('\n\n'))
    }

    case 'facturas': {
      const status = rest || undefined
      const invoices = await data.listInvoices(status ? { status } : {})
      if (!invoices.length) return reply(chatId, 'No hay facturas ahí.')
      return reply(chatId, invoices.slice(0, 20).map(data.formatInvoice).join('\n'))
    }

    case 'pagar': {
      if (!rest) return reply(chatId, 'Usalo así: `/pagar 0001` (número o título de la factura)')
      const updated = await data.markInvoicePaid(rest)
      if (!updated) return reply(chatId, `No encontré ninguna factura que coincida con "${rest}".`)
      return reply(chatId, `✅ Marcada como pagada: ${updated.number || updated.title}`)
    }

    case 'proyecto': {
      if (!rest) return reply(chatId, 'Decime qué proyecto: `/proyecto QX Logística`')
      const info = await data.getProjectStatus(rest)
      if (!info) return reply(chatId, `No encontré ningún proyecto que coincida con "${rest}".`)
      const { project, tasks, client } = info
      const pend = tasks.filter(t => t.status !== 'completada')
      return reply(chatId, [
        `*${project.name}* — ${client?.name || 'sin cliente'}`,
        `Estado: ${label(project.status)} · Fase: ${label(project.phase) || '—'} · Progreso: ${project.progress || 0}%`,
        project.due_date ? `Entrega: ${fmtDate(project.due_date)}` : null,
        '',
        `Tareas pendientes: ${pend.length}`,
        ...pend.slice(0, 8).map(t => '  ' + data.formatTask(t)),
      ].filter(Boolean).join('\n'))
    }

    case 'cliente': {
      if (!rest) return reply(chatId, 'Decime qué cliente: `/cliente Aires Los Andes`')
      const info = await data.getClientSummary(rest)
      if (!info) return reply(chatId, `No encontré ningún cliente que coincida con "${rest}".`)
      const { client, projects, invoices } = info
      const pendingInvoices = invoices.filter(i => i.status !== 'pagada' && i.status !== 'borrador')
      return reply(chatId, [
        `*${client.name}* (${label(client.status)})`,
        client.contact_name ? `Contacto: ${client.contact_name}` : null,
        `Proyectos: ${projects.length}`,
        `Facturas pendientes: ${pendingInvoices.length}${pendingInvoices.length ? ' — ' + pendingInvoices.map(i => fmtByCurrency(i.total, i.currency)).join(', ') : ''}`,
      ].filter(Boolean).join('\n'))
    }

    case 'resumen': {
      const days = rest === 'semana' ? 7 : 1
      const summary = await data.buildSummary({ sinceDays: days })
      return reply(chatId, renderSummary(summary, { title: days === 7 ? 'Resumen semanal' : 'Resumen del día' }))
    }

    case 'crear': {
      // /crear tarea Diseñar logo | proyecto: QX Logística | responsable: Juan | fecha: 2026-09-20 | prioridad: alta
      if (!rest.toLowerCase().startsWith('tarea')) return reply(chatId, 'Por ahora solo puedo crear tareas: `/crear tarea <título> | proyecto: X | responsable: Y | fecha: YYYY-MM-DD | prioridad: alta`')
      return await createTaskFromCommand(chatId, rest.slice(5).trim())
    }

    default:
      return reply(chatId, `No conozco el comando /${cmd}. Mandá /ayuda para ver la lista.`)
  }
}

async function createTaskFromCommand(chatId, rest) {
  const [titlePart, ...metaParts] = rest.split('|')
  const title = titlePart.trim()
  if (!title) return reply(chatId, 'Falta el título de la tarea.')
  const meta = {}
  for (const part of metaParts) {
    const [k, ...v] = part.split(':')
    if (!k || !v.length) continue
    meta[k.trim().toLowerCase()] = v.join(':').trim()
  }
  const { rec, project, assignee, projectNotFound, assigneeNotFound } = await data.createTask({
    title, projectName: meta.proyecto, assignedToName: meta.responsable,
    dueDate: meta.fecha, priority: meta.prioridad, description: meta.descripcion,
  })
  const warnings = [
    projectNotFound && `⚠️ no encontré el proyecto "${meta.proyecto}", quedó sin proyecto`,
    assigneeNotFound && `⚠️ no encontré a "${meta.responsable}", quedó sin asignar`,
  ].filter(Boolean)
  await data.notifyAdmins({ title: 'Nueva tarea (agente)', message: title, type: 'tarea', project: project?.id || '' })
  return reply(chatId, [`✅ Tarea creada: *${title}*`, ...warnings].join('\n'))
}

// ────────────────────────────── Lenguaje natural ──────────────────────────────

async function handleFreeText(chatId, text) {
  const result = await interpretFreeText(text)
  if (!result) {
    return reply(chatId, 'No tengo el modo de lenguaje natural activado (falta ANTHROPIC_API_KEY). Probá con un comando, por ejemplo /ayuda.')
  }
  if (result.type === 'reply') return reply(chatId, result.text)
  if (result.type === 'read') return reply(chatId, result.text)
  if (result.type === 'write') {
    pendingConfirm.set(chatId, result)
    return reply(chatId, `${result.confirmText}\n\n¿Confirmás? (sí/no)`)
  }
}

async function executeConfirmedAction(chatId, pending) {
  const outcome = await pending.execute()
  return reply(chatId, outcome)
}

const HELP_TEXT = `*Agente Mateo Estudio* 🤖

*Comandos:*
/tareas — tus tareas pendientes
/tareas todas — todas las tareas
/vencidas — tareas y facturas vencidas
/facturas [estado] — listar facturas (enviada, pagada, vencida...)
/pagar <número> — marcar una factura como pagada
/proyecto <nombre> — estado de un proyecto
/cliente <nombre> — resumen de un cliente
/resumen — resumen del día
/resumen semana — resumen semanal
/crear tarea <título> | proyecto: X | responsable: Y | fecha: YYYY-MM-DD | prioridad: alta

También podés escribirme en texto libre o mandarme una nota de voz (si está activado el modo lenguaje natural) y te voy a pedir confirmación antes de crear o modificar algo.`
