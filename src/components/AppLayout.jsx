import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import AuroraBackground from './AuroraBackground'
import NotificationBell from './NotificationBell'
import { getAuth } from '../lib/api'

const DAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const auth = getAuth()

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
