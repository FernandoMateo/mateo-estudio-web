// Capa de acceso a datos del agente. Usa las MISMAS colecciones de PocketBase que ya
// existen en el dashboard (tasks, projects, clients, invoices, transactions, users,
// notifications) — no crea colecciones nuevas.

import { pb, withAuth } from './pocketbase.js'
import { fmtByCurrency, fmtDate, isOverdue, label, PRIORITY_EMOJI } from './lib/format.js'

const esc = (s) => String(s).replace(/"/g, '\\"')

// ── Búsqueda difusa por nombre (para que en Telegram puedas escribir "QX" en vez del id) ──
async function findOneByName(collection, nameField, query) {
  if (!query) return null
  return withAuth(async (pb) => {
    const items = await pb.collection(collection).getFullList({
      filter: `${nameField} ~ "${esc(query)}"`,
      sort: '-created',
    })
    return items[0] || null
  })
}

export const findClient = (q) => findOneByName('clients', 'name', q)
export const findProject = (q) => findOneByName('projects', 'name', q)
export const findUser = (q) => q ? withAuth(async (pb) => {
  const items = await pb.collection('users').getFullList({
    filter: `(name ~ "${esc(q)}" || email ~ "${esc(q)}") && role != "cliente"`,
  })
  return items[0] || null
}) : null

// ── Tareas ──
export async function listTasks({ status, assignedToId } = {}) {
  const filters = []
  if (status) filters.push(`status = "${esc(status)}"`)
  if (assignedToId) filters.push(`assigned_to = "${esc(assignedToId)}"`)
  return withAuth((pb) => pb.collection('tasks').getFullList({
    filter: filters.join(' && '),
    sort: 'due_date',
    expand: 'project,assigned_to',
  }))
}

export async function listOverdueTasks() {
  const tasks = await listTasks({})
  return tasks.filter(t => t.status !== 'completada' && isOverdue(t.due_date))
}

export async function createTask({ title, projectName, assignedToName, dueDate, priority, description, link }) {
  const project = projectName ? await findProject(projectName) : null
  const assignee = assignedToName ? await findUser(assignedToName) : null
  const body = {
    title: title.trim(),
    project: project?.id || '',
    assigned_to: assignee?.id || '',
    status: 'pendiente',
    priority: priority || 'media',
    description: description || '',
    link: link || '',
    due_date: dueDate ? `${dueDate} 00:00:00` : '',
    from_client: false,
  }
  const rec = await withAuth((pb) => pb.collection('tasks').create(body))
  return { rec, project, assignee, projectNotFound: !!projectName && !project, assigneeNotFound: !!assignedToName && !assignee }
}

export async function updateTaskStatus(taskQuery, status) {
  const task = await findOneByName('tasks', 'title', taskQuery)
  if (!task) return null
  return withAuth((pb) => pb.collection('tasks').update(task.id, { status }))
}

export function formatTask(t) {
  const p = t.expand?.project?.name
  const a = t.expand?.assigned_to?.name || t.expand?.assigned_to?.email
  const bits = [PRIORITY_EMOJI[t.priority] || '⚪', `*${t.title}*`]
  const meta = [p, a && `👤 ${a}`, t.due_date && `📅 ${fmtDate(t.due_date)}`].filter(Boolean).join(' · ')
  return bits.join(' ') + (meta ? `\n   ${meta}` : '') + (isOverdue(t.due_date) && t.status !== 'completada' ? '  ⚠️ _vencida_' : '')
}

// ── Proyectos ──
export async function getProjectStatus(query) {
  const project = await findProject(query)
  if (!project) return null
  const [tasks, client] = await Promise.all([
    listTasks({}).then(all => all.filter(t => t.project === project.id)),
    project.client ? withAuth(pb => pb.collection('clients').getOne(project.client).catch(() => null)) : null,
  ])
  return { project, tasks, client }
}

// ── Clientes ──
export async function getClientSummary(query) {
  const client = await findClient(query)
  if (!client) return null
  const [projects, invoices] = await Promise.all([
    withAuth(pb => pb.collection('projects').getFullList({ filter: `client = "${client.id}"` })),
    withAuth(pb => pb.collection('invoices').getFullList({ filter: `client = "${client.id}"`, sort: '-issue_date' })),
  ])
  return { client, projects, invoices }
}

// ── Facturas ──
export async function listInvoices({ status } = {}) {
  const filter = status ? `status = "${esc(status)}"` : ''
  return withAuth((pb) => pb.collection('invoices').getFullList({
    filter, sort: 'due_date', expand: 'client,project',
  }))
}

export async function listOverdueInvoices() {
  const invoices = await listInvoices({})
  return invoices.filter(i => i.status !== 'pagada' && i.status !== 'borrador' && isOverdue(i.due_date))
}

export function formatInvoice(i) {
  const client = i.expand?.client?.name || '—'
  const amount = fmtByCurrency(i.total, i.currency)
  return `*${i.number || i.title}* — ${client} — ${amount} — ${label(i.status)}${i.due_date ? ` (vence ${fmtDate(i.due_date)})` : ''}`
}

export async function markInvoicePaid(query) {
  const invoice = await findOneByName('invoices', 'number', query) || await findOneByName('invoices', 'title', query)
  if (!invoice) return null
  return withAuth((pb) => pb.collection('invoices').update(invoice.id, { status: 'pagada' }))
}

// ── Transacciones (pendientes/vencidas, para el resumen financiero) ──
export async function listPendingTransactions() {
  return withAuth((pb) => pb.collection('transactions').getFullList({
    filter: 'status = "pendiente" || status = "vencido"',
    sort: 'due_date',
    expand: 'client,project',
  }))
}

// ── Notificaciones internas (para que además del email/telegram quede en la campanita del dashboard) ──
export async function notifyAdmins({ title, message = '', type = 'info', project = '', client = '', task = '' }) {
  return withAuth(async (pb) => {
    const admins = await pb.collection('users').getFullList({ filter: 'role = "admin"' })
    await Promise.all(admins.map(a => pb.collection('notifications').create({
      user: a.id, title, message, type, project, client, task, read: false,
    }).catch(() => null)))
  })
}

// ── Resumen general (usado por /resumen y por el cron diario/semanal) ──
export async function buildSummary({ sinceDays = 1 } = {}) {
  const since = new Date(Date.now() - sinceDays * 86400000)
  const [tasks, invoices, pendingTx, projects] = await Promise.all([
    listTasks({}),
    listInvoices({}),
    listPendingTransactions(),
    withAuth(pb => pb.collection('projects').getFullList({ filter: 'status = "en_progreso"' })),
  ])
  const completedRecently = tasks.filter(t => t.status === 'completada' && new Date(t.updated) >= since)
  const overdueTasks = tasks.filter(t => t.status !== 'completada' && isOverdue(t.due_date))
  const overdueInvoices = invoices.filter(i => i.status !== 'pagada' && i.status !== 'borrador' && isOverdue(i.due_date))
  const dueSoonInvoices = invoices.filter(i => i.status === 'enviada' && !isOverdue(i.due_date))
  return { completedRecently, overdueTasks, overdueInvoices, dueSoonInvoices, pendingTx, activeProjects: projects }
}
