import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, createRec, updateRec, removeRec } from '../lib/api'
import { PHASES } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Stepper, StepPanel, Field, Pill, Row, IconBtn, EditIcon, TrashIcon, ModuleHead, EmptyState, Select, MoneyField } from '../components/ui'
import { useFx, toArs } from '../context/FxContext'

const STEPS = ['Básicos', 'Plan']
const BILLING_RECURRING = { mensual: true, trimestral: true, anual: true }
const emptyForm = {
  name: '', client: '', service: '', status: 'propuesta', phase: 'descubrimiento', description: '',
  start_date: '', due_date: '', budget: '', budget_currency: 'ARS', progress: 0, next_renewal_date: '',
}

function ProjIcon() {
  return <div className="w-10 h-10 rounded-[11px] flex-shrink-0 bg-violet/[.14] border border-violet-light/30 flex items-center justify-center">
    <svg className="w-[17px] h-[17px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  </div>
}

export default function Proyectos() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
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
  const [saving, setSaving] = useState(false)

  const load = () => list('projects', '&sort=-created&expand=client,service').then(setProjects).catch(() => toast('No se pudieron cargar los proyectos.', true))
  useEffect(() => {
    load()
    list('clients', '&sort=name').then(setClients).catch(() => {})
    list('services', '&sort=name&filter=' + encodeURIComponent('active=true')).then(setServices).catch(() => {})
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
      budget: p.budget || '', budget_currency: p.budget_currency || 'ARS', progress: p.progress || 0,
      service: p.service || '', next_renewal_date: p.next_renewal_date?.slice(0, 10) || '',
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

  async function save() {
    setSaving(true)
    const body = {
      name: form.name.trim(), client: form.client, service: form.service, status: form.status, phase: form.phase,
      description: form.description.trim(), progress: parseInt(form.progress, 10) || 0,
      start_date: form.start_date ? form.start_date + ' 00:00:00' : '',
      due_date: form.due_date ? form.due_date + ' 00:00:00' : '',
      next_renewal_date: isRecurring && form.next_renewal_date ? form.next_renewal_date + ' 00:00:00' : '',
    }
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
      if (editId) await updateRec('projects', editId, body)
      else await createRec('projects', body)
      setOpen(false); toast(editId ? 'Proyecto actualizado ✓' : '✦ Proyecto creado con éxito'); load()
    } catch { toast('No se pudo guardar el proyecto.', true) } finally { setSaving(false) }
  }
  async function del(p) {
    if (!confirm(`¿Eliminar el proyecto "${p.name}"?`)) return
    try { await removeRec('projects', p.id); toast('Proyecto eliminado ✓'); load() }
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
        <div className="flex flex-col gap-2.5">
          {filtered.map(p => {
            const prog = Math.max(0, Math.min(100, Number(p.progress) || 0))
            const svcRecurring = BILLING_RECURRING[p.expand?.service?.billing_type]
            const meta = [
              clientName(p), p.expand?.service?.name,
              svcRecurring && p.next_renewal_date && `Vence: ${p.next_renewal_date.slice(0, 10)}`,
              !svcRecurring && p.due_date && `Entrega: ${p.due_date.slice(0, 10)}`,
            ].filter(Boolean).join(' · ')
            return (
              <Row key={p.id} icon={<ProjIcon />} title={p.name} meta={meta || 'Sin detalles'}>
                <div className="w-[110px] flex-shrink-0">
                  <div className="h-1.5 rounded-full bg-white/[.07] overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-dark via-violet-light to-neon-pink shadow-[0_0_14px_rgba(139,92,246,.65)]"
                      initial={{ width: 0 }} animate={{ width: `${prog}%` }} transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }} />
                  </div>
                  <div className="text-[10px] text-white/35 mt-1 text-right">{prog}%</div>
                </div>
                <Pill value={p.status || 'propuesta'} />
                <div className="flex gap-1.5 flex-shrink-0">
                  <IconBtn onClick={() => openEdit(p)} title="Editar"><EditIcon /></IconBtn>
                  {isAdmin && <IconBtn onClick={() => del(p)} danger title="Eliminar"><TrashIcon /></IconBtn>}
                </div>
              </Row>
            )
          })}
        </div>
      )}

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
                  <Field label="Estado">
                    <Select value={form.status} onChange={v => set('status', v)}
                      options={[
                        { value: 'propuesta', label: 'Propuesta' }, { value: 'en_progreso', label: 'En progreso' },
                        { value: 'pausado', label: 'Pausado' }, { value: 'completado', label: 'Completado' }, { value: 'cancelado', label: 'Cancelado' },
                      ]} />
                  </Field>
                  <Field label="Fase actual">
                    <Select value={form.phase} onChange={v => set('phase', v)}
                      options={Object.entries(PHASES).map(([k, v]) => ({ value: k, label: v }))} />
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
                  <Field label="Progreso" full>
                    <div className="flex items-center gap-3.5">
                      <input type="range" min="0" max="100" step="5" value={form.progress} onChange={e => set('progress', e.target.value)}
                        className="flex-1 h-1.5 rounded-full bg-white/[.08] accent-violet-light" />
                      <span className="text-base font-extrabold text-violet-light min-w-[52px] text-right">{form.progress}%</span>
                    </div>
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
