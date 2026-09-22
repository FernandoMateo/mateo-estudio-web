import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, getRec, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { ModuleHead, EmptyState, Pill, Modal, ModalHead, Field, Select } from '../components/ui'
import ProposalViewer from '../components/ProposalViewer'

const TONES = [{ value: 'cercano', label: 'Cercano' }, { value: 'formal', label: 'Formal' }, { value: 'premium', label: 'Premium' }]
const CURRENCIES = [{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }, { value: 'MXN', label: 'Pesos MX (MXN)' }]

function ServiceChips({ services, selected, onToggle }) {
  if (!services.length) return <p className="text-[12px] text-white/30">No hay servicios activos cargados en el catálogo todavía.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {services.map(s => {
        const on = selected.includes(s.id)
        return (
          <button key={s.id} type="button" onClick={() => onToggle(s.id)}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors
              ${on ? 'text-white bg-gradient-to-r from-violet-dark to-violet-light border-transparent shadow-[0_0_14px_rgba(139,92,246,.45)]'
              : 'text-white/50 bg-white/[.03] border-white/10 hover:text-white/80 hover:border-violet-light/40'}`}>
            {s.name}
          </button>
        )
      })}
    </div>
  )
}

export default function Propuestas() {
  const toast = useToast()
  const [proposals, setProposals] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientCompany, setRecipientCompany] = useState('')
  const [objective, setObjective] = useState('')
  const [selectedServices, setSelectedServices] = useState([])
  const [tone, setTone] = useState('cercano')
  const [currency, setCurrency] = useState('ARS')
  const [budget, setBudget] = useState('')
  const [timelineHint, setTimelineHint] = useState('')
  const [extraNotes, setExtraNotes] = useState('')

  const load = () => list('proposals', '&sort=-created&expand=client').then(setProposals).catch(() => toast('No se pudieron cargar las propuestas.', true))

  useEffect(() => {
    load()
    list('clients', '&sort=name').then(setClients).catch(() => {})
    list('services', '&sort=name&filter=' + encodeURIComponent('active=true')).then(setServices).catch(() => {})
  }, [])

  // Mientras haya alguna propuesta "pendiente" o "generando", refrescamos la lista cada
  // pocos segundos para que el estado pase solo a "listo" sin que Fer tenga que recargar.
  useEffect(() => {
    const busy = proposals.some(p => p.status === 'pendiente' || p.status === 'generando')
    if (!busy) return
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [proposals])

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const filtered = proposals.filter(p => {
    const s = search.toLowerCase().trim()
    if (!s) return true
    const clientName = p.expand?.client?.name || p.recipient_name || ''
    return (p.title || '').toLowerCase().includes(s) || clientName.toLowerCase().includes(s)
  })

  function resetForm() {
    setTitle(''); setClientId(''); setRecipientName(''); setRecipientCompany('')
    setObjective(''); setSelectedServices([]); setTone('cercano'); setCurrency('ARS')
    setBudget(''); setTimelineHint(''); setExtraNotes('')
  }

  function toggleService(id) {
    setSelectedServices(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  }

  async function create() {
    if (!title.trim()) { toast('Ponele un título a la propuesta.', true); return }
    if (!objective.trim()) { toast('Contale a la IA cuál es el objetivo o la necesidad del cliente.', true); return }
    setSaving(true)
    try {
      const rec = await createRec('proposals', {
        title: title.trim(),
        client: clientId || '',
        recipient_name: recipientName.trim(),
        recipient_company: recipientCompany.trim(),
        objective: objective.trim(),
        services: selectedServices,
        tone, currency,
        budget_hint: budget ? Number(budget) : null,
        timeline_hint: timelineHint.trim(),
        extra_notes: extraNotes.trim(),
        status: 'pendiente',
      })
      logActivity({ action: 'crear', entity: 'propuesta', entity_name: title.trim() })
      toast('✦ Generando tu propuesta — te aviso por Telegram apenas esté lista')
      setOpen(false); resetForm()
      setProposals(ps => [rec, ...ps])
    } catch {
      toast('No se pudo crear la propuesta. Revisá los datos.', true)
    } finally { setSaving(false) }
  }

  async function openViewer(p) {
    // Traemos el registro fresco (por si el polling de la lista todavía no llegó al último estado)
    try { setViewing(await getRec('proposals', p.id) ) } catch { setViewing(p) }
  }

  return (
    <div>
      <ModuleHead title="Propuestas" count={`${proposals.length} generadas`} search={search} onSearch={setSearch}
        onNew={() => { resetForm(); setOpen(true) }} newLabel="Nueva propuesta" />

      {!proposals.length ? (
        <EmptyState title="Armá tu primera propuesta con IA" text='Completá el objetivo del cliente y elegí servicios del catálogo — la IA redacta toda la propuesta y te avisa por Telegram apenas está lista.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Sin resultados para esta búsqueda.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => p.status === 'listo' && openViewer(p)}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 rounded-2xl px-4 py-3.5 ${p.status === 'listo' ? 'cursor-pointer' : ''}`}
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}>
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-[11px] flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
                  <svg className="w-[17px] h-[17px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 16.8l.9-5L4.8 8.3l5-.7z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{p.title}</div>
                  <div className="text-[11px] text-white/35 truncate mt-0.5">{p.expand?.client?.name || p.recipient_name || 'Sin destinatario'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                {(p.status === 'pendiente' || p.status === 'generando') && (
                  <span className="text-[11px] text-violet-light flex items-center gap-1.5">
                    <motion.span className="w-1.5 h-1.5 rounded-full bg-violet-light" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
                    Generando…
                  </span>
                )}
                <Pill value={p.status} />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} wide>
        <ModalHead title="Nueva propuesta con IA" onClose={() => setOpen(false)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Título *" full><input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Rediseño web + marketing — Innova Training" /></Field>

          <Field label="Cliente de tu cartera (opcional)">
            <Select value={clientId} onChange={setClientId} placeholder="Elegí uno si ya lo tenés cargado…" options={clientOptions} />
          </Field>
          <Field label="O prospecto suelto — nombre">
            <input className="field" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nombre de contacto" disabled={!!clientId} />
          </Field>
          <Field label="Prospecto — empresa">
            <input className="field" value={recipientCompany} onChange={e => setRecipientCompany(e.target.value)} placeholder="Empresa (opcional)" disabled={!!clientId} />
          </Field>

          <Field label="Objetivo / necesidad del cliente *" full>
            <textarea className="field min-h-[90px]" value={objective} onChange={e => setObjective(e.target.value)}
              placeholder="Contale a la IA qué necesita este cliente, qué problema tiene, qué esperás lograr con la propuesta…" />
          </Field>

          <Field label="Servicios a incluir" full>
            <ServiceChips services={services} selected={selectedServices} onToggle={toggleService} />
          </Field>

          <Field label="Tono"><Select value={tone} onChange={setTone} options={TONES} /></Field>
          <Field label="Moneda"><Select value={currency} onChange={setCurrency} options={CURRENCIES} /></Field>
          <Field label="Presupuesto de referencia (opcional)"><input type="number" min="0" className="field" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Dejalo vacío si preferís que quede abierto" /></Field>
          <Field label="Plazo estimado (opcional)"><input className="field" value={timelineHint} onChange={e => setTimelineHint(e.target.value)} placeholder="Ej. 6 a 8 semanas" /></Field>

          <Field label="Notas para la IA (opcional)" full>
            <textarea className="field min-h-[60px]" value={extraNotes} onChange={e => setExtraNotes(e.target.value)} placeholder="Cualquier cosa puntual que quieras que mencione o evite…" />
          </Field>
        </div>

        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={saving} onClick={create}>
            {saving ? 'Creando…' : 'Generar con IA ✦'}
          </motion.button>
        </div>
      </Modal>

      <ProposalViewer open={!!viewing} onClose={() => setViewing(null)} proposal={viewing} />
    </div>
  )
}
