import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, fmtMoney } from '../lib/api'
import { MONTHS } from '../lib/constants'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import CountUp from '../components/CountUp'
import { useFx } from '../context/FxContext'

function GlowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'rgba(10,10,16,.95)', border: '1px solid rgba(139,92,246,.4)', boxShadow: '0 0 24px rgba(139,92,246,.3)' }}>
      <div className="text-white/40 mb-1">{label}</div>
      <div className="font-bold text-violet-light">{fmtMoney(payload[0].value)}</div>
    </div>
  )
}

function Kpi({ label, value, sub, delay = 0, accent, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }} className="card">
      <div className="text-[11px] uppercase font-bold tracking-[.08em] text-white/40">{label}</div>
      <div className="flex items-center justify-between gap-2.5 mt-3">
        <div className={`text-[28px] font-extrabold tracking-tight ${accent || ''}`}>{value}</div>
        {children}
      </div>
      <div className="text-[11.5px] text-white/35 mt-2">{sub}</div>
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
        initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${(pct / 100) * C} ${C}` }} transition={{ duration: 1, ease: 'easeOut' }} />
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
            className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-white/[.04] text-[13px] transition-colors">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${glow}` }} />
            <span className="flex-1 truncate">{label}</span>
            <span className="text-[11px] text-white/35 flex-shrink-0">{sub}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [clients, setClients] = useState([])
  const [chartData, setChartData] = useState([])
  const [monthIncome, setMonthIncome] = useState(0)
  const { rates: crypto } = useFx()

  useEffect(() => {
    list('projects', '&sort=-created').then(setProjects).catch(() => {})
    list('tasks', '&sort=-created').then(setTasks).catch(() => {})
    list('clients').then(setClients).catch(() => {})
    if (isAdmin) {
      list('transactions', '&sort=-date').then(items => {
        const now = new Date(), y = now.getFullYear(), m = now.getMonth()
        const income = items.filter(t => t.type === 'ingreso')
        const cur = income.filter(t => { const d = new Date(t.date || t.created); return d.getFullYear() === y && d.getMonth() === m })
          .reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
        setMonthIncome(cur)
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
    <div className="grid gap-5">
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
        {isAdmin && (
          <Kpi label="Ingresos del mes" value={<CountUp value={monthIncome} format={fmtMoney} />} sub="Transacciones registradas" accent="text-gradient" delay={0} />
        )}
        <Kpi label="Proyectos activos" value={activeProjects.length} sub={`${doneProjects.length} completados de ${projects.length}`} delay={0.06}>
          <Donut pct={pct} />
        </Kpi>
        <Kpi label="Tareas pendientes" value={pendingTasks.length} sub={urgentTasks.length ? `${urgentTasks.length} de alta prioridad` : 'Sin urgentes por ahora'} delay={0.12} />
        <Kpi label="Clientes activos" value={activeClients.length} sub={`${clients.length} en cartera total`} delay={0.18} />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="flex flex-col gap-5">
          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden">
              <div className="absolute -inset-[30%] pointer-events-none opacity-60" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,.16), transparent 60%)' }} />
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
              <div className="relative z-[1]">
                <h3 className="text-[13.5px] font-bold mb-4 flex items-center gap-2">Ingresos <span className="text-[10px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">últimos 6 meses</span></h3>
                <div style={{ width: '100%', height: 200 }}>
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
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="card">
            <h3 className="text-[13.5px] font-bold mb-4">Proyectos recientes</h3>
            <MiniStatus items={projects} empty="Aún no hay proyectos." statusOf={p => ({ ...statusColor(p.status), label: p.name, sub: (p.status || '').replace('_', ' ') })} />
          </motion.div>
        </div>

        <div className="flex flex-col gap-5">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card">
            <h3 className="text-[13.5px] font-bold mb-4">Dólar Cripto <span className="text-[10px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">{crypto?.live ? 'en vivo' : 'referencia'}</span></h3>
            {[['USDT / ARS', 'Tether', crypto?.usdtArs], ['USDC / ARS', 'USD Coin', crypto?.usdcArs], ['Oficial / ARS', 'BCRA', crypto?.oficialArs]].map(([label, sub, val]) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[.06] last:border-0">
                <div className="text-[12.5px] font-semibold">{label}<span className="block text-[10.5px] text-white/35 font-normal mt-0.5">{sub}</span></div>
                <div className="text-[15px] font-extrabold text-gradient">{val != null ? '$' + Number(val).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—'}</div>
              </div>
            ))}
            <div className="text-[10px] text-white/30 mt-3 text-right">{crypto?.live ? `Fuente: ${crypto.source}` : 'Sin conexión — valores de referencia'}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
            <h3 className="text-[13.5px] font-bold mb-4">Tareas</h3>
            <MiniStatus items={tasks} empty="Sin tareas todavía." statusOf={t => ({ ...statusColor(t.status === 'completada' ? 'completada' : t.priority), label: t.title, sub: t.priority })} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
