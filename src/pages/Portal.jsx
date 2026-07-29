import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, createRec, updateRec, removeRec, getAuth, clearAuth, fileUrl, fmtARS, fmtByCurrency, notifyTeam, logActivity } from '../lib/api'
import { PHASES, PHASE_ORDER, PHASE_PROGRESS } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Field, Pill, Select, IconBtn, EditIcon, TrashIcon } from '../components/ui'
import CountUp from '../components/CountUp'
import QuoteBuilder from '../components/QuoteBuilder'
import QuoteViewer from '../components/QuoteViewer'
import QuoteRow from '../components/QuoteRow'
import CatalogViewer from '../components/CatalogViewer'
import NotificationsList from '../components/NotificationsList'
import NotificationBell from '../components/NotificationBell'
import InstallPrompt from '../components/InstallPrompt'
import ProjectFiles from '../components/ProjectFiles'
import TaskComments from '../components/TaskComments'
import ClientDocuments from '../components/ClientDocuments'
import ProjectCarousel3D from '../components/ProjectCarousel3D'
import ProjectWorkspace from '../components/ProjectWorkspace'

const TABS = [
  ['resumen', 'Resumen'],
  ['datos', 'Mis datos'],
  ['cotizaciones', 'Cotizaciones'],
  ['presupuestos', 'Mi Cotizador'],
  ['facturas', 'Facturas'],
  ['credenciales', 'Credenciales'],
  ['notificaciones', 'Notificaciones'],
]

/* ── Fondo aurora intensificado, exclusivo del portal ── */
function PortalAurora() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute w-[70vw] h-[70vw] rounded-full blur-[130px] animate-aurora"
        style={{ top: '-20%', left: '-15%', background: 'radial-gradient(circle, rgba(139,92,246,.4), transparent 65%)' }} />
      <div className="absolute w-[55vw] h-[55vw] rounded-full blur-[140px] animate-aurora-2"
        style={{ bottom: '-25%', right: '-12%', background: 'radial-gradient(circle, rgba(244,114,240,.22), transparent 65%)' }} />
      <div className="absolute w-[45vw] h-[45vw] rounded-full blur-[120px] animate-aurora"
        style={{ top: '35%', left: '50%', background: 'radial-gradient(circle, rgba(94,234,212,.12), transparent 65%)', animationDelay: '5s' }} />
      <div className="absolute inset-0 grain-overlay opacity-[.05]" />
    </div>
  )
}

/* ── Anillo de progreso con animación de carga ── */
function ProgressRing({ pct, size = 128 }) {
  const r = size / 2 - 10
  const C = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F472F0" /><stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
          <filter id="ringGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="8" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="8" strokeLinecap="round" filter="url(#ringGlow)"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${(pct / 100) * C} ${C}` }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold tracking-tight"><CountUp value={pct} />%</span>
        <span className="text-[9.5px] uppercase tracking-widest text-white/40 font-bold">avance</span>
      </div>
    </div>
  )
}

