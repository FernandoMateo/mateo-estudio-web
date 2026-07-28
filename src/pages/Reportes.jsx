import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, fmtARS } from '../lib/api'
import { MONTHS } from '../lib/constants'
import CountUp from '../components/CountUp'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const QUOTE_COLORS = { borrador: '#94A3B8', enviado: '#FBBF24', aprobado: '#34D399', rechazado: '#FB7185' }
const glowTooltip = { background: 'rgba(10,10,16,.95)', border: '1px solid rgba(139,92,246,.4)', borderRadius: 10, fontSize: 12, boxShadow: '0 0 24px rgba(139,92,246,.3)' }

function Kpi({ label, value, sub, accent, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }} className="card">
      <div className="text-[11px] uppercase font-bold tracking-[.08em] text-white/40">{label}</div>
      <div className={`text-[26px] font-extrabold tracking-tight mt-2.5 ${accent || ''}`}>{value}</div>
      <div className="text-[11.5px] text-white/35 mt-2">{sub}</div>
    </motion.div>
  )
}

function ProgressBar({ pct, color, glow }) {
  return (
    <div className="h-2 rounded-full bg-white/[.07] overflow-hidden">
      <motion.div className="h-full rounded-full" style={{ background: color, boxShadow: `0 0 10px ${glow}` }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  )
}

export default function Reportes() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const [invites, setInvites] = useState([])
  const [quotes, setQuotes] = useState([])
  const [clients, setClients] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      list('client_invites', '&sort=-created').catch(() => []),
      list('quotes', '&sort=-created&expand=client').catch(() => []),
      list('clients', '&sort=created').catch(() => []),
      isAdmin ? list('transactions', '&sort=date&filter=' + encodeURIComponent('type="ingreso"')).catch(() => []) : Promise.resolve([]),
    ]).then(([iv, qt, cl, tx]) => { setInvites(iv); setQuotes(qt); setClients(cl); setTransactions(tx) })
      .finally(() => setLoading(false))
  }, [isAdmin])

  // ── Embudo de invitaciones ──
  const invitesCompleted = invites.filter(i => i.status === 'completado').length
  const invitesPct = invites.length ? Math.round((invitesCompleted / invites.length) * 100) : 0

  // ── Cotizaciones ──
  const quotesByStatus = useMemo(() => {
    const acc = { borrador: 0, enviado: 0, aprobado: 0, rechazado: 0 }
    quotes.forEach(q => { acc[q.status || 'borrador'] = (acc[q.status || 'borrador'] || 0) + 1 })
    return acc
  }, [quotes])
  const decided = quotesByStatus.aprobado + quotesByStatus.rechazado
  const winRate = decided ? Math.round((quotesByStatus.aprobado / decided) * 100) : 0
  const quotePieData = Object.entries(quotesByStatus).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))

  // ── Clientes nuevos por mes (últimos 6) ──
  const clientsByMonth = useMemo(() => {
    const now = new Date(), arr = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const count = clients.filter(c => { const cd = new Date(c.created); return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth() }).length
      arr.push({ name: MONTHS[d.getMonth()].slice(0, 3), clientes: count })
    }
    return arr
  }, [clients])

  // ── Ingresos por mes (últimos 6, ARS congelado) ──
  const revenueByMonth = useMemo(() => {
    const now = new Date(), arr = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const total = transactions.filter(t => { const td = new Date(t.date || t.created); return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() })
        .reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
      arr.push({ name: MONTHS[d.getMonth()].slice(0, 3), ingresos: total })
    }
    return arr
  }, [transactions])
  const totalRevenue = transactions.reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)

  // ── Top clientes por ingresos ──
  const topClients = useMemo(() => {
    const byClient = {}
    transactions.forEach(t => {
      if (!t.client) return
      byClient[t.client] = (byClient[t.client] || 0) + (Number(t.amount_ars ?? t.amount) || 0)
    })
    return Object.entries(byClient)
      .map(([id, total]) => ({ id, total, name: clients.find(c => c.id === id)?.name || 'Cliente' }))
      .sort((a, b) => b.total - a.total).slice(0, 5)
  }, [transactions, clients])
  const maxTopClient = Math.max(...topClients.map(c => c.total), 1)

  if (loading) return <p className="text-[12.5px] text-white/35">Cargando reportes…</p>

  return (
    <div className="grid gap-5">
      <h2 className="text-[19px] font-extrabold tracking-tight -mb-1">Reportes</h2>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))' }}>
        <Kpi label="Conversión de invitaciones" value={`${invitesPct}%`} sub={`${invitesCompleted} de ${invites.length} completadas`} delay={0} />
        <Kpi label="Tasa de aprobación" value={`${winRate}%`} sub={`${quotesByStatus.aprobado} aprobadas de ${decided} decididas`} delay={0.05} />
        <Kpi label="Cotizaciones totales" value={quotes.length} sub={`${quotesByStatus.enviado} esperando respuesta`} delay={0.1} />
        {isAdmin && <Kpi label="Ingresos históricos" value={fmtARS(totalRevenue)} sub={`${transactions.length} transacciones`} accent="text-gradient" delay={0.15} />}
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card">
              <h3 className="text-[13.5px] font-bold mb-4">Ingresos <span className="text-[10px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">últimos 6 meses</span></h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <AreaChart data={revenueByMonth}>
                    <defs><linearGradient id="repRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A78BFA" stopOpacity=".4" /><stop offset="1" stopColor="#A78BFA" stopOpacity="0" /></linearGradient></defs>
                    <XAxis dataKey="name" stroke="rgba(237,235,246,.35)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(237,235,246,.35)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => '$' + Number(v).toLocaleString('es-AR')} width={56} />
                    <Tooltip contentStyle={glowTooltip} formatter={v => fmtARS(v)} />
                    <Area type="monotone" dataKey="ingresos" stroke="#C4B5FD" strokeWidth={2.4} fill="url(#repRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card">
            <h3 className="text-[13.5px] font-bold mb-4">Clientes nuevos <span className="text-[10px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2 py-0.5">últimos 6 meses</span></h3>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={clientsByMonth}>
                  <XAxis dataKey="name" stroke="rgba(237,235,246,.35)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(237,235,246,.35)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} width={26} />
                  <Tooltip contentStyle={glowTooltip} />
                  <Bar dataKey="clientes" radius={[6, 6, 0, 0]} fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col gap-5">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="card">
            <h3 className="text-[13.5px] font-bold mb-4">Cotizaciones por estado</h3>
            {!quotePieData.length ? <p className="text-[12.5px] text-white/35">Todavía no hay cotizaciones.</p> : (
              <div style={{ width: '100%', height: 190 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={quotePieData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={68} paddingAngle={3} animationDuration={1000}>
                      {quotePieData.map((d, i) => <Cell key={i} fill={QUOTE_COLORS[d.name] || '#8B5CF6'} stroke="rgba(12,12,18,.9)" strokeWidth={3} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10.5 }} formatter={v => v.charAt(0).toUpperCase() + v.slice(1)} />
                    <Tooltip contentStyle={glowTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="card">
            <h3 className="text-[13.5px] font-bold mb-4">Embudo de invitaciones</h3>
            <div className="flex items-center justify-between text-[12px] text-white/50 mb-1.5">
              <span>Completadas</span><span className="font-bold text-white/80">{invitesCompleted} / {invites.length}</span>
            </div>
            <ProgressBar pct={invitesPct} color="linear-gradient(90deg,#7C3AED,#A78BFA)" glow="rgba(139,92,246,.6)" />
            <p className="text-[11px] text-white/30 mt-2">{invites.length - invitesCompleted} invitaciones todavía sin completar.</p>
          </motion.div>

          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card">
              <h3 className="text-[13.5px] font-bold mb-4">Top clientes por ingresos</h3>
              {!topClients.length ? <p className="text-[12.5px] text-white/35">Sin transacciones registradas todavía.</p> : (
                <div className="flex flex-col gap-3">
                  {topClients.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <span className="text-[11px] text-white/30 w-4 flex-shrink-0">{i + 1}</span>
                      <span className="text-[12.5px] flex-1 min-w-0 truncate">{c.name}</span>
                      <div className="w-16 flex-shrink-0">
                        <ProgressBar pct={(c.total / maxTopClient) * 100} color="linear-gradient(90deg,#7C3AED,#F472F0)" glow="rgba(139,92,246,.5)" />
                      </div>
                      <span className="text-[11.5px] font-bold flex-shrink-0 w-20 text-right truncate">{fmtARS(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
