import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, fmtARS } from '../lib/api'
import { Pill } from '../components/ui'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const WEEKDAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const TYPE_META = {
  entrega: { label: 'Entrega de proyecto', color: '#A78BFA', dot: 'bg-violet-light' },
  recurrente: { label: 'Vencimiento recurrente', color: '#FBBF24', dot: 'bg-amber' },
  factura: { label: 'Factura pendiente', color: '#FB7185', dot: 'bg-coral' },
}
const RECURRING_TYPES = { mensual: true, trimestral: true, anual: true }

function toKey(d) { return d.toISOString().slice(0, 10) }

export default function Calendario() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [projects, setProjects] = useState([])
  const [invoices, setInvoices] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      list('projects', '&expand=client,service').catch(() => []),
      isAdmin
        ? list('transactions', '&filter=' + encodeURIComponent('type="ingreso" && (status="pendiente" || status="vencido")') + '&expand=client').catch(() => [])
        : Promise.resolve([]),
    ]).then(([p, t]) => { setProjects(p); setInvoices(t) }).finally(() => setLoading(false))
  }, [])

  const events = useMemo(() => {
    const map = {}
    function add(dateStr, ev) {
      if (!dateStr) return
      const key = dateStr.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    projects.forEach(p => {
      const recurring = RECURRING_TYPES[p.expand?.service?.billing_type]
      if (recurring && p.next_renewal_date) add(p.next_renewal_date, { type: 'recurrente', title: p.expand?.service?.name || p.name, sub: p.expand?.client?.name })
      else if (p.due_date) add(p.due_date, { type: 'entrega', title: p.name, sub: p.expand?.client?.name })
    })
    invoices.forEach(t => {
      if (t.due_date) add(t.due_date, { type: 'factura', title: t.concept, sub: t.expand?.client?.name, amount: t.amount_ars ?? t.amount })
    })
    return map
  }, [projects, invoices])

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7 // lunes=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = toKey(new Date())

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  function go(delta) { setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() + delta); return d }) }

  const selectedEvents = selectedDay ? (events[selectedDay] || []) : []
  const totalMonthEvents = Object.entries(events).filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).reduce((a, [, v]) => a + v.length, 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h2 className="text-[19px] font-extrabold tracking-tight">Calendario</h2>
        <span className="text-[11px] font-semibold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2.5 py-0.5">{totalMonthEvents} este mes</span>
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_300px]">
        <div className="card !p-4 sm:!p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => go(-1)} className="p-2 rounded-lg hover:bg-white/[.06] text-white/50 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[15px] font-bold">{MONTHS[month]} {year}</h3>
              <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelectedDay(toKey(new Date())) }}
                className="text-[10.5px] font-semibold text-violet-light bg-violet/[.1] border border-violet/30 rounded-full px-2.5 py-0.5 hover:bg-violet/[.18] transition-colors">Hoy</button>
            </div>
            <button onClick={() => go(1)} className="p-2 rounded-lg hover:bg-white/[.06] text-white/50 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {WEEKDAYS.map(w => <div key={w} className="text-[10px] font-bold uppercase text-white/30 text-center py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const key = toKey(d)
              const dayEvents = events[key] || []
              const isToday = key === today
              const isSelected = key === selectedDay
              return (
                <motion.button key={key} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedDay(key === selectedDay ? null : key)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11.5px] transition-colors relative
                    ${isSelected ? 'bg-violet/[.28] border border-violet-light/60' : isToday ? 'bg-violet/[.12] border border-violet/30' : 'hover:bg-white/[.05] border border-transparent'}`}>
                  <span className={`${isToday ? 'text-violet-light font-bold' : 'text-white/70'}`}>{d.getDate()}</span>
                  {!!dayEvents.length && (
                    <div className="flex gap-[2px]">
                      {dayEvents.slice(0, 3).map((e, j) => <span key={j} className={`w-[5px] h-[5px] rounded-full ${TYPE_META[e.type].dot}`} />)}
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/[.06] flex-wrap">
            {Object.entries(TYPE_META).filter(([k]) => isAdmin || k !== 'factura').map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-[10.5px] text-white/40">
                <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-[13px] font-bold mb-4">{selectedDay ? new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : 'Elegí un día'}</h3>
          {loading ? (
            <p className="text-[12.5px] text-white/35">Cargando…</p>
          ) : !selectedDay ? (
            <p className="text-[12.5px] text-white/35">Tocá cualquier día del calendario para ver los vencimientos de esa fecha.</p>
          ) : !selectedEvents.length ? (
            <p className="text-[12.5px] text-white/35">Sin vencimientos ese día.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {selectedEvents.map((e, i) => {
                const meta = TYPE_META[e.type]
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="rounded-xl px-3 py-2.5" style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}40` }}>
                    <div className="text-[12.5px] font-semibold truncate">{e.title}</div>
                    <div className="text-[10.5px] text-white/40 mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate">{e.sub || meta.label}</span>
                      {e.amount != null && <span className="font-bold flex-shrink-0" style={{ color: meta.color }}>{fmtARS(e.amount)}</span>}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
