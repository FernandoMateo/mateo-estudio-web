import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import AuroraBackground from './AuroraBackground'
import NotificationBell from './NotificationBell'
import { getAuth, list, updateRec, notifyUser } from '../lib/api'

const DAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const RECURRING_TYPES = { mensual: true, trimestral: true, anual: true }

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const auth = getAuth()

  // Reviso vencimientos recurrentes próximos (≤2 días) y aviso al cliente una sola vez por ciclo.
  useEffect(() => {
    if (!auth?.token || auth?.record?.role === 'cliente') return
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
  if (auth.record.role === 'cliente') { nav('/portal'); return null }
  const me = auth.record
  const firstName = (me.name || me.email || '').split(' ')[0].split('@')[0]
  const now = new Date()
  const dateline = `${DAYS[now.getDay()][0].toUpperCase()}${DAYS[now.getDay()].slice(1)}, ${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />
      <Sidebar me={me} open={open} setOpen={setOpen} />
      <main className="md:ml-[248px] px-4 md:px-8 pt-5 md:pt-6 pb-10 max-w-[1260px] relative z-10">
        <div className="flex items-center gap-3.5 mb-7">
          <button className="md:hidden p-2 text-white/55 flex-shrink-0" onClick={() => setOpen(o => !o)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight truncate">Hola, {firstName} <span className="inline-block animate-[float_2.5s_ease-in-out_infinite]">👋</span></h1>
            <p className="text-[12.5px] text-white/40 mt-0.5">{dateline}</p>
          </motion.div>
          <NotificationBell refreshKey={loc.pathname} onClick={() => nav('/app/notificaciones')} />
        </div>
        <Outlet context={{ me }} />
      </main>
    </div>
  )
}
