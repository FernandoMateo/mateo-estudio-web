import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, fmtMoney } from '../lib/api'
import { MONTHS } from '../lib/constants'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import CountUp from '../components/CountUp'
import { useFx } from '../context/FxContext'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const rise = { initial: { opacity: 0, y: 20, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 24 } } }

function greetingWord() {
  const h = new Date().getHours()
  return h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function Hero({ name }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, [])
  return (
    <motion.div variants={rise} className="relative overflow-hidden rounded-[26px] p-6 sm:p-7"
      style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.14), rgba(244,114,240,.06) 55%, rgba(255,255,255,.02))', border: '1px solid rgba(167,139,250,.22)' }}>
      <motion.div className="absolute w-[380px] h-[380px] rounded-full blur-[100px] opacity-50 pointer-events-none"
        style={{ top: '-140px', right: '-100px', background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }}
        animate={{ x: [0, 20, 0], y: [0, 15, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="relative z-[1] flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase font-bold tracking-[.12em] text-violet-light/80">{greetingWord()}</div>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight mt-1.5 leading-none">
            {name} <span className="inline-block">👋</span>
          </h1>
          <p className="text-[12.5px] text-white/45 mt-2 capitalize">
            {now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function GlowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'rgba(10,10,16,.95)', border: '1px solid rgba(139,92,246,.4)', boxShadow: '0 0 24px rgba(139,92,246,.3)' }}>
      <div className="text-white/40 mb-1">{label}</div>
      <div className="font-bold text-violet-light">{fmtMoney(payload[0].value)}</div>
    </div>
  )
}

function Trend({ pct }) {
  if (pct == null || !isFinite(pct)) return null
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold ${up ? 'text-mint' : 'text-coral'}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
        <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
      </svg>
      {Math.abs(Math.round(pct))}%
    </span>
  )
}

function Kpi({ label, value, sub, accent, icon, trend, children, className = '' }) {
  return (
    <motion.div variants={rise} whileHover={{ y: -4 }} className={`card relative overflow-hidden group ${className}`}>
      <div className="absolute -inset-px rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(200px circle at 50% 0%, rgba(139,92,246,.14), transparent 70%)' }} />
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase font-bold tracking-[.08em] text-white/40">{label}</div>
        {icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,.12)', border: '1px solid rgba(167,139,250,.25)' }}>{icon}</div>}
      </div>
      <div className="flex items-center justify-between gap-2.5 mt-3">
        <div className={`text-[28px] font-extrabold tracking-tight ${accent || ''}`}>{value}</div>
        {children}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11.5px] text-white/35">{sub}</span>
        <Trend pct={trend} />
      </div>
    </motion.div>
  )
}

function Donut({ pct }) {
  const C = 2 * Math.PI * 22
  return (
    <svg className="w-14 h-14 flex-shrink-0" viewBox="0 0 56 56">
      <defs>
        <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F472F0" /><stop offset="1" stopColor="#7C3AED" /></linearGradient>
        <filter id="dglow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="6" />
      <motion.circle cx="28" cy="28" r="22" fill="none" stroke="url(#dg)" strokeWidth="6" strokeLinecap="round" filter="url(#dglow)"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${(pct / 100) * C} ${C}` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
      <text x="28" y="29" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fill="#EDEBF6">{pct}%</text>
    </svg>
  )
}

function MiniStatus({ items, empty, statusOf }) {
  if (!items.length) return <p className="text-[12.5px] text-white/35">{empty}</p>
  return (
    <div className="flex flex-col gap-1">
      {items.slice(0, 6).map((it, i) => {
        const { color, glow, label, sub } = statusOf(it)
        return (
          <motion.div key={it.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            whileHover={{ x: 3 }} className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-white/[.045] text-[13px] transition-colors cursor-default">
            <motion.span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${glow}` }}
              animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }} />
            <span className="flex-1 min-w-0 truncate">{label}</span>
            <span className="text-[11px] text-white/35 flex-shrink-0">{sub}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

