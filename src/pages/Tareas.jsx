import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, createRec, updateRec, removeRec } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Field, Pill, IconBtn, EditIcon, TrashIcon, ModuleHead, EmptyState, FilterTabs, Select } from '../components/ui'
import TaskComments from '../components/TaskComments'

const emptyForm = { title: '', project: '', assigned_to: '', due_date: '', status: 'pendiente', priority: 'media', link: '', description: '' }
const TABS = [['todas', 'Todas'], ['pendiente', 'Pendientes'], ['en_progreso', 'En progreso'], ['completada', 'Completadas']]

function Check({ done, onClick }) {
  return (
    <button onClick={onClick} title={done ? 'Reabrir' : 'Completar'}
      className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
        ${done ? 'bg-gradient-to-br from-mint to-emerald-600 border-transparent shadow-[0_0_14px_rgba(52,211,153,.5)]' : 'border-violet-light/40 hover:border-violet-light hover:shadow-[0_0_10px_rgba(139,92,246,.35)]'}`}>
      <motion.svg initial={false} animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.4 }} className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M5 13l4 4 10-11"/></motion.svg>
    </button>
  )
}

export default function Tareas() {
  const { me } = useOutletContext()
  const canManage = me.role === 'admin' || me.role === 'equipo'
  const toast = useToast()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [team, setTeam] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todas')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => list('tasks', '&sort=-created&expand=project,assigned_to').then(setTasks).catch(() => toast('No se pudieron cargar las tareas.', true))
  useEffect(() => {
    load()
    list('projects', '&sort=name').then(setProjects).catch(() => {})
    list('users', '&filter=' + encodeURIComponent('role!="cliente"')).then(setTeam).catch(() => {})
  }, [])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const filtered = tasks.filter(t => {
    if (filter !== 'todas' && t.status !== filter) return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    const pn = t.expand?.project?.name || '', an = t.expand?.assigned_to?.name || t.expand?.assigned_to?.email || ''
    return (t.title || '').toLowerCase().includes(q) || pn.toLowerCase().includes(q) || an.toLowerCase().includes(q)
  })

  function openNew() { setEditId(null); setForm(emptyForm); setOpen(true) }
  function openEdit(t) {
    setEditId(t.id)
    setForm({ ...emptyForm, ...t, due_date: t.due_date?.slice(0, 10) || '' })
    setOpen(true)
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function toggle(t) {
    const newStatus = t.status === 'completada' ? 'pendiente' : 'completada'
    try {
      await updateRec('tasks', t.id, { status: newStatus })
      setTasks(list => list.map(x => x.id === t.id ? { ...x, status: newStatus } : x))
      toast(newStatus === 'completada' ? '✓ Tarea completada' : 'Tarea reabierta')
    } catch { toast('No se pudo actualizar la tarea.', true) }
  }

  async function save() {
    if (!form.title.trim()) { toast('El título de la tarea es obligatorio.', true); return }
    setSaving(true)
    const body = {
      title: form.title.trim(), project: form.project, assigned_to: form.assigned_to,
      status: form.status, priority: form.priority, description: form.description.trim(),
      link: form.link.trim(), due_date: form.due_date ? form.due_date + ' 00:00:00' : '',
    }
    if (!editId) body.from_client = false
    try {
      if (editId) await updateRec('tasks', editId, body)
      else await createRec('tasks', body)
      setOpen(false); toast(editId ? 'Tarea actualizada ✓' : '✦ Tarea creada con éxito'); load()
    } catch (err) {
      toast(err?.data?.data?.link ? 'El enlace debe iniciar con https://' : 'No se pudo guardar la tarea.', true)
    } finally { setSaving(false) }
  }
  async function del(t) {
    if (!confirm(`¿Eliminar la tarea "${t.title}"?`)) return
    try { await removeRec('tasks', t.id); toast('Tarea eliminada ✓'); load() }
    catch { toast('No se pudo eliminar la tarea.', true) }
  }

  return (
    <div>
      <ModuleHead title="Tareas" count={`${tasks.length} en total`} search={search} onSearch={setSearch} onNew={openNew} newLabel="Nueva tarea" />
      <FilterTabs tabs={TABS} value={filter} onChange={setFilter} />
      {!tasks.length ? (
        <EmptyState title="Sin tareas todavía" text='Crea la primera con "Nueva tarea" y asígnale responsable, prioridad y fecha.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Nada por aquí con este filtro.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(t => {
            const done = t.status === 'completada'
            const pn = t.expand?.project?.name, an = t.expand?.assigned_to?.name || t.expand?.assigned_to?.email
            let dueEl = null
            if (t.due_date) {
              const d = new Date(t.due_date.slice(0, 10) + 'T00:00:00')
              const late = !done && d < today
              dueEl = late ? <span className="text-coral font-semibold">⚠ Venció {t.due_date.slice(0, 10)}</span> : `📅 ${t.due_date.slice(0, 10)}`
            }
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: done ? 0.55 : 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 bg-white/[.035] border border-white/[.07] rounded-xl px-4 py-3.5 hover:border-violet-light/25 transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <Check done={done} onClick={() => toggle(t)} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${done ? 'line-through' : ''}`}>{t.title}</div>
                    <div className="text-[11.5px] text-white/35 truncate mt-0.5 flex gap-1.5 flex-wrap">
                      {[pn, an && `👤 ${an}`].filter(Boolean).join(' · ')}{dueEl && <> · {dueEl}</>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap sm:ml-auto">
                  {t.from_client && <span className="pill text-[#7DD3FC] bg-[#7DD3FC]/[.08] border border-[#7DD3FC]/30">del cliente</span>}
                  <Pill value={t.priority || 'media'} />
                  <div className="flex gap-1.5 flex-shrink-0">
                    {t.link && <a href={t.link} target="_blank" rel="noopener" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-violet-light hover:bg-violet/10 transition">
                      <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/></svg>
                    </a>}
                    <IconBtn onClick={() => openEdit(t)} title="Editar"><EditIcon /></IconBtn>
                    {canManage && <IconBtn onClick={() => del(t)} danger title="Eliminar"><TrashIcon /></IconBtn>}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHead title={editId ? 'Editar tarea' : 'Nueva tarea'} onClose={() => setOpen(false)} />
        <p className="text-[11.5px] text-white/35 -mt-1.5 mb-4">Qué hay que hacer, quién lo hace y para cuándo.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Título de la tarea *" full><input className="field" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej. Diseñar propuesta de logo" /></Field>
          <Field label="Proyecto" full>
            <Select value={form.project} onChange={v => set('project', v)} placeholder="Sin proyecto"
              options={projects.map(p => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="Responsable">
            <Select value={form.assigned_to} onChange={v => set('assigned_to', v)} placeholder="Sin asignar"
              options={team.map(u => ({ value: u.id, label: u.name || u.email }))} />
          </Field>
          <Field label="Fecha límite"><input type="date" className="field" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></Field>
          <Field label="Estado">
            <Select value={form.status} onChange={v => set('status', v)}
              options={[{ value: 'pendiente', label: 'Pendiente' }, { value: 'en_progreso', label: 'En progreso' }, { value: 'completada', label: 'Completada' }]} />
          </Field>
          <Field label="Prioridad">
            <Select value={form.priority} onChange={v => set('priority', v)}
              options={[{ value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }]} />
          </Field>
          <Field label="Enlace de referencia" full><input className="field" value={form.link} onChange={e => set('link', e.target.value)} placeholder="https://…" /></Field>
          <Field label="Descripción" full><textarea className="field min-h-[64px]" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detalles, criterios de entrega…" /></Field>
        </div>

        {editId && (
          <div className="mt-5 pt-4 border-t border-white/[.06]">
            <div className="field-label !mb-2.5">Comentarios</div>
            <TaskComments taskId={editId} />
          </div>
        )}

        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn-glass" disabled={saving} onClick={save}>Guardar tarea ✦</button>
        </div>
      </Modal>
    </div>
  )
}
