import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import AuroraBackground from './AuroraBackground'
import NotificationBell from './NotificationBell'
import InstallPrompt from './InstallPrompt'
import NotificationPermissionBanner from './NotificationPermissionBanner'
import { getAuth, list, updateRec, notifyUser } from '../lib/api'
import { startNotificationPolling } from '../lib/pushNotifications'

const DAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const RECURRING_TYPES = { mensual: true, trimestral: true, anual: true }

// Barra "Preguntale a Toto" — atajo directo a la Herramienta IA desde cualquier módulo,
// con el mismo lenguaje visual de búsqueda/asistente que se ve en dashboards de referencia
// modernos (glass pill, ícono de chispa, placeholder invitando a preguntar).
function AskToto({ onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="hidden md:flex items-center gap-2.5 flex-1 max-w-[340px] rounded-full px-4 py-2.5 text-left group/ask"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015))',
        border: '1px solid rgba(255,255,255,.09)',
      }}
    >
      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-shadow"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.35), rgba(244,114,240,.22))', boxShadow: '0 0 10px rgba(139,92,246,.35)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EDEBF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z" />
        </svg>
      </span>
      <span className="text-[12.5px] text-white/35 truncate group-hover/ask:text-white/55 transition-colors">Preguntale algo a Toto…</span>
    </motion.button>
  )
}

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const isDashboardHome = loc.pathname === '/app' || loc.pathname === '/app/'
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === '1' } catch { return false }
  })
  const auth = getAuth()

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0') } catch { /* sin storage, no pasa nada */ }
  }, [collapsed])

  // Avisos del navegador: revisa cada tanto si hay notificaciones nuevas y las muestra (si hay permiso).
  useEffect(() => {
    if (!auth?.token) return
    return startNotificationPolling()
  }, [auth?.token])

  // Reviso vencimientos recurrentes próximos (≤2 días) y aviso al cliente una sola vez por ciclo.
  useEffect(() => {
    if (!auth?.token || auth?.record?.role !== 'admin') return
    list('projects', '&expand=client,service&filter=' + encodeURIComponent('next_renewal_date != "" && renewal_alerted = false'))
      .then(projects => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        projects.forEach(p => {
          if (!RECURRING_TYPES[p.expand?.service?.billing_type]) return
          const due = new Date(p.next_renewal_date.slice(0, 10) + 'T00:00:00')
          const daysLeft = Math.round((due - today) / 86400000)
          if (daysLeft > 2) return
          const clientUser = p.expand?.client?.user
          if (clientUser) {
            notifyUser(clientUser, {
              title: daysLeft < 0 ? `${p.expand.service.name} está vencido` : `${p.expand.service.name} vence pronto`,
              message: daysLeft < 0 ? 'Contactanos para renovarlo cuanto antes.' : `Vence el ${p.next_renewal_date.slice(0, 10)}.`,
              type: 'alerta', project: p.id, client: p.client,
            })
          }
          updateRec('projects', p.id, { renewal_alerted: true }).catch(() => {})
        })
      }).catch(() => {})
  }, [])

  if (!auth?.token || !auth?.record) { nav('/'); return null }
  if (auth.record.role === 'cliente' || auth.record.role === 'colaborador') { nav('/portal'); return null }
  const me = auth.record

  // "equipo" solo puede ver Proyectos, Tareas y Calendario — si entra por URL directa a otro módulo, lo mandamos de vuelta.
  const EQUIPO_ALLOWED = ['/app/proyectos', '/app/tareas', '/app/calendario', '/app/notificaciones']
  if (me.role === 'equipo' && !EQUIPO_ALLOWED.some(p => loc.pathname.startsWith(p))) {
    nav('/app/proyectos'); return null
  }

  const firstName = (me.name || me.email || '').split(' ')[0].split('@')[0]
  const now = new Date()
  const dateline = `${DAYS[now.getDay()][0].toUpperCase()}${DAYS[now.getDay()].slice(1)}, ${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`
  const isAdmin = me.role === 'admin'

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />
      <Sidebar me={me} open={open} setOpen={setOpen} collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`${collapsed ? 'md:ml-[76px]' : 'md:ml-[248px]'} transition-[margin] duration-300 px-4 md:px-8 pt-5 md:pt-6 pb-10 max-w-[1320px] relative z-10`}>
        <div className="flex items-center gap-3.5 mb-7">
          <button className="md:hidden p-2 text-white/55 flex-shrink-0" onClick={() => setOpen(o => !o)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 flex-shrink-0">
            <h1 className="text-[22px] font-extrabold tracking-tight truncate">Hola, {firstName} <span className="inline-block animate-[float_2.5s_ease-in-out_infinite]">👋</span></h1>
            <p className="text-[12.5px] text-white/40 mt-0.5">{dateline}</p>
          </motion.div>
          {isAdmin && !isDashboardHome && <AskToto onClick={() => nav('/app/ia')} />}
          <div className="flex-1 md:hidden" />
          <NotificationBell refreshKey={loc.pathname} onClick={() => nav('/app/notificaciones')} />
        </div>
        <Outlet context={{ me }} />
      </main>
      <InstallPrompt />
      <NotificationPermissionBanner />
    </div>
  )
}
