import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clearAuth } from '../lib/api'
import Logo from './Logo'

const ICONS = {
  dashboard: <path d="M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z" />,
  clientes: <><circle cx="9" cy="8" r="3.4"/><path d="M3.5 20c.6-3.4 2.9-5 5.5-5s4.9 1.6 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.6c2.6.2 4.4 1.7 5 4.4"/></>,
  proyectos: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  tareas: <><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.5 12.5l2.5 2.5 4.8-5.5"/></>,
  finanzas: <><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3.2-4 3 2.4L19 7.5"/></>,
  facturas: <><path d="M9 7h6M9 11h6M9 15h3"/><rect x="4" y="3" width="16" height="18" rx="2"/></>,
  servicios: <path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 16.8l.9-5L4.8 8.3l5-.7z"/>,
  cotizador: <><path d="M9 7h6M9 11h6M9 15h3"/><rect x="4" y="3" width="16" height="18" rx="2"/></>,
  usuarios: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l1.5 7v6a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-6z"/></>,
  notificaciones: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/></>,
  reportes: <><path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="14" width="3" height="3"/></>,
  calendario: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  historial: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  ia: <><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="9" cy="11" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.4" fill="currentColor" stroke="none"/><path d="M8.5 15c1 .8 2 1.2 3.5 1.2s2.5-.4 3.5-1.2"/><path d="M12 4V2"/></>,
  propuestas: <path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 16.8l.9-5L4.8 8.3l5-.7z"/>,
}

const ITEMS = [
  { to: '/app', label: 'Dashboard', icon: 'dashboard', end: true, adminOnly: true },
  { to: '/app/clientes', label: 'Clientes', icon: 'clientes', equipoHidden: true },
  { to: '/app/proyectos', label: 'Proyectos', icon: 'proyectos' },
  { to: '/app/tareas', label: 'Tareas', icon: 'tareas' },
  { to: '/app/calendario', label: 'Calendario', icon: 'calendario' },
  { to: '/app/finanzas', label: 'Finanzas', icon: 'finanzas', adminOnly: true },
  { to: '/app/facturas', label: 'Facturas', icon: 'facturas', adminOnly: true },
  { to: '/app/servicios', label: 'Servicios', icon: 'servicios', equipoHidden: true },
  { to: '/app/cotizador', label: 'Cotizador', icon: 'cotizador', equipoHidden: true },
  { to: '/app/propuestas', label: 'Propuestas', icon: 'propuestas', equipoHidden: true },
  { to: '/app/usuarios', label: 'Usuarios', icon: 'usuarios', equipoHidden: true },
  { to: '/app/notificaciones', label: 'Notificaciones', icon: 'notificaciones', equipoHidden: true },
  { to: '/app/reportes', label: 'Reportes', icon: 'reportes', equipoHidden: true },
  { to: '/app/historial', label: 'Historial', icon: 'historial', adminOnly: true },
  { to: '/app/ia', label: 'Herramienta IA', icon: 'ia', adminOnly: true },
]

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: i => ({ opacity: 1, x: 0, transition: { delay: i * 0.025, duration: 0.22, ease: [0.2, 0.9, 0.25, 1] } }),
}

