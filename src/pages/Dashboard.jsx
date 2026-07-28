import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, fmtMoney, fmtARS } from '../lib/api'
import { Pill } from '../components/ui'
import CountUp from '../components/CountUp'
import { useFx } from '../context/FxContext'

function Trend({ cur, prev, good = 'up' }) {
  if (!prev && !cur) return <span className="pill text-white/40 bg-white/5 border border-white/10">—</span>
  if (!prev && cur > 0) return <span className="pill text-mint bg-mint/10 border-mint/25">▲</span>
  if (prev === 0) return <span className="pill text-white/40 bg-white/5 border border-white/10">—</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  const isGood = (good === 'up' && pct >= 0) || (good === 'down' && pct <= 0)
  if (pct > 0) return <span className={`pill ${isGood ? 'text-mint bg-mint/10 border-mint/25' : 'text-coral bg-coral/10 border-coral/25'}`}>▲ {pct}%</span>
  if (pct < 0) return <span className={`pill ${isGood ? 'text-mint bg-mint/10 border-mint/25' : 'text-coral bg-coral/10 border-coral/25'}`}>▼ {pct}%</span>
  return <span className="pill text-white/40 bg-white/5 border border-white/10">=</span>
}

function monthSum(items, y, m, type) {
  return items.filter(t => t.type === type && (() => { const d = new Date(t.date || t.created); return d.getFullYear() === y && d.getMonth() === m })())
    .reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
}

