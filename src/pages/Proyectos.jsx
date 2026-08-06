import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, createRec, updateRec, removeRec, logActivity } from '../lib/api'
import { PHASES, PHASE_PROGRESS } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Stepper, StepPanel, Field, Pill, IconBtn, EditIcon, TrashIcon, ModuleHead, EmptyState, Select, MoneyField } from '../components/ui'
import ProjectWorkspace from '../components/ProjectWorkspace'
import ProjectCarousel3D from '../components/ProjectCarousel3D'
import { useFx, toArs } from '../context/FxContext'

const STEPS = ['Básicos', 'Plan']
const BILLING_RECURRING = { mensual: true, trimestral: true, anual: true }
const PHASE_OPTIONS = Object.entries(PHASES).map(([k, v]) => ({ value: k, label: v }))
const emptyForm = {
  name: '', client: '', service: '', status: 'propuesta', phase: 'descubrimiento', description: '',
  start_date: '', due_date: '', budget: '', budget_currency: 'ARS', next_renewal_date: '', assigned_to: '',
}

function ProjIcon() {
  return <div className="w-10 h-10 rounded-[11px] flex-shrink-0 bg-violet/[.14] border border-violet-light/30 flex items-center justify-center">
    <svg className="w-[17px] h-[17px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  </div>
}