export default function Sidebar({ me, open, setOpen, collapsed, setCollapsed }) {
  const nav = useNavigate()
  const loc = useLocation()
  const isAdmin = me?.role === 'admin'
  const isEquipo = me?.role === 'equipo'
  const firstName = (me?.name || me?.email || '').split(' ')[0].split('@')[0]
  const items = ITEMS.filter(i => (!i.adminOnly || isAdmin) && (!i.equipoHidden || !isEquipo))
  // En mobile el panel siempre se ve expandido (nunca tiene sentido un riel de solo-iconos
  // en un overlay que ya tapa toda la pantalla); el colapso "moderno" es cosa de desktop.
  const railCollapsed = collapsed

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[35] md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 transition-[transform,width] duration-300 flex flex-col pt-5 pb-4
          w-[248px] ${railCollapsed ? 'md:w-[76px]' : 'md:w-[248px]'} ${railCollapsed ? 'md:px-2.5' : 'md:px-3.5'} px-3.5
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ background: 'linear-gradient(180deg, rgba(10,10,16,.98), rgba(5,5,8,.99))', borderRight: '1px solid rgba(139,92,246,.12)', boxShadow: '4px 0 40px rgba(0,0,0,.4)' }}>

        <div className={`flex items-center gap-2.5 pb-6 ${railCollapsed ? 'md:justify-center md:px-0' : 'px-2.5'}`}>
          <motion.div
            className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.25), rgba(244,114,240,.15))', border: '1px solid rgba(167,139,250,.4)' }}
            animate={{ boxShadow: ['0 0 12px rgba(139,92,246,.3)', '0 0 24px rgba(139,92,246,.55)', '0 0 12px rgba(139,92,246,.3)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Logo size={28} />
          </motion.div>
          {(!railCollapsed || open) && (
            <div className={railCollapsed ? 'md:hidden' : ''}>
              <div className="text-[13px] font-extrabold tracking-[.2em] text-gradient whitespace-nowrap">MATEO</div>
            </div>
          )}
          <div className="flex-1 md:block hidden" />
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCollapsed(c => !c)}
            title={railCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            className={`hidden md:flex items-center justify-center w-6 h-6 rounded-lg text-white/35 hover:text-violet-light hover:bg-violet/10 transition-colors flex-shrink-0 ${railCollapsed ? 'mx-auto' : ''}`}>
            <motion.svg animate={{ rotate: railCollapsed ? 180 : 0 }} transition={{ duration: 0.3 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </motion.svg>
          </motion.button>
        </div>

        <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
          {items.map((item, i) => {
            const active = item.end ? loc.pathname === item.to : loc.pathname.startsWith(item.to)
            return (
              <div key={item.to} className="relative group/navitem">
                <motion.div custom={i} variants={itemVariants} initial="hidden" animate="show">
                  <NavLink to={item.to} end={item.end} onClick={() => setOpen(false)}
                    className={`relative flex items-center gap-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors z-0
                      ${railCollapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5'}`}>
                    {active && (
                      <motion.span layoutId="nav-indicator" transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 -z-10 rounded-xl"
                        style={{ background: 'linear-gradient(120deg, rgba(139,92,246,.9), rgba(124,58,237,.65))', boxShadow: '0 0 0 1px rgba(167,139,250,.4), 0 4px 20px rgba(139,92,246,.4), 0 0 30px rgba(139,92,246,.25)' }} />
                    )}
                    <svg className={`w-[17px] h-[17px] flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-white/45'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{ICONS[item.icon]}</svg>
                    <span className={`whitespace-nowrap ${railCollapsed ? 'md:hidden' : ''} ${active ? 'text-white font-semibold' : 'text-white/55'}`}>{item.label}</span>
                  </NavLink>
                </motion.div>
                {railCollapsed && (
                  <span className="hidden md:block pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-white opacity-0 group-hover/navitem:opacity-100 transition-opacity z-50"
                    style={{ background: '#16161f', border: '1px solid rgba(139,92,246,.35)', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                    {item.label}
                  </span>
                )}
              </div>
            )
          })}
        </nav>

        <div className={`mt-3 flex items-center gap-2.5 rounded-2xl ${railCollapsed ? 'md:justify-center md:p-2' : 'p-2.5'}`} style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)' }}>
          <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[13px] font-bold text-white relative flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #F472F0)', boxShadow: '0 0 14px rgba(139,92,246,.5)' }}>
            {(firstName[0] || 'M').toUpperCase()}
            <motion.span animate={{ boxShadow: ['0 0 0 0 rgba(52,211,153,.6)', '0 0 0 5px rgba(52,211,153,0)'] }} transition={{ duration: 1.8, repeat: Infinity }}
              className="absolute -right-0.5 -bottom-0.5 w-[10px] h-[10px] rounded-full bg-mint border-2 border-[#0A0A10]" />
          </div>
          <div className={`flex-1 min-w-0 ${railCollapsed ? 'md:hidden' : ''}`}>
            <div className="text-[12.5px] font-semibold truncate">{me?.name || me?.email}</div>
            <div className="text-[10px] text-violet-light/70 capitalize font-semibold tracking-wide">{me?.role}</div>
          </div>
          <motion.button whileHover={{ scale: 1.1 }} onClick={() => { clearAuth(); nav('/') }} title="Cerrar sesión"
            className={`text-white/35 hover:text-coral p-1 transition-colors flex-shrink-0 ${railCollapsed ? 'md:hidden' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          </motion.button>
        </div>
      </aside>
    </>
  )
}