function MiniList({ items, empty, renderItem, delay = 0 }) {
  if (!items.length) return <p className="text-[12.5px] text-white/35">{empty}</p>
  return (
    <div className="flex flex-col gap-1">
      {items.slice(0, 6).map((it, i) => {
        return (
          <motion.div key={it.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + i * 0.04 }}>
            {renderItem(it)}
          </motion.div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    income: 0, incomePrev: 0,
    expense: 0, expensePrev: 0,
    due: 0,
    clients: 0, clientsPrev: 0,
    pendingTasks: [],
    upcoming: [],
  })
  const { rates } = useFx()

  useEffect(() => {
    setLoading(true)
    const now = new Date(), y = now.getFullYear(), m = now.getMonth()
    const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const RECURRING_TYPES = { mensual: true, trimestral: true, anual: true }

    Promise.all([
      list('projects', '&expand=client,service').catch(() => []),
      list('tasks', '&sort=-created&filter=' + encodeURIComponent('status!="completada"')).catch(() => []),
      list('clients', '&sort=created').catch(() => []),
      isAdmin ? list('transactions', '&sort=-date&expand=client').catch(() => []) : Promise.resolve([]),
    ]).then(([projects, tasks, clients, transactions]) => {
      const clientsThisMonth = clients.filter(c => { const d = new Date(c.created); return d.getFullYear() === y && d.getMonth() === m }).length
      const clientsLastMonth = clients.filter(c => { const d = new Date(c.created); return d.getFullYear() === py && d.getMonth() === pm }).length

      let income = 0, incomePrev = 0, expense = 0, expensePrev = 0, due = 0, upcoming = []
      if (isAdmin) {
        income = monthSum(transactions, y, m, 'ingreso')
        incomePrev = monthSum(transactions, py, pm, 'ingreso')
        expense = monthSum(transactions, y, m, 'egreso')
        expensePrev = monthSum(transactions, py, pm, 'egreso')
        due = transactions.filter(t => t.type === 'ingreso' && (t.status === 'pendiente' || t.status === 'vencido')).reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)

        const fromProjects = projects.filter(p => RECURRING_TYPES[p.expand?.service?.billing_type] && p.next_renewal_date)
          .map(p => ({ type: 'recurrente', date: p.next_renewal_date, title: p.expand?.service?.name || p.name, sub: p.expand?.client?.name, id: p.id }))
        const fromInvoices = transactions.filter(t => t.type === 'ingreso' && (t.status === 'pendiente' || t.status === 'vencido') && t.due_date)
          .map(t => ({ type: 'factura', date: t.due_date, title: t.concept, sub: t.expand?.client?.name, amount: t.amount_ars ?? t.amount, id: t.id }))
        upcoming = [...fromProjects, ...fromInvoices]
          .map(e => ({ ...e, daysLeft: Math.round((new Date(e.date.slice(0, 10) + 'T00:00:00') - today) / 86400000) }))
          .filter(e => e.daysLeft >= -7).sort((a, b) => a.daysLeft - b.daysLeft)
      }
      setStats({ income, incomePrev, expense, expensePrev, due, clients: clientsThisMonth, clientsPrev: clientsLastMonth, pendingTasks: tasks, upcoming })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [isAdmin])

  const balance = stats.income - stats.expense
  const statusColor = s => s === 'completada' ? { color: '#34D399', glow: 'rgba(52,211,153,.6)' }
    : s === 'urgente' || s === 'cancelado' || s === 'alta' ? { color: '#FB7185', glow: 'rgba(251,113,133,.6)' }
    : { color: '#A78BFA', glow: 'rgba(139,92,246,.6)' }

  if (loading) return <p className="text-[12.5px] text-white/35">Cargando dashboard…</p>

  return (
    <div className="grid gap-5">
      {isAdmin && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(180px,100%),1fr))' }}>
          {[
            { label: 'Ingresos (mes)', val: stats.income, prev: stats.incomePrev, color: 'text-mint' },
            { label: 'Egresos (mes)', val: stats.expense, prev: stats.expensePrev, color: 'text-coral', good: 'down' },
            { label: 'Balance (mes)', val: balance, color: balance >= 0 ? 'text-mint' : 'text-coral' },
            { label: 'Por cobrar', val: stats.due, color: 'text-amber' },
            { label: 'Clientes nuevos', val: stats.clients, prev: stats.clientsPrev },
          ].map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card !p-4">
              <div className="text-[11px] uppercase font-bold tracking-wider text-white/40">{k.label}</div>
              <div className="flex items-end justify-between gap-2 mt-2">
                <div className={`text-2xl font-extrabold tracking-tight ${k.color || ''}`}><CountUp value={k.val} format={k.label.includes('Clientes') ? undefined : fmtMoney} /></div>
                {k.prev != null && <Trend cur={k.val} prev={k.prev} good={k.good} />}
              </div>
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card !p-4">
            <div className="text-[11px] uppercase font-bold tracking-wider text-white/40">Dólar Cripto <span className="text-violet-light/70 normal-case text-[10px]">({rates?.live ? 'en vivo' : 'ref.'})</span></div>
            <div className="text-2xl font-extrabold tracking-tight text-gradient mt-2"><CountUp value={rates?.usdtArs || 0} format={v => '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 })} /></div>
          </motion.div>
        </div>
      )}

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isAdmin ? 0.3 : 0 }} className="card">
          <h3 className="text-[13.5px] font-bold mb-4">Próximos cobros</h3>
          <MiniList items={stats.upcoming} empty="No hay cobros pendientes." delay={isAdmin ? 0.32 : 0.02}
            renderItem={e => {
              const overdue = e.daysLeft < 0, soon = e.daysLeft >= 0 && e.daysLeft <= 2
              const color = overdue || soon ? 'text-coral' : e.daysLeft <= 7 ? 'text-amber' : 'text-white/50'
              return (
                <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-white/[.04] text-[13px] transition-colors">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${overdue || soon ? 'bg-coral' : e.daysLeft <= 7 ? 'bg-amber' : 'bg-white/25'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-[10.5px] text-white/30 truncate">{e.sub}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {e.amount && <div className="text-[12px] font-bold text-amber">{fmtARS(e.amount)}</div>}
                    <div className={`text-[10.5px] font-bold ${color}`}>
                      {overdue ? `Venció hace ${Math.abs(e.daysLeft)}d` : e.daysLeft === 0 ? 'Vence hoy' : `en ${e.daysLeft}d`}
                    </div>
                  </div>
                </div>
              )
            }} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isAdmin ? 0.35 : 0.05 }} className="card">
          <h3 className="text-[13.5px] font-bold mb-4">Tareas pendientes</h3>
          <MiniList items={stats.pendingTasks} empty="¡Ninguna tarea pendiente!" delay={isAdmin ? 0.37 : 0.07}
            renderItem={t => {
              const { color, glow } = statusColor(t.priority)
              return (
                <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-white/[.04] text-[13px] transition-colors">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${glow}` }} />
                  <span className="flex-1 min-w-0 truncate">{t.title}</span>
                  <Pill value={t.priority || 'media'} />
                </div>
              )
            }} />
        </motion.div>
      </div>
    </div>
  )
}