/* ── Stepper horizontal de fases del proyecto ── */
function PhaseStepper({ current }) {
  const idx = PHASE_ORDER.indexOf(current)
  const pct = idx >= 0 ? (idx / (PHASE_ORDER.length - 1)) * 100 : 0
  return (
    <div className="relative flex justify-between mt-2">
      <div className="absolute top-[13px] left-4 right-4 h-[2px] bg-white/[.07] rounded overflow-hidden">
        <motion.div className="h-full rounded bg-gradient-to-r from-violet-dark via-violet-light to-neon-pink"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          style={{ boxShadow: '0 0 14px rgba(139,92,246,.8)' }} />
      </div>
      {PHASE_ORDER.map((ph, i) => {
        const done = idx > i, active = idx === i
        return (
          <div key={ph} className="relative z-10 flex flex-col items-center gap-2" style={{ width: `${100 / PHASE_ORDER.length}%` }}>
            {active && (
              <motion.span className="absolute -top-1 w-9 h-9 rounded-full border border-violet-light/50"
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
            )}
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: active ? 1.15 : 1, opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.09, type: 'spring', stiffness: 320, damping: 20 }}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border
                ${active ? 'border-transparent text-white bg-gradient-to-br from-violet-light to-neon-pink shadow-[0_0_18px_rgba(139,92,246,.8)]'
                : done ? 'border-violet/50 text-violet-light bg-violet/20'
                : 'border-white/10 text-white/25 bg-white/[.02]'}`}>
              {done ? '✓' : i + 1}
            </motion.div>
            <span className={`text-[9px] uppercase font-bold tracking-wider text-center leading-tight
              ${active ? 'text-violet-light' : done ? 'text-white/45' : 'text-white/25'}`}>{PHASES[ph]}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Portal() {
  const nav = useNavigate()
  const toast = useToast()
  const auth = getAuth()

  const [tab, setTab] = useState('resumen')
  const [workspaceProject, setWorkspaceProject] = useState(null)
  const [viewingTask, setViewingTask] = useState(null)
  const [client, setClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [invoices, setInvoices] = useState([])
  const [creds, setCreds] = useState([])
  const [loading, setLoading] = useState(true)

  // formulario de solicitud al equipo
  const [reqOpen, setReqOpen] = useState(false)
  const [reqForm, setReqForm] = useState({ title: '', link: '', description: '', project: '', priority: 'media' })
  const [reqSaving, setReqSaving] = useState(false)

  // formulario de datos propios
  const [dataForm, setDataForm] = useState({ contact_name: '', email: '', phone: '', website: '', instagram: '', facebook: '' })
  const [dataSaving, setDataSaving] = useState(false)
  const [brandColor, setBrandColor] = useState('#8B5CF6')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')

  // presupuestos (blanco: propios + recibidos + catálogo)
  const [myQuotes, setMyQuotes] = useState([])
  const [receivedQuotes, setReceivedQuotes] = useState([])
  const [catalogItems, setCatalogItems] = useState([])
  const [quoteSub, setQuoteSub] = useState('mias')
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState(null)
  const [viewingQuote, setViewingQuote] = useState(null)
  const [quoteAutoPrint, setQuoteAutoPrint] = useState(false)
  const [decidingQuote, setDecidingQuote] = useState(false)
  const [catalogViewOpen, setCatalogViewOpen] = useState(false)
  const [catalogAutoPrint, setCatalogAutoPrint] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [itemForm, setItemForm] = useState({ name: '', type: 'material', unit: 'unidad', unit_cost: '', currency: 'ARS' })
  const [itemSaving, setItemSaving] = useState(false)

  // bóveda de credenciales
  const [credOpen, setCredOpen] = useState(false)
  const [credEditId, setCredEditId] = useState(null)
  const [credForm, setCredForm] = useState({ platform: '', username: '', password: '', url: '', notes: '' })
  const [credSaving, setCredSaving] = useState(false)
  const [revealed, setRevealed] = useState({})

  useEffect(() => {
    if (!auth?.token || !auth?.record) { nav('/'); return }
    if (auth.record.role !== 'cliente') { nav('/app'); return }
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const cs = await list('clients')
      const mine = cs[0] || null
      setClient(mine)
      if (mine) {
        setDataForm({
          contact_name: mine.contact_name || '', email: mine.email || '', phone: mine.phone || '',
          website: mine.website || '', instagram: mine.instagram || '', facebook: mine.facebook || '',
        })
        if (/^#[0-9a-fA-F]{6}$/.test(mine.brand_color || '')) setBrandColor(mine.brand_color)
        if (mine.logo) setLogoPreview(fileUrl('clients', mine.id, mine.logo, '200x200'))
      }
      const [ps, ts, txs, cds, myQ, recQ, items] = await Promise.all([
        list('projects', '&sort=-created&expand=service'),
        list('tasks', '&sort=-created&expand=project'),
        list('transactions', '&sort=-date&filter=' + encodeURIComponent('type="ingreso"')),
        list('client_access', '&sort=-created'),
        list('quotes', '&sort=-created&filter=' + encodeURIComponent('issuer_type="cliente"')),
        list('quotes', '&sort=-created&filter=' + encodeURIComponent('issuer_type="estudio"')),
        list('quote_items', '&sort=name'),
      ])
      setProjects(ps); setTasks(ts); setInvoices(txs); setCreds(cds)
      setMyQuotes(myQ); setReceivedQuotes(recQ); setCatalogItems(items)
    } catch {
      toast('No se pudo cargar tu información. Recarga la página.', true)
    } finally { setLoading(false) }
  }

  const firstName = (client?.contact_name || auth?.record?.name || auth?.record?.email || '').split(' ')[0].split('@')[0]
  const RECURRING_TYPES = { mensual: true, trimestral: true, anual: true }
  const upcomingRenewals = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return projects
      .filter(p => RECURRING_TYPES[p.expand?.service?.billing_type] && p.next_renewal_date)
      .map(p => {
        const due = new Date(p.next_renewal_date.slice(0, 10) + 'T00:00:00')
        const daysLeft = Math.round((due - today) / 86400000)
        return { ...p, daysLeft }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [projects])
  const pendingInvoices = invoices.filter(i => i.status === 'pendiente' || i.status === 'vencido')
  const overdueInvoices = invoices.filter(i => i.status === 'vencido')
  const paidInvoices = invoices.filter(i => i.status === 'pagado')
  const pendingTotalArs = pendingInvoices.reduce((a, i) => a + (Number(i.amount_ars ?? i.amount) || 0), 0)
  const paidTotalArs = paidInvoices.reduce((a, i) => a + (Number(i.amount_ars ?? i.amount) || 0), 0)

  /* ── Guardar solicitud al equipo ── */
  async function sendRequest() {
    if (!reqForm.title.trim()) { toast('Escribe de qué se trata tu solicitud.', true); return }
    setReqSaving(true)
    try {
      await createRec('tasks', {
        title: reqForm.title.trim(),
        description: reqForm.description.trim(),
        link: reqForm.link.trim(),
        project: reqForm.project || '',
        client: client?.id || '',
        priority: reqForm.priority,
        status: 'pendiente',
        from_client: true,
      })
      notifyTeam({
        title: `Nueva solicitud de ${client?.name || 'un cliente'}`,
        message: reqForm.title.trim(),
        type: 'tarea', client: client?.id || '',
      })
      setReqOpen(false)
      setReqForm({ title: '', link: '', description: '', project: '', priority: 'media' })
      toast('✦ Tu solicitud llegó al equipo')
      loadAll()
    } catch (e) {
      toast(e?.data?.data?.link ? 'El enlace debe iniciar con https://' : 'No se pudo enviar. Inténtalo de nuevo.', true)
    } finally { setReqSaving(false) }
  }

  /* ── Guardar mis datos + marca ── */
  async function saveMyData() {
    if (!client) return
    setDataSaving(true)
    try {
      const fd = new FormData()
      Object.entries(dataForm).forEach(([k, v]) => fd.append(k, v || ''))
      if (!dataForm.email) fd.delete('email')
      if (!dataForm.website) fd.delete('website')
      fd.append('brand_color', brandColor)
      if (logoFile) fd.append('logo', logoFile)
      await updateRec('clients', client.id, fd, true)
      toast('Datos y marca actualizados ✓')
      loadAll()
    } catch (e) {
      const d = e?.data?.data
      toast(d?.email ? 'El correo no tiene un formato válido.' : d?.website ? 'El sitio web debe iniciar con https://' : 'No se pudieron guardar los cambios.', true)
    } finally { setDataSaving(false) }
  }

  /* ── Catálogo propio (materiales / mano de obra) ── */
  function openItemNew() { setEditingItem(null); setItemForm({ name: '', type: 'material', unit: 'unidad', unit_cost: '', currency: 'ARS' }); setItemOpen(true) }
  function openItemEdit(it) { setEditingItem(it.id); setItemForm({ name: it.name || '', type: it.type || 'material', unit: it.unit || 'unidad', unit_cost: it.unit_cost || '', currency: it.currency || 'ARS' }); setItemOpen(true) }

  async function saveItem() {
    if (!itemForm.name.trim()) { toast('Ponele un nombre al ítem.', true); return }
    if (!client) return
    setItemSaving(true)
    try {
      const body = { ...itemForm, name: itemForm.name.trim(), unit_cost: Number(itemForm.unit_cost) || 0, client: client.id }
      if (editingItem) await updateRec('quote_items', editingItem, body)
      else await createRec('quote_items', body)
      setItemOpen(false); toast(editingItem ? 'Ítem actualizado ✓' : '✦ Ítem agregado a tu catálogo'); loadAll()
    } catch { toast('No se pudo guardar el ítem.', true) } finally { setItemSaving(false) }
  }
  async function delItem(it) {
    if (!confirm(`¿Eliminar "${it.name}" de tu catálogo?`)) return
    try { await removeRec('quote_items', it.id); toast('Ítem eliminado ✓'); loadAll() }
    catch { toast('No se pudo eliminar.', true) }
  }
  async function delQuote(q) {
    if (!confirm(`¿Eliminar la cotización "${q.title}"?`)) return
    try {
      const lines = await list('quote_lines', '&filter=' + encodeURIComponent('quote="' + q.id + '"'))
      await Promise.all(lines.map(l => removeRec('quote_lines', l.id)))
      await removeRec('quotes', q.id)
      toast('Cotización eliminada ✓'); loadAll()
    } catch { toast('No se pudo eliminar.', true) }
  }

  function handleNotifNavigate(n) {
    if (n.task) {
      const t = tasks.find(x => x.id === n.task)
      if (t) { setViewingTask(t); return }
    }
    if (n.project) {
      const p = projects.find(x => x.id === n.project)
      if (p) { setWorkspaceProject(p); return }
    }
    setTab('cotizaciones')
  }

  async function decideQuote(status, reason) {
    if (!viewingQuote) return
    setDecidingQuote(true)
    try {
      await updateRec('quotes', viewingQuote.id, status === 'rechazado' ? { status, rejection_reason: reason || '' } : { status })
      notifyTeam({
        title: `${client?.name || 'Un cliente'} ${status === 'aprobado' ? 'aprobó' : 'rechazó'} una cotización`,
        message: status === 'rechazado' && reason ? `Motivo: ${reason}` : viewingQuote.title, type: 'pago', client: client?.id || '',
      })
      logActivity({ action: 'actualizar', entity: 'cotización', entity_name: viewingQuote.title, summary: status === 'rechazado' ? `rechazada: ${reason || 'sin motivo'}` : 'aprobada por el cliente' })

      // Al aprobar: se crea UN PROYECTO POR CADA ÍTEM que corresponda a un servicio activo del catálogo
      // (cada servicio tiene su propia metodología, precio y forma de pago). Los ítems sueltos que no
      // están ligados a un servicio activo quedan solo en la cotización — no generan ningún proyecto.
      let createdCount = 0
      if (status === 'aprobado' && viewingQuote.issuer_type === 'estudio') {
        try {
          const lines = await list('quote_lines', '&filter=' + encodeURIComponent(`quote="${viewingQuote.id}"`))
          const serviceLines = lines.filter(l => l.service)
          if (serviceLines.length) {
            const serviceIds = [...new Set(serviceLines.map(l => l.service))]
            const filterExpr = serviceIds.map(id => `id="${id}"`).join(' || ')
            const activeServices = await list('services', '&filter=' + encodeURIComponent(`(${filterExpr}) && active=true`))
            const activeIds = new Set(activeServices.map(s => s.id))
            const qualifying = serviceLines.filter(l => activeIds.has(l.service))
            for (const line of qualifying) {
              const lineArs = viewingQuote.currency === 'ARS' ? line.line_total : line.line_total * (viewingQuote.fx_rate || 1)
              await createRec('projects', {
                name: line.description, client: client?.id || '', service: line.service,
                status: 'en_progreso', phase: 'descubrimiento', progress: PHASE_PROGRESS.descubrimiento,
                description: `Generado automáticamente al aprobar la cotización "${viewingQuote.title}".`,
                budget: line.line_total, budget_currency: viewingQuote.currency,
                budget_fx_rate: viewingQuote.fx_rate || 1, budget_ars: Math.round(lineArs),
              })
              logActivity({ action: 'crear', entity: 'proyecto', entity_name: line.description, summary: 'creado automáticamente al aprobar una cotización' })
              createdCount++
            }
          }
        } catch { /* si falla, la aprobación de la cotización ya quedó guardada igual */ }
      }

      toast(status === 'aprobado'
        ? (createdCount > 0 ? `✓ Cotización aprobada — se ${createdCount > 1 ? 'crearon' : 'creó'} ${createdCount} proyecto${createdCount > 1 ? 's' : ''}` : '✓ Cotización aprobada')
        : 'Cotización rechazada')
      setViewingQuote(null)
      loadAll()
    } catch { toast('No se pudo registrar tu decisión. Intentá de nuevo.', true) }
    finally { setDecidingQuote(false) }
  }

  /* ── Bóveda de credenciales ── */
  function openCredNew() { setCredEditId(null); setCredForm({ platform: '', username: '', password: '', url: '', notes: '' }); setCredOpen(true) }
  function openCredEdit(c) { setCredEditId(c.id); setCredForm({ platform: c.platform || '', username: c.username || '', password: c.password || '', url: c.url || '', notes: c.notes || '' }); setCredOpen(true) }

  async function saveCred() {
    if (!credForm.platform.trim()) { toast('Escribe el nombre de la plataforma.', true); return }
    if (!client) { toast('No encontramos tu ficha de cliente.', true); return }
    setCredSaving(true)
    try {
      const body = { ...credForm, platform: credForm.platform.trim(), client: client.id }
      if (!body.url) delete body.url
      if (credEditId) await updateRec('client_access', credEditId, body)
      else await createRec('client_access', body)
      setCredOpen(false)
      toast(credEditId ? 'Acceso actualizado ✓' : '✦ Acceso guardado en tu bóveda')
      loadAll()
    } catch (e) {
      toast(e?.data?.data?.url ? 'La dirección debe iniciar con https://' : 'No se pudo guardar el acceso.', true)
    } finally { setCredSaving(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PortalAurora />
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}
          className="text-[13px] text-white/50 tracking-wide">Preparando tu espacio…</motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <PortalAurora />

      {/* ── Encabezado ── */}
      <header className="max-w-[1080px] mx-auto px-4 md:px-8 pt-7 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.3), rgba(244,114,240,.18))', border: '1px solid rgba(167,139,250,.4)', boxShadow: '0 0 22px rgba(139,92,246,.35)' }}>
            {client?.logo
              ? <img src={fileUrl('clients', client.id, client.logo, '100x100')} alt="" className="w-full h-full object-cover" />
              : <svg width="20" height="20" viewBox="0 0 30 30"><defs><linearGradient id="pmg" x1="0" y1="0" x2="30" y2="30"><stop offset="0" stopColor="#F472F0" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs><path d="M 5 24 V 6 L 15 18 L 25 6 V 24" fill="none" stroke="url(#pmg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </motion.div>
          <div className="flex-1 min-w-0">
            <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-[23px] font-extrabold tracking-tight truncate">
              Hola, {firstName || 'bienvenido'} <span className="inline-block animate-[float_2.5s_ease-in-out_infinite]">👋</span>
            </motion.h1>
            <p className="text-[12px] text-white/40 mt-0.5">{client?.name || 'Tu espacio en Mateo Estudio'}</p>
          </div>
          <NotificationBell refreshKey={tab} onClick={() => setTab('notificaciones')} />
          <button onClick={() => { clearAuth(); nav('/') }} className="btn-ghost !py-2 !px-3 text-[12px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
            Salir
          </button>
        </div>
      </header>

      {/* ── Pestañas ── */}
      <nav className="max-w-[1080px] mx-auto px-4 md:px-8 sticky top-0 z-30 py-3"
        style={{ background: 'linear-gradient(180deg, rgba(5,5,8,.92), rgba(5,5,8,.55) 70%, transparent)', backdropFilter: 'blur(8px)' }}>
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative text-[12.5px] font-bold px-4 py-2 rounded-full transition-colors z-0 flex items-center gap-2
                ${tab === key ? 'text-white' : 'text-white/45 hover:text-white/80'}`}>
              {tab === key && (
                <motion.span layoutId="portal-tab" transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-violet-dark to-violet-light shadow-[0_0_18px_rgba(139,92,246,.55)]" />
              )}
              {label}
              {key === 'facturas' && pendingInvoices.length > 0 && (
                <motion.span animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.1, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-coral shadow-[0_0_8px_rgba(251,113,133,.9)]" />
              )}
              {key === 'cotizaciones' && receivedQuotes.some(q => q.status === 'enviado') && (
                <motion.span animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.1, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-amber shadow-[0_0_8px_rgba(251,191,36,.9)]" />
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-[1080px] mx-auto px-4 md:px-8 pb-14">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.9, 0.25, 1] }}>

            {/* ═══════════ RESUMEN ═══════════ */}
            {tab === 'resumen' && (
              <div className="grid gap-5">
                {/* Solicitud al equipo — arriba de todo */}
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  className="card !p-5 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
                    <svg className="w-5 h-5 text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 5v14M5 12h14" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold">¿Necesitás algo del equipo?</h3>
                    <p className="text-[12px] text-white/40 mt-0.5">Mandanos un pedido, un link o un comentario — lo sumamos a la lista de trabajo.</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} className="btn-glass flex-shrink-0" onClick={() => setReqOpen(true)}>
                    Enviar solicitud
                  </motion.button>
                </motion.div>

                {/* Carrusel 3D de proyectos */}
                <div>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <h3 className="text-[13.5px] font-bold">Tus proyectos</h3>
                    {!!projects.length && <span className="text-[10.5px] font-semibold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">{projects.length}</span>}
                  </div>
                  {!projects.length ? (
                    <div className="card text-center py-14">
                      <p className="text-[14px] font-semibold">Todavía no hay un proyecto en marcha</p>
                      <p className="text-[12.5px] text-white/40 mt-1.5">En cuanto arranquemos, vas a verlo acá con su avance en tiempo real.</p>
                    </div>
                  ) : (
                    <ProjectCarousel3D projects={projects} onOpen={setWorkspaceProject} />
                  )}
                </div>

                {/* Facturas: pendientes y pagadas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => setTab('facturas')}
                    className="card !p-5 text-left relative overflow-hidden">
                    {overdueInvoices.length > 0 && (
                      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.1, repeat: Infinity }}
                        className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-coral" style={{ boxShadow: '0 0 10px rgba(251,113,133,.9)' }} />
                    )}
                    <div className="text-[11px] uppercase font-bold tracking-wide text-white/40">Pendientes de pago</div>
                    <div className="text-[24px] font-extrabold tracking-tight mt-2 text-amber">{fmtARS(pendingTotalArs)}</div>
                    <div className="text-[11.5px] text-white/35 mt-1.5">{pendingInvoices.length} factura{pendingInvoices.length !== 1 ? 's' : ''}{overdueInvoices.length > 0 ? ` · ${overdueInvoices.length} vencida${overdueInvoices.length > 1 ? 's' : ''}` : ''}</div>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => setTab('facturas')}
                    className="card !p-5 text-left">
                    <div className="text-[11px] uppercase font-bold tracking-wide text-white/40">Ya pagadas</div>
                    <div className="text-[24px] font-extrabold tracking-tight mt-2 text-mint">{fmtARS(paidTotalArs)}</div>
                    <div className="text-[11.5px] text-white/35 mt-1.5">{paidInvoices.length} factura{paidInvoices.length !== 1 ? 's' : ''}</div>
                  </motion.button>
                </div>

                {/* Utilidades */}
                <div>
                  <h3 className="text-[13.5px] font-bold mb-3 px-1">Más herramientas</h3>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(140px,100%),1fr))' }}>
                    {[
                      { key: 'tareas_link', label: 'Actividad', sub: `${tasks.length} movimiento${tasks.length !== 1 ? 's' : ''}`, icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />, color: '#A78BFA', badge: tasks.filter(t => t.status !== 'completada').length, onClick: () => tasks[0] && setViewingTask(tasks[0]) },
                      { key: 'cotizaciones', label: 'Cotizaciones', sub: `${receivedQuotes.length} de Mateo Estudio`, icon: <><path d="M9 7h6M9 11h6M9 15h3" /><rect x="4" y="3" width="16" height="18" rx="2" /></>, color: '#60A5FA', badge: receivedQuotes.filter(q => q.status === 'enviado').length, onClick: () => setTab('cotizaciones') },
                      { key: 'presupuestos', label: 'Mi Cotizador', sub: `${myQuotes.length} propias`, icon: <><path d="M12 5v14M5 12h14" /></>, color: '#F472F0', badge: 0, onClick: () => setTab('presupuestos') },
                      { key: 'vencimientos', label: 'Vencimientos', sub: upcomingRenewals.length ? `${upcomingRenewals.length} activos` : 'Sin recurrentes', icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>, color: '#FBBF24', badge: upcomingRenewals.filter(r => r.daysLeft <= 2).length, onClick: () => {} },
                      { key: 'credenciales', label: 'Credenciales', sub: `${creds.length} guardadas`, icon: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>, color: '#34D399', badge: 0, onClick: () => setTab('credenciales') },
                      { key: 'notificaciones', label: 'Notificaciones', sub: 'Ver todas', icon: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>, color: '#F472F0', badge: 0, onClick: () => setTab('notificaciones') },
                    ].map((u, i) => (
                      <motion.button key={u.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} onClick={u.onClick}
                        className="card !p-4 text-left relative overflow-hidden">
                        {u.badge > 0 && (
                          <span className="absolute top-3 right-3 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: u.color, boxShadow: `0 0 8px ${u.color}90` }}>{u.badge}</span>
                        )}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ background: `${u.color}18`, border: `1px solid ${u.color}40` }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={u.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{u.icon}</svg>
                        </div>
                        <div className="text-[12.5px] font-bold">{u.label}</div>
                        <div className="text-[10.5px] text-white/35 mt-0.5">{u.sub}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════ MIS DATOS ═══════════ */}
            {tab === 'datos' && (
              <div className="grid gap-5 max-w-2xl">
                <div className="card !p-6">
                  <h3 className="text-[15px] font-bold flex items-center gap-2">Tu marca <span className="text-[9.5px] font-bold text-neon-cyan/90 bg-[#5EEAD4]/[.1] border border-[#5EEAD4]/30 rounded-full px-2 py-0.5 uppercase tracking-wide">marca blanca</span></h3>
                  <p className="text-[12.5px] text-white/40 mt-1.5 mb-5 leading-relaxed">Tu logo y color aparecen en los presupuestos que generes para tus propios clientes, desde la pestaña Presupuestos.</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-3 border-[1.5px] border-dashed border-violet-light/30 rounded-xl p-3 cursor-pointer hover:border-violet-light/60 hover:bg-violet/5 transition flex-1 min-w-[220px]">
                      <div className="w-12 h-12 rounded-lg bg-violet/[.12] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logoPreview ? <img src={logoPreview} className="w-full h-full object-cover" /> :
                          <svg className="w-5 h-5 text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5-9 9" /></svg>}
                      </div>
                      <span className="text-xs text-white/55"><b className="text-violet-light font-semibold">Subí tu logo</b><br />PNG, JPG, SVG o WebP</span>
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }} />
                    </label>
                    <div className="flex items-center gap-2.5">
                      <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-11 h-11 p-1 rounded-xl bg-white/[.04] border border-white/[.09] cursor-pointer" />
                      <div>
                        <div className="text-[11px] text-white/40">Color de marca</div>
                        <div className="text-[12.5px] font-mono">{brandColor}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card !p-6">
                  <h3 className="text-[15px] font-bold">Tus datos de contacto</h3>
                  <p className="text-[12.5px] text-white/40 mt-1.5 mb-6">Mantenelos al día para que podamos comunicarnos sin vueltas.</p>
                  <div className="grid grid-cols-2 gap-3.5 max-[520px]:grid-cols-1">
                    <Field label="Persona de contacto"><input className="field" value={dataForm.contact_name} onChange={e => setDataForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Nombre y apellido" /></Field>
                    <Field label="Teléfono"><input className="field" value={dataForm.phone} onChange={e => setDataForm(f => ({ ...f, phone: e.target.value }))} placeholder="11 0000 0000" /></Field>
                    <Field label="Correo" full><input type="email" className="field" value={dataForm.email} onChange={e => setDataForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" /></Field>
                    <Field label="Sitio web" full><input className="field" value={dataForm.website} onChange={e => setDataForm(f => ({ ...f, website: e.target.value }))} placeholder="https://tuempresa.com" /></Field>
                    <Field label="Instagram"><input className="field" value={dataForm.instagram} onChange={e => setDataForm(f => ({ ...f, instagram: e.target.value }))} placeholder="@cuenta" /></Field>
                    <Field label="Facebook"><input className="field" value={dataForm.facebook} onChange={e => setDataForm(f => ({ ...f, facebook: e.target.value }))} placeholder="/pagina" /></Field>
                  </div>
                  <div className="flex justify-end mt-6">
                    <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={dataSaving} onClick={saveMyData}>
                      {dataSaving ? 'Guardando…' : 'Guardar cambios'}
                    </motion.button>
                  </div>
                </div>

                <div className="card !p-6">
                  <h3 className="text-[15px] font-bold">Documentos de tu empresa</h3>
                  <p className="text-[12.5px] text-white/40 mt-1.5 mb-5 leading-relaxed">Guardá acá contratos, papeles impositivos o cualquier archivo importante — solo vos y el equipo de Mateo Estudio pueden verlos.</p>
                  {client && <ClientDocuments clientId={client.id} />}
                </div>
              </div>
            )}

            {/* ═══════════ PRESUPUESTOS (marca blanca) ═══════════ */}
            {tab === 'presupuestos' && (
              <div className="grid gap-5">
                <div className="card flex items-center gap-4 flex-wrap !p-5">
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
                    <svg className="w-5 h-5 text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 7h6M9 11h6M9 15h3" /><rect x="4" y="3" width="16" height="18" rx="2" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold">Tu cotizador con tu marca</h3>
                    <p className="text-[12.5px] text-white/40 mt-1 leading-relaxed">Armá presupuestos para tus propios clientes con tu logo y tu color. El total se calcula solo con tu margen de ganancia.</p>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {[['mias', `Mis cotizaciones (${myQuotes.length})`], ['catalogo', `Mi catálogo (${catalogItems.length})`]].map(([key, label]) => (
                    <button key={key} onClick={() => setQuoteSub(key)}
                      className={`relative text-xs font-bold px-4 py-2 rounded-full transition-colors z-0
                        ${quoteSub === key ? 'text-white' : 'text-white/45 hover:text-white/80'}`}>
                      {quoteSub === key && (
                        <motion.span layoutId="quote-sub-tab" transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                          className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-violet-dark to-violet-light shadow-[0_0_18px_rgba(139,92,246,.55)]" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>

                {quoteSub === 'mias' && (
                  <div>
                    <div className="flex justify-end mb-3">
                      <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" onClick={() => { setEditingQuote(null); setQuoteOpen(true) }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        Nueva cotización
                      </motion.button>
                    </div>
                    {!myQuotes.length ? (
                      <div className="card text-center py-14">
                        <p className="text-[14px] font-semibold">Todavía no armaste ninguna cotización</p>
                        <p className="text-[12.5px] text-white/40 mt-1.5">Empezá cargando algunos ítems en "Mi catálogo" o creá una cotización directamente.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {myQuotes.map(q => (
                          <QuoteRow key={q.id} quote={q} subtitle={q.recipient_name || 'Sin destinatario'}
                            onView={() => { setQuoteAutoPrint(false); setViewingQuote(q) }}
                            onDownload={() => { setQuoteAutoPrint(true); setViewingQuote(q) }}
                            onEdit={() => { setEditingQuote(q); setQuoteOpen(true) }}
                            onDelete={() => delQuote(q)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {quoteSub === 'recibidas' && null}

                {quoteSub === 'catalogo' && (
                  <div>
                    <div className="flex justify-end gap-2.5 mb-3">
                      <button className="btn-ghost" onClick={() => { setCatalogAutoPrint(false); setCatalogViewOpen(true) }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
                        Descargar catálogo
                      </button>
                      <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" onClick={openItemNew}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        Agregar ítem
                      </motion.button>
                    </div>
                    {!catalogItems.length ? (
                      <div className="card text-center py-14">
                        <p className="text-[14px] font-semibold">Tu catálogo está vacío</p>
                        <p className="text-[12.5px] text-white/40 mt-1.5">Cargá materiales o mano de obra con su costo — después los sumás con un clic al armar una cotización.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(230px,100%),1fr))' }}>
                        {catalogItems.map(it => (
                          <motion.div key={it.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card !p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold truncate">{it.name}</div>
                                <div className="text-[10.5px] text-white/35 mt-0.5">{it.type === 'mano_obra' ? 'Mano de obra' : it.type === 'material' ? 'Material' : it.type === 'servicio' ? 'Servicio' : 'Otro'} · {it.unit}</div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <IconBtn onClick={() => openItemEdit(it)} title="Editar"><EditIcon /></IconBtn>
                                <IconBtn onClick={() => delItem(it)} danger title="Eliminar"><TrashIcon /></IconBtn>
                              </div>
                            </div>
                            <div className="text-[15px] font-extrabold mt-2.5">{fmtByCurrency(it.unit_cost, it.currency)}</div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Botón flotante para sumar una cotización rápido */}
                <motion.button
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 260 }}
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                  onClick={() => { setEditingQuote(null); setQuoteOpen(true) }}
                  title="Nueva cotización"
                  className="fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #F472F0)', boxShadow: '0 10px 30px rgba(139,92,246,.5), 0 0 0 1px rgba(255,255,255,.1) inset' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                </motion.button>
              </div>
            )}

            {/* ═══════════ COTIZACIONES DE MATEO ESTUDIO (separado del cotizador propio) ═══════════ */}
            {tab === 'cotizaciones' && (
              <div className="grid gap-5">
                <div className="card flex items-center gap-4 flex-wrap !p-5">
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
                    <svg className="w-5 h-5 text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 7h6M9 11h6M9 15h3" /><rect x="4" y="3" width="16" height="18" rx="2" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold">Cotizaciones de Mateo Estudio</h3>
                    <p className="text-[12.5px] text-white/40 mt-1 leading-relaxed">Los presupuestos que te armamos nosotros. Podés verlos, aprobarlos o rechazarlos.</p>
                  </div>
                </div>
                {!receivedQuotes.length ? (
                  <div className="card text-center py-14">
                    <p className="text-[14px] font-semibold">Sin cotizaciones recibidas</p>
                    <p className="text-[12.5px] text-white/40 mt-1.5">Cuando Mateo Estudio te arme un presupuesto, va a aparecer acá.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {receivedQuotes.map(q => (
                      <QuoteRow key={q.id} quote={q} subtitle="Mateo Estudio"
                        onView={() => { setQuoteAutoPrint(false); setViewingQuote(q) }}
                        onDownload={() => { setQuoteAutoPrint(true); setViewingQuote(q) }}
                        tag={<span className="pill text-[#7DD3FC] bg-[#7DD3FC]/[.08] border border-[#7DD3FC]/30 flex-shrink-0">recibida</span>} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ FACTURAS ═══════════ */}
            {tab === 'facturas' && (
              <div className="grid gap-5">
                {pendingInvoices.length > 0 && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap"
                    style={{ background: overdueInvoices.length ? 'linear-gradient(135deg, rgba(251,113,133,.14), rgba(251,113,133,.05))' : 'linear-gradient(135deg, rgba(251,191,36,.12), rgba(251,191,36,.04))',
                      border: `1px solid ${overdueInvoices.length ? 'rgba(251,113,133,.35)' : 'rgba(251,191,36,.3)'}` }}>
                    <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.1, repeat: Infinity }}
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${overdueInvoices.length ? 'bg-coral' : 'bg-amber'}`}
                      style={{ boxShadow: `0 0 10px ${overdueInvoices.length ? 'rgba(251,113,133,.9)' : 'rgba(251,191,36,.9)'}` }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold">
                        {overdueInvoices.length > 0
                          ? `Tenés ${overdueInvoices.length} factura${overdueInvoices.length > 1 ? 's' : ''} vencida${overdueInvoices.length > 1 ? 's' : ''}`
                          : `Tenés ${pendingInvoices.length} factura${pendingInvoices.length > 1 ? 's' : ''} pendiente${pendingInvoices.length > 1 ? 's' : ''}`}
                      </div>
                      <div className="text-[12px] text-white/50 mt-0.5">Total a saldar: <b className="text-white/85">{fmtARS(pendingTotalArs)}</b></div>
                    </div>
                  </motion.div>
                )}

                <div className="card">
                  <h3 className="text-[13.5px] font-bold mb-4">Historial de facturas</h3>
                  {!invoices.length ? (
                    <p className="text-[12.5px] text-white/35 py-6 text-center">Todavía no hay facturas emitidas.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {invoices.map((inv, i) => {
                        const isForeign = inv.currency && inv.currency !== 'ARS'
                        return (
                          <motion.div key={inv.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            whileHover={{ y: -2 }}
                            className="group relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 flex-wrap sm:flex-nowrap overflow-hidden"
                            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}>
                            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${inv.status === 'pagado' ? 'bg-mint' : inv.status === 'vencido' ? 'bg-coral' : 'bg-amber'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-[13.5px] font-semibold truncate">{inv.concept}</div>
                              <div className="text-[11.5px] text-white/35 mt-0.5 flex items-center gap-1.5">
                                {inv.status === 'vencido' && (
                                  <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.1, repeat: Infinity }}
                                    className="w-1.5 h-1.5 rounded-full bg-coral flex-shrink-0" style={{ boxShadow: '0 0 8px rgba(251,113,133,.9)' }} />
                                )}
                                {[inv.date?.slice(0, 10), inv.due_date && `vence ${inv.due_date.slice(0, 10)}`].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-[15px] font-extrabold">{fmtByCurrency(inv.amount, inv.currency)}</div>
                              {isForeign && inv.amount_ars != null && (
                                <div className="text-[10px] text-white/30 mt-0.5">≈ {fmtARS(inv.amount_ars)} ARS al emitirse</div>
                              )}
                            </div>
                            <Pill value={inv.status || 'pendiente'} />
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════ CREDENCIALES ═══════════ */}
            {tab === 'credenciales' && (
              <div className="grid gap-5">
                <div className="card flex items-center gap-4 flex-wrap">
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
                    <svg className="w-5 h-5 text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold">Tu bóveda de accesos</h3>
                    <p className="text-[12.5px] text-white/40 mt-1 leading-relaxed">
                      Guardá acá los accesos que el equipo necesita administrar (hosting, redes, dominios). Solo vos y el equipo de Mateo Estudio pueden verlos.
                    </p>
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" onClick={openCredNew}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Agregar acceso
                  </motion.button>
                </div>

                {!creds.length ? (
                  <div className="card text-center py-14">
                    <p className="text-[14px] font-semibold">Tu bóveda está vacía</p>
                    <p className="text-[12.5px] text-white/40 mt-1.5">Sumá el primer acceso para que el equipo pueda trabajar sin pedirte datos cada vez.</p>
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(280px,100%),1fr))' }}>
                    {creds.map((c, i) => (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        whileHover={{ y: -2 }} className="card !p-4">
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px] font-bold truncate">{c.platform}</div>
                            {c.url && <a href={c.url} target="_blank" rel="noopener" className="text-[11px] text-violet-light/80 hover:text-violet-light truncate block mt-0.5">{c.url}</a>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <IconBtn onClick={() => openCredEdit(c)} title="Editar"><EditIcon /></IconBtn>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {c.username && (
                            <div className="flex items-center gap-2 text-[12px]">
                              <span className="text-white/30 w-[62px] flex-shrink-0">Usuario</span>
                              <span className="font-mono truncate min-w-0 flex-1">{c.username}</span>
                            </div>
                          )}
                          {c.password && (
                            <div className="flex items-center gap-2 text-[12px]">
                              <span className="text-white/30 w-[62px] flex-shrink-0">Clave</span>
                              <span className="font-mono truncate min-w-0 flex-1">{revealed[c.id] ? c.password : '••••••••••'}</span>
                              <button onClick={() => setRevealed(r => ({ ...r, [c.id]: !r[c.id] }))}
                                className="text-white/35 hover:text-violet-light transition-colors flex-shrink-0" title={revealed[c.id] ? 'Ocultar' : 'Mostrar'}>
                                {revealed[c.id]
                                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.4M6.5 6.9C4.2 8.4 3 10.6 3 12c0 2.5 4 7 9 7a9.6 9.6 0 003.4-.6" /></svg>
                                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" /><circle cx="12" cy="12" r="2.5" /></svg>}
                              </button>
                            </div>
                          )}
                          {c.notes && <p className="text-[11.5px] text-white/35 pt-1 leading-relaxed">{c.notes}</p>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ NOTIFICACIONES ═══════════ */}
            {tab === 'notificaciones' && <NotificationsList onNavigate={handleNotifNavigate} />}

          </motion.div>
      </main>

      {/* ── Modal: solicitud al equipo ── */}
      <Modal open={reqOpen} onClose={() => setReqOpen(false)}>
        <ModalHead title="Enviar una solicitud" onClose={() => setReqOpen(false)} />
        <p className="text-[12px] text-white/40 -mt-1.5 mb-4">Contanos qué necesitás. El equipo lo recibe al instante.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="¿De qué se trata? *" full><input className="field" value={reqForm.title} onChange={e => setReqForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej. Cambiar los textos del inicio" /></Field>
          {projects.length > 0 && (
            <Field label="Proyecto" full>
              <Select value={reqForm.project} onChange={v => setReqForm(f => ({ ...f, project: v }))} placeholder="Sin proyecto específico"
                options={projects.map(p => ({ value: p.id, label: p.name }))} />
            </Field>
          )}
          <Field label="Prioridad">
            <Select value={reqForm.priority} onChange={v => setReqForm(f => ({ ...f, priority: v }))}
              options={[{ value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }, { value: 'urgente', label: 'Urgente' }]} />
          </Field>
          <Field label="Link de referencia"><input className="field" value={reqForm.link} onChange={e => setReqForm(f => ({ ...f, link: e.target.value }))} placeholder="https://…" /></Field>
          <Field label="Detalles" full><textarea className="field min-h-[80px]" value={reqForm.description} onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))} placeholder="Contanos con tus palabras qué querés lograr." /></Field>
        </div>
        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setReqOpen(false)}>Cancelar</button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={reqSaving} onClick={sendRequest}>
            {reqSaving ? 'Enviando…' : 'Enviar al equipo ✦'}
          </motion.button>
        </div>
      </Modal>

      {/* ── Modal: acceso de la bóveda ── */}
      <Modal open={credOpen} onClose={() => setCredOpen(false)}>
        <ModalHead title={credEditId ? 'Editar acceso' : 'Agregar acceso'} onClose={() => setCredOpen(false)} />
        <p className="text-[12px] text-white/40 -mt-1.5 mb-4">Estos datos quedan guardados para que el equipo pueda administrar tus plataformas.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Plataforma *" full><input className="field" value={credForm.platform} onChange={e => setCredForm(f => ({ ...f, platform: e.target.value }))} placeholder="Ej. Instagram, Hosting, Google Ads" /></Field>
          <Field label="Usuario"><input className="field" value={credForm.username} onChange={e => setCredForm(f => ({ ...f, username: e.target.value }))} placeholder="usuario o correo" /></Field>
          <Field label="Contraseña"><input className="field font-mono" value={credForm.password} onChange={e => setCredForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" /></Field>
          <Field label="Dirección de acceso" full><input className="field" value={credForm.url} onChange={e => setCredForm(f => ({ ...f, url: e.target.value }))} placeholder="https://panel.tuplataforma.com" /></Field>
          <Field label="Notas" full><textarea className="field min-h-[64px]" value={credForm.notes} onChange={e => setCredForm(f => ({ ...f, notes: e.target.value }))} placeholder="Aclaraciones, verificación en dos pasos, etc." /></Field>
        </div>
        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setCredOpen(false)}>Cancelar</button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={credSaving} onClick={saveCred}>
            {credSaving ? 'Guardando…' : 'Guardar acceso ✦'}
          </motion.button>
        </div>
      </Modal>

      {/* ── Cotizador propio (marca blanca) ── */}
      <QuoteBuilder open={quoteOpen} onClose={() => setQuoteOpen(false)} mode="cliente"
        ownClientId={client?.id} catalog={catalogItems} editingQuote={editingQuote} onSaved={loadAll}
        brandColor={brandColor} brandName={client?.name} />
      <QuoteViewer open={!!viewingQuote} onClose={() => setViewingQuote(null)} quote={viewingQuote} brandClient={client} autoPrint={quoteAutoPrint}
        canDecide={viewingQuote?.issuer_type === 'estudio' && viewingQuote?.status === 'enviado'} onDecide={decideQuote} deciding={decidingQuote} />
      <CatalogViewer open={catalogViewOpen} onClose={() => setCatalogViewOpen(false)} items={catalogItems} client={client} autoPrint={catalogAutoPrint} />

      {/* ── Detalle individual de un proyecto: pantalla completa con pestañas ── */}
      <ProjectWorkspace project={workspaceProject} onClose={() => setWorkspaceProject(null)} allowContribute />

      {/* ── Detalle de una tarea, con comentarios ── */}
      <Modal open={!!viewingTask} onClose={() => setViewingTask(null)}>
        {viewingTask && (
          <>
            <ModalHead title={viewingTask.title} onClose={() => setViewingTask(null)} />
            <div className="flex items-center gap-2 mb-1">
              <Pill value={viewingTask.status || 'pendiente'} />
              {viewingTask.from_client && <span className="pill text-[#7DD3FC] bg-[#7DD3FC]/[.08] border border-[#7DD3FC]/30">tuya</span>}
            </div>
            {viewingTask.description && <p className="text-[13px] text-white/45 mt-3 leading-relaxed">{viewingTask.description}</p>}
            {viewingTask.link && <a href={viewingTask.link} target="_blank" rel="noopener" className="text-[12px] text-violet-light hover:text-violet-light/80 transition-colors block mt-2 truncate">{viewingTask.link}</a>}
            <div className="mt-6 pt-4 border-t border-white/[.06]">
              <div className="text-[10.5px] uppercase font-bold tracking-[.1em] text-white/35 mb-3">Comentarios</div>
              <TaskComments taskId={viewingTask.id} />
            </div>
          </>
        )}
      </Modal>

      {/* ── Modal: ítem de catálogo propio ── */}
      <Modal open={itemOpen} onClose={() => setItemOpen(false)}>
        <ModalHead title={editingItem ? 'Editar ítem' : 'Agregar ítem al catálogo'} onClose={() => setItemOpen(false)} />
        <div className="grid grid-cols-2 gap-3.5 max-[520px]:grid-cols-1">
          <Field label="Nombre *" full><input className="field" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Cemento (bolsa 50kg), Hora de instalación…" /></Field>
          <Field label="Tipo">
            <Select value={itemForm.type} onChange={v => setItemForm(f => ({ ...f, type: v }))}
              options={[{ value: 'servicio', label: 'Servicio' }, { value: 'material', label: 'Material' }, { value: 'mano_obra', label: 'Mano de obra' }, { value: 'otro', label: 'Otro' }]} />
          </Field>
          <Field label="Unidad"><input className="field" value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} placeholder="unidad, hora, m², kg…" /></Field>
          <Field label="Costo" full>
            <div className="flex gap-2">
              <input type="number" min="0" step="0.01" className="field flex-1" value={itemForm.unit_cost} onChange={e => setItemForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" />
              <div className="w-[104px] flex-shrink-0">
                <Select value={itemForm.currency} onChange={v => setItemForm(f => ({ ...f, currency: v }))} options={[{ value: 'ARS', label: 'ARS $' }, { value: 'USD', label: 'USD US$' }, { value: 'MXN', label: 'MXN MX$' }]} />
              </div>
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setItemOpen(false)}>Cancelar</button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={itemSaving} onClick={saveItem}>
            {itemSaving ? 'Guardando…' : 'Guardar ítem ✦'}
          </motion.button>
        </div>
      </Modal>
      <InstallPrompt />
    </div>
  )
}