export default function Proyectos() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const canManage = isAdmin || me.role === 'equipo'
  const toast = useToast()
  const { rates } = useFx()
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [team, setTeam] = useState([])
  const [saving, setSaving] = useState(false)
  const [changingPhaseId, setChangingPhaseId] = useState(null)
  const [workspaceProject, setWorkspaceProject] = useState(null)

  const load = () => list('projects', '&sort=-created&expand=client,service,assigned_to').then(setProjects).catch(() => toast('No se pudieron cargar los proyectos.', true))
  useEffect(() => {
    load()
    list('clients', '&sort=name').then(setClients).catch(() => {})
    list('services', '&sort=name&filter=' + encodeURIComponent('active=true')).then(setServices).catch(() => {})
    if (isAdmin) list('users', '&filter=' + encodeURIComponent('role="admin" || role="equipo"') + '&sort=name').then(setTeam).catch(() => {})
  }, [])

  const clientName = p => p.expand?.client?.name || ''
  const selectedService = services.find(s => s.id === form.service)
  const isRecurring = !!BILLING_RECURRING[selectedService?.billing_type]

  const filtered = projects.filter(p => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (p.name || '').toLowerCase().includes(q) || clientName(p).toLowerCase().includes(q)
  })

  function openNew() { setEditId(null); setForm(emptyForm); setStep(0); setOpen(true) }
  function openEdit(p) {
    setEditId(p.id)
    setForm({
      ...emptyForm, ...p, start_date: p.start_date?.slice(0, 10) || '', due_date: p.due_date?.slice(0, 10) || '',
      budget: p.budget || '', budget_currency: p.budget_currency || 'ARS',
      service: p.service || '', next_renewal_date: p.next_renewal_date?.slice(0, 10) || '', assigned_to: p.assigned_to || '',
    })
    setStep(0); setOpen(true)
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function go(delta) {
    if (delta > 0 && step === 0) {
      if (!form.name.trim()) { toast('El nombre del proyecto es obligatorio.', true); return }
      if (!form.client) { toast('Selecciona el cliente del proyecto.', true); return }
    }
    if (delta > 0 && step === STEPS.length - 1) { save(); return }
    setDir(delta); setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + delta)))
  }

  function buildBody(phase, extra = {}) {
    return {
      phase, progress: PHASE_PROGRESS[phase] ?? 0,
      ...extra,
    }
  }

  async function save() {
    setSaving(true)
    const body = buildBody(form.phase, {
      name: form.name.trim(), client: form.client, service: form.service, status: form.status,
      description: form.description.trim(), assigned_to: form.assigned_to || '',
      start_date: form.start_date ? form.start_date + ' 00:00:00' : '',
      due_date: form.due_date ? form.due_date + ' 00:00:00' : '',
      next_renewal_date: isRecurring && form.next_renewal_date ? form.next_renewal_date + ' 00:00:00' : '',
    })
    // Si cambió la fecha de vencimiento respecto a la que ya estaba, reseteamos el aviso para que vuelva a alertar en el próximo ciclo.
    const prevProject = editId ? projects.find(p => p.id === editId) : null
    if (!prevProject || (prevProject.next_renewal_date || '').slice(0, 10) !== form.next_renewal_date) {
      body.renewal_alerted = false
    }
    if (isAdmin) {
      const bAmount = form.budget ? Number(form.budget) : 0
      const bArs = Math.round(toArs(bAmount, form.budget_currency, rates))
      body.budget = bAmount
      body.budget_currency = form.budget_currency || 'ARS'
      body.budget_fx_rate = (form.budget_currency && form.budget_currency !== 'ARS') ? (bAmount ? bArs / bAmount : 0) : 1
      body.budget_ars = bArs
    }
    try {
      let pid = editId
      if (editId) await updateRec('projects', editId, body)
      else { const created = await createRec('projects', body); pid = created.id }
      logActivity({ action: editId ? 'actualizar' : 'crear', entity: 'proyecto', entity_name: form.name.trim(), project: pid })
      setOpen(false); toast(editId ? 'Proyecto actualizado ✓' : '✦ Proyecto creado con éxito'); load()
    } catch { toast('No se pudo guardar el proyecto.', true) } finally { setSaving(false) }
  }

  async function quickChangePhase(p, phase) {
    if (phase === p.phase) { setChangingPhaseId(null); return }
    setProjects(list => list.map(x => x.id === p.id ? { ...x, phase, progress: PHASE_PROGRESS[phase] ?? 0 } : x))
    setChangingPhaseId(null)
    try {
      await updateRec('projects', p.id, buildBody(phase))
      logActivity({ action: 'actualizar', entity: 'proyecto', entity_name: p.name, summary: `cambió la fase a ${PHASES[phase]}`, project: p.id })
    }
    catch { toast('No se pudo actualizar la fase.', true); load() }
  }

  async function del(p) {
    if (!confirm(`¿Eliminar el proyecto "${p.name}"?`)) return
    try {
      await removeRec('projects', p.id)
      logActivity({ action: 'eliminar', entity: 'proyecto', entity_name: p.name })
      toast('Proyecto eliminado ✓'); load()
    }
    catch { toast('No se pudo eliminar. Puede tener tareas ligadas.', true) }
  }

  return (
    <div>
      <ModuleHead title="Proyectos" count={`${projects.length} en total`} search={search} onSearch={setSearch} onNew={openNew} newLabel="Nuevo proyecto" />
      {!projects.length ? (
        <EmptyState title="Sin proyectos todavía" text='Crea el primero con el botón "Nuevo proyecto" y vincúlalo a un cliente.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Sin resultados para "{search}".</p>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(
            filtered.reduce((acc, p) => {
              const key = p.client || '__sin_cliente__'
              ;(acc[key] = acc[key] || []).push(p)
              return acc
            }, {})
          )
            .sort(([, a], [, b]) => (clientName(a[0]) || '').localeCompare(clientName(b[0]) || ''))
            .map(([clientId, projs]) => (
              <div key={clientId}>
                <div className="flex items-center gap-2.5 mb-4 px-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet/[.12] border border-violet-light/25 flex-shrink-0">
                    <svg className="w-[15px] h-[15px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  </div>
                  <h3 className="text-[14.5px] font-bold">{clientName(projs[0]) || 'Sin cliente asignado'}</h3>
                  <span className="text-[10.5px] font-semibold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">{projs.length}</span>
                </div>
                <ProjectCarousel3D projects={projs} onOpen={setWorkspaceProject} />
              </div>
            ))}
        </div>
      )}

      <ProjectWorkspace project={workspaceProject} onClose={() => setWorkspaceProject(null)} canManage={canManage} isAdmin={isAdmin}
        clientName={workspaceProject ? clientName(workspaceProject) : ''}
        onEdit={(p) => { setWorkspaceProject(null); openEdit(p) }}
        onDelete={(p) => { setWorkspaceProject(null); del(p) }} />

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHead title={editId ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={() => setOpen(false)} />
        <div className="max-w-[220px] mx-auto"><Stepper steps={STEPS} current={step} /></div>
        <div className="min-h-[210px] relative">
          <StepPanel stepKey={step} direction={dir}>
            {step === 0 && (
              <>
                <p className="text-[11.5px] text-white/35 -mt-1.5 mb-4">Qué se va a construir y para quién.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre del proyecto *" full><input className="field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Rediseño de sitio web" /></Field>
                  <Field label="Cliente *" full>
                    <Select value={form.client} onChange={v => set('client', v)} placeholder="Selecciona un cliente…"
                      options={clients.map(c => ({ value: c.id, label: c.name }))} />
                  </Field>
                  <Field label="Servicio" full>
                    <Select value={form.service} onChange={v => set('service', v)} placeholder="¿Qué servicio es? (opcional)"
                      options={services.map(s => ({ value: s.id, label: s.name + (BILLING_RECURRING[s.billing_type] ? ' · recurrente' : '') }))} />
                  </Field>
                  {isAdmin && (
                    <Field label="Asignar a" full>
                      <Select value={form.assigned_to} onChange={v => set('assigned_to', v)} placeholder="Sin asignar todavía…"
                        options={team.map(u => ({ value: u.id, label: `${u.name || u.email}${u.role === 'admin' ? ' · admin' : ''}` }))} />
                      <p className="text-[10.5px] text-white/30 mt-1.5">Esa persona va a ser la única del equipo que vea este proyecto.</p>
                    </Field>
                  )}
                  <Field label="Estado">
                    <Select value={form.status} onChange={v => set('status', v)}
                      options={[
                        { value: 'propuesta', label: 'Propuesta' }, { value: 'en_progreso', label: 'En progreso' },
                        { value: 'pausado', label: 'Pausado' }, { value: 'completado', label: 'Completado' }, { value: 'cancelado', label: 'Cancelado' },
                      ]} />
                  </Field>
                  <Field label="Fase actual">
                    <Select value={form.phase} onChange={v => set('phase', v)} options={PHASE_OPTIONS} />
                    <p className="text-[10.5px] text-white/30 mt-1.5">El progreso se calcula solo: {PHASE_PROGRESS[form.phase] ?? 0}%</p>
                  </Field>
                  <Field label="Descripción" full><textarea className="field min-h-[64px]" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Alcance, objetivos, entregables…" /></Field>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <p className="text-[11.5px] text-white/35 -mt-1.5 mb-4">Tiempos, dinero y avance.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Fecha de inicio"><input type="date" className="field" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
                  <Field label="Fecha de entrega"><input type="date" className="field" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></Field>

                  {isRecurring && (
                    <Field label="Próximo vencimiento" full>
                      <input type="date" className="field" value={form.next_renewal_date} onChange={e => set('next_renewal_date', e.target.value)} />
                      <p className="text-[11px] text-violet-light/70 mt-1.5 flex items-center gap-1.5">
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
                        Como es un servicio recurrente, tu cliente va a ver esta fecha en su portal y recibe un aviso 2 días antes.
                      </p>
                    </Field>
                  )}

                  {isAdmin && (
                    <Field label="Presupuesto" full>
                      <MoneyField amount={form.budget} currency={form.budget_currency} onAmount={v => set('budget', v)} onCurrency={v => set('budget_currency', v)} />
                    </Field>
                  )}

                  <Field label="Progreso (automático según la fase)" full>
                    <div className="flex items-center gap-3.5">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[.08] overflow-hidden">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-dark via-violet-light to-neon-pink"
                          animate={{ width: `${PHASE_PROGRESS[form.phase] ?? 0}%` }} transition={{ duration: 0.4 }} />
                      </div>
                      <span className="text-base font-extrabold text-violet-light min-w-[52px] text-right">{PHASE_PROGRESS[form.phase] ?? 0}%</span>
                    </div>
                    <p className="text-[10.5px] text-white/30 mt-1.5">Cambia solo cuando modificás la fase en el paso anterior.</p>
                  </Field>
                </div>
              </>
            )}
          </StepPanel>
        </div>
        <div className="flex justify-between gap-2.5 mt-5">
          <button className="btn-ghost" style={{ visibility: step === 0 ? 'hidden' : 'visible' }} onClick={() => go(-1)}>← Atrás</button>
          <div className="flex gap-2.5 ml-auto">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-glass" disabled={saving} onClick={() => go(1)}>
              {step === STEPS.length - 1 ? (editId ? 'Guardar cambios' : 'Crear proyecto ✦') : 'Siguiente →'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