function Panel({ title, badge, className = '', children }) {
  return (
    <motion.div variants={rise} className={`card ${className}`}>
      <h3 className="text-[13.5px] font-bold mb-4 flex items-center gap-2">
        {title}
        {badge && <span className="text-[10px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">{badge}</span>}
      </h3>
      {children}
    </motion.div>
  )
}

const ICONS = {
  money: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.8"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  folder: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.8"><path d="M21 12V7a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" /></svg>,
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.8"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  users: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
}

export default function Dashboard() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const firstName = (me.name || me.email || '').split(' ')[0].split('@')[0]
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [clients, setClients] = useState([])
  const [chartData, setChartData] = useState([])
  const [monthIncome, setMonthIncome] = useState(0)
  const [incomeTrend, setIncomeTrend] = useState(null)
  const [activity, setActivity] = useState([])
  const { rates: crypto } = useFx()

  useEffect(() => {
    list('projects', '&sort=-created&expand=client').then(setProjects).catch(() => {})
    list('tasks', '&sort=-created').then(setTasks).catch(() => {})
    list('clients').then(setClients).catch(() => {})
    if (isAdmin) {
      list('activity_log', '&sort=-created&perPage=12&expand=user').then(setActivity).catch(() => {})
      list('transactions', '&sort=-date').then(items => {
        const now = new Date(), y = now.getFullYear(), m = now.getMonth()
        const income = items.filter(t => t.type === 'ingreso')
        const cur = income.filter(t => { const d = new Date(t.date || t.created); return d.getFullYear() === y && d.getMonth() === m })
          .reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
        const prevD = new Date(y, m - 1, 1)
        const prev = income.filter(t => { const d = new Date(t.date || t.created); return d.getFullYear() === prevD.getFullYear() && d.getMonth() === prevD.getMonth() })
          .reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
        setMonthIncome(cur)
        setIncomeTrend(prev > 0 ? ((cur - prev) / prev) * 100 : null)
        const arr = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(y, m - i, 1)
          const total = income.filter(t => { const td = new Date(t.date || t.created); return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() })
            .reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
          arr.push({ name: MONTHS[d.getMonth()].slice(0, 3), total })
        }
        setChartData(arr)
      }).catch(() => {})
    }
  }, [isAdmin])

  const activeProjects = projects.filter(p => p.status === 'en_progreso')
  const doneProjects = projects.filter(p => p.status === 'completado')
  const pct = projects.length ? Math.round((doneProjects.length / projects.length) * 100) : 0
  const pendingTasks = tasks.filter(t => t.status !== 'completada')
  const urgentTasks = pendingTasks.filter(t => t.priority === 'urgente' || t.priority === 'alta')
  const activeClients = clients.filter(c => c.status === 'activo')

  const statusColor = s => s === 'completado' || s === 'completada' ? { color: '#34D399', glow: 'rgba(52,211,153,.6)' }
    : s === 'urgente' || s === 'cancelado' ? { color: '#FB7185', glow: 'rgba(251,113,133,.6)' }
    : { color: '#A78BFA', glow: 'rgba(139,92,246,.6)' }

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="grid gap-5">
      <Hero name={firstName} />

      {/* KPIs — se auto-acomodan según el ancho disponible */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))' }}>
        {isAdmin && (
          <Kpi label="Ingresos del mes" value={<CountUp value={monthIncome} format={fmtMoney} />} sub="vs. mes anterior" trend={incomeTrend} accent="text-gradient" icon={ICONS.money} />
        )}
        <Kpi label="Proyectos activos" value={activeProjects.length} sub={`${doneProjects.length} completados de ${projects.length}`} icon={ICONS.folder}>
          <Donut pct={pct} />
        </Kpi>
        <Kpi label="Tareas pendientes" value={pendingTasks.length} sub={urgentTasks.length ? `${urgentTasks.length} de alta prioridad` : 'Sin urgentes por ahora'} icon={ICONS.check} />
        <Kpi label="Clientes activos" value={activeClients.length} sub={`${clients.length} en cartera total`} icon={ICONS.users} />
      </div>

      {/* Mosaico real con Grid: en pantallas anchas se reparte en 4 columnas para aprovechar todo el espacio */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
        {isAdmin && (
          <motion.div variants={rise} className="xl:col-span-3 card relative overflow-hidden">
            <div className="absolute -inset-[30%] pointer-events-none opacity-60" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,.16), transparent 60%)' }} />
            <div className="relative z-[1]">
              <h3 className="text-[13.5px] font-bold mb-4 flex items-center gap-2">Ingresos <span className="text-[10px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">últimos 6 meses</span></h3>
              <div style={{ width: '100%', height: 210 }}>
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A78BFA" stopOpacity=".4" /><stop offset="1" stopColor="#A78BFA" stopOpacity="0" /></linearGradient>
                      <filter id="lineglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <XAxis dataKey="name" stroke="rgba(237,235,246,.35)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip content={<GlowTooltip />} />
                    <Area type="monotone" dataKey="total" stroke="#C4B5FD" strokeWidth={2.6} fill="url(#ag)" filter="url(#lineglow)" animationDuration={1200} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div variants={rise} className="xl:col-span-1 card">
          <h3 className="text-[13.5px] font-bold mb-4 flex items-center gap-2">Dólar Cripto <span className="text-[10px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">{crypto?.live ? 'en vivo' : 'referencia'}</span></h3>
          {[['USDT / ARS', 'Tether', crypto?.usdtArs], ['USDC / ARS', 'USD Coin', crypto?.usdcArs], ['Oficial / ARS', 'BCRA', crypto?.oficialArs]].map(([label, sub, val]) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[.06] last:border-0">
              <div className="text-[12.5px] font-semibold">{label}<span className="block text-[10.5px] text-white/35 font-normal mt-0.5">{sub}</span></div>
              <div className="text-[15px] font-extrabold text-gradient">{val != null ? '$' + Number(val).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—'}</div>
            </div>
          ))}
          <div className="text-[10px] text-white/30 mt-3 text-right">{crypto?.live ? `Fuente: ${crypto.source}` : 'Sin conexión — valores de referencia'}</div>
        </motion.div>

        <Panel title="Proyectos recientes" className="lg:col-span-1 xl:col-span-2">
          <MiniStatus items={projects} empty="Aún no hay proyectos." statusOf={p => ({ ...statusColor(p.status), label: p.expand?.client?.name ? `${p.name} - ${p.expand.client.name}` : p.name, sub: (p.status || '').replace('_', ' ') })} />
        </Panel>
        <Panel title="Tareas" className="lg:col-span-1 xl:col-span-2">
          <MiniStatus items={tasks} empty="Sin tareas todavía." statusOf={t => ({ ...statusColor(t.status === 'completada' ? 'completada' : t.priority), label: t.title, sub: t.priority })} />
        </Panel>

        {isAdmin && (
          <Panel title="Novedades del sistema" className="xl:col-span-4">
            {!activity.length ? (
              <p className="text-[12.5px] text-white/35">Todavía no hay actividad registrada.</p>
            ) : (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))' }}>
                {activity.map((a, i) => {
                  const who = a.expand?.user?.name || a.expand?.user?.email || 'Alguien'
                  const verb = a.action === 'crear' ? 'creó' : a.action === 'eliminar' ? 'eliminó' : 'actualizó'
                  const { color, glow } = statusColor(a.action === 'eliminar' ? 'urgente' : a.action === 'crear' ? 'completado' : undefined)
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[.04] transition-colors">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: color, boxShadow: `0 0 8px ${glow}` }} />
                      <div className="text-[12px] min-w-0">
                        <span className="font-semibold">{who}</span> <span className="text-white/45">{verb} {a.entity}</span>
                        {a.entity_name && <span className="font-medium"> "{a.entity_name}"</span>}
                        <div className="text-[10px] text-white/30 mt-0.5">{new Date(a.created).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </Panel>
        )}
      </div>
    </motion.div>
  )
}
