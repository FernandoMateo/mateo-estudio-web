import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, updateRec, removeRec, fmtMoney } from '../lib/api'
import { MONTHS } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Field, Pill, IconBtn, EditIcon, TrashIcon, ModuleHead, EmptyState, FilterTabs, PlusIcon, Select, MoneyField, MoneyDisplay } from '../components/ui'
import CountUp from '../components/CountUp'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useFx, toArs } from '../context/FxContext'

const emptyForm = { type: 'ingreso', concept: '', amount: '', currency: 'ARS', date: new Date().toISOString().slice(0, 10), status: 'pagado', method: '', client: '', project: '', due_date: '', notes: '' }
const TABS = [['todas', 'Todas'], ['ingreso', 'Ingresos'], ['egreso', 'Egresos'], ['pendientes', 'Pendientes / Vencidas']]
const PIE_COLORS = ['#8B5CF6', '#F472F0', '#5EEAD4', '#A78BFA', '#7C3AED']

function monthSum(items, y, m, type) {
  return items.filter(t => t.type === type && (() => { const d = new Date(t.date || t.created); return d.getFullYear() === y && d.getMonth() === m })())
    .reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
}
function Trend({ cur, prev }) {
  if (!prev && !cur) return <span className="pill text-white/40 bg-white/5 border border-white/10">—</span>
  if (!prev) return <span className="pill text-mint bg-mint/10 border border-mint/25">▲ nuevo</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct > 0) return <span className="pill text-mint bg-mint/10 border border-mint/25">▲ +{pct}%</span>
  if (pct < 0) return <span className="pill text-coral bg-coral/10 border border-coral/25">▼ {pct}%</span>
  return <span className="pill text-white/40 bg-white/5 border border-white/10">= 0%</span>
}

export default function Finanzas() {
  const toast = useToast()
  const { rates } = useFx()
  const [tx, setTx] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todas')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => list('transactions', '&sort=-date&expand=client,project').then(setTx).catch(() => toast('No se pudieron cargar las transacciones.', true))
  useEffect(() => {
    load()
    list('clients', '&sort=name').then(setClients).catch(() => {})
    list('projects', '&sort=name').then(setProjects).catch(() => {})
  }, [])

  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1
  const inCur = monthSum(tx, y, m, 'ingreso'), inPrev = monthSum(tx, py, pm, 'ingreso')
  const outCur = monthSum(tx, y, m, 'egreso'), outPrev = monthSum(tx, py, pm, 'egreso')
  const balance = inCur - outCur
  const due = tx.filter(t => t.type === 'ingreso' && (t.status === 'pendiente' || t.status === 'vencido')).reduce((a, t) => a + (Number(t.amount_ars ?? t.amount) || 0), 0)
  const overdueCount = tx.filter(t => t.type === 'ingreso' && t.status === 'vencido').length

  const chartData = useMemo(() => {
    const arr = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - i, 1)
      arr.push({ name: MONTHS[d.getMonth()].slice(0, 3).toUpperCase(), Ingresos: monthSum(tx, d.getFullYear(), d.getMonth(), 'ingreso'), Egresos: monthSum(tx, d.getFullYear(), d.getMonth(), 'egreso') })
    }
    return arr
  }, [tx])

  const methodData = useMemo(() => {
    const by = {}
    tx.forEach(t => { const k = t.method || 'otro'; by[k] = (by[k] || 0) + (Number(t.amount) || 0) })
    return Object.entries(by).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
  }, [tx])

  const maxV = Math.max(inCur, outCur, 1)

  const filtered = tx.filter(t => {
    if (filter === 'ingreso' && t.type !== 'ingreso') return false
    if (filter === 'egreso' && t.type !== 'egreso') return false
    if (filter === 'pendientes' && t.status !== 'pendiente' && t.status !== 'vencido') return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    const cn = t.expand?.client?.name || ''
    return (t.concept || '').toLowerCase().includes(q) || cn.toLowerCase().includes(q)
  })

  function openNew() { setEditId(null); setForm(emptyForm); setOpen(true) }
  function openEdit(t) {
    setEditId(t.id)
    setForm({ ...emptyForm, ...t, date: t.date?.slice(0, 10) || '', due_date: t.due_date?.slice(0, 10) || '', amount: t.amount || '', currency: t.currency || 'ARS' })
    setOpen(true)
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    const amount = parseFloat(form.amount)
    if (!form.concept.trim()) { toast('El concepto es obligatorio.', true); return }
    if (!amount || amount <= 0) { toast('Escribe un monto válido mayor a 0.', true); return }
    setSaving(true)
    const isForeign = form.currency && form.currency !== 'ARS'
    // Congelamos la cotización del día al momento de guardar: si sube o baja después, este registro no se mueve.
    const amountArs = Math.round(toArs(amount, form.currency, rates))
    const fxRate = isForeign ? (amount ? amountArs / amount : 0) : 1
    const body = {
      type: form.type, concept: form.concept.trim(), amount, status: form.status,
      currency: form.currency, fx_rate: fxRate || 0, amount_ars: amountArs,
      client: form.client, project: form.project, notes: form.notes.trim(),
      date: form.date ? form.date + ' 00:00:00' : '',
      due_date: form.type === 'ingreso' && form.due_date ? form.due_date + ' 00:00:00' : '',
    }
    if (form.method) body.method = form.method
    try {
      if (editId) await updateRec('transactions', editId, body)
      else await createRec('transactions', body)
      setOpen(false); toast(editId ? 'Transacción actualizada ✓' : '✦ Transacción registrada'); load()
    } catch { toast('No se pudo guardar la transacción.', true) } finally { setSaving(false) }
  }
  async function del(t) {
    if (!confirm(`¿Eliminar "${t.concept}" por ${fmtMoney(t.amount_ars ?? t.amount)}?`)) return
    try { await removeRec('transactions', t.id); toast('Transacción eliminada ✓'); load() }
    catch { toast('No se pudo eliminar.', true) }
  }

  return (
    <div>
      <ModuleHead title="Finanzas" count={`${tx.length} registradas`} search={search} onSearch={setSearch} onNew={openNew} newLabel="Nueva transacción" />

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(200px,100%),1fr))' }}>
        {[
          { label: 'Ingresos del mes', val: inCur, prev: inPrev, color: 'text-mint' },
          { label: 'Egresos del mes', val: outCur, prev: outPrev, color: 'text-coral' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card">
            <div className="text-[11.5px] uppercase font-semibold tracking-wide text-white/55">{k.label}</div>
            <div className="flex items-center justify-between gap-2.5 mt-2.5">
              <div className={`text-[26px] font-extrabold tracking-tight ${k.color}`}><CountUp value={k.val} format={fmtMoney} /></div>
              <Trend cur={k.val} prev={k.prev} />
            </div>
            <div className="text-[11.5px] text-white/35 mt-2">mes anterior: {fmtMoney(k.prev)}</div>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="card">
          <div className="text-[11.5px] uppercase font-semibold tracking-wide text-white/55">Balance del mes</div>
          <div className={`text-[26px] font-extrabold tracking-tight mt-2.5 ${balance >= 0 ? 'text-mint' : 'text-coral'}`}><CountUp value={balance} format={fmtMoney} /></div>
          <div className="text-[11.5px] text-white/35 mt-2">ingresos − egresos</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="card">
          <div className="text-[11.5px] uppercase font-semibold tracking-wide text-white/55">Por cobrar</div>
          <div className="text-[26px] font-extrabold tracking-tight text-amber mt-2.5"><CountUp value={due} format={fmtMoney} /></div>
          <div className="text-[11.5px] text-white/35 mt-2 flex items-center gap-1.5">
            {overdueCount > 0 && <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-coral shadow-[0_0_8px_rgba(248,113,113,.8)]" />}
            {overdueCount > 0 ? `${overdueCount} factura(s) VENCIDA(S)` : 'facturas pendientes de cobro'}
          </div>
        </motion.div>
      </div>

      <div className="grid gap-4 mb-4 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <div className="card relative overflow-hidden">
          <div className="absolute -inset-[30%] pointer-events-none opacity-70" style={{ background: 'radial-gradient(ellipse at 25% 15%, rgba(139,92,246,.18), transparent 60%)' }} />
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          <div className="relative z-[1]">
            <h3 className="text-sm font-bold mb-3.5">Ingresos vs Egresos <span className="text-[10px] font-semibold text-violet-light bg-violet/10 border border-violet/30 rounded px-1.5 py-0.5">últimos 6 meses</span></h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34D399" stopOpacity=".4" /><stop offset="1" stopColor="#34D399" stopOpacity="0" /></linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FB7185" stopOpacity=".35" /><stop offset="1" stopColor="#FB7185" stopOpacity="0" /></linearGradient>
                    <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  </defs>
                  <XAxis dataKey="name" stroke="rgba(237,235,246,.35)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(237,235,246,.35)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => '$' + Number(v).toLocaleString('es-AR')} width={60} />
                  <Tooltip contentStyle={{ background: 'rgba(10,10,16,.95)', border: '1px solid rgba(139,92,246,.4)', borderRadius: 10, fontSize: 12, boxShadow: '0 0 24px rgba(139,92,246,.3)' }} formatter={v => fmtMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Ingresos" stroke="#34D399" strokeWidth={2.6} fill="url(#gIn)" filter="url(#glowLine)" animationDuration={1200} />
                  <Area type="monotone" dataKey="Egresos" stroke="#FB7185" strokeWidth={2.6} fill="url(#gOut)" filter="url(#glowLine)" animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="text-sm font-bold mb-3.5">Este mes <span className="text-[10px] font-semibold text-violet-light bg-violet/10 border border-violet/30 rounded px-1.5 py-0.5">comparativa</span></h3>
            <div className="flex flex-col gap-3">
              {[['Ingresos', inCur, 'from-emerald-600 to-mint', 'rgba(52,211,153,.5)'], ['Egresos', outCur, 'from-red-600 to-coral', 'rgba(248,113,113,.4)']].map(([label, val, grad, glow]) => (
                <div key={label} className="flex items-center gap-2.5 text-xs">
                  <span className="w-[60px] text-white/55 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-2.5 rounded-md bg-white/[.06] overflow-hidden">
                    <motion.div className={`h-full rounded-md bg-gradient-to-r ${grad}`} style={{ boxShadow: `0 0 12px ${glow}` }}
                      initial={{ width: 0 }} animate={{ width: `${(val / maxV) * 100}%` }} transition={{ duration: 1.2, ease: [0.2, 0.9, 0.25, 1], delay: 0.15 }} />
                  </div>
                  <span className="min-w-[86px] text-right font-bold flex-shrink-0">{fmtMoney(val)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="text-sm font-bold mb-3.5">Métodos de pago</h3>
            {!methodData.length ? <p className="text-[12.5px] text-white/35">Sin datos suficientes.</p> : (
              <div style={{ width: '100%', height: 190 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} animationDuration={1100}>
                      {methodData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(12,12,18,.9)" strokeWidth={3} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10.5 }} />
                    <Tooltip contentStyle={{ background: 'rgba(10,10,16,.95)', border: '1px solid rgba(139,92,246,.4)', borderRadius: 10, fontSize: 12, boxShadow: '0 0 24px rgba(139,92,246,.3)' }} formatter={v => fmtMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <FilterTabs tabs={TABS} value={filter} onChange={setFilter} />
      {!tx.length ? (
        <EmptyState title="Tu contabilidad empieza aquí" text='Registra tu primer ingreso o egreso con "Nueva transacción" y las gráficas cobrarán vida.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Nada por aquí con este filtro.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(t => {
            const isIn = t.type === 'ingreso'
            const cn = t.expand?.client?.name, pn = t.expand?.project?.name
            const meta = [cn, pn, t.date?.slice(0, 10), t.method].filter(Boolean).join(' · ')
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3.5 bg-white/[.035] border border-white/[.07] rounded-xl px-4 py-3.5 hover:border-violet-light/25 transition-colors flex-wrap sm:flex-nowrap">
                <div className={`w-10 h-10 rounded-[11px] flex-shrink-0 flex items-center justify-center ${isIn ? 'bg-mint/[.12] border border-mint/35 text-mint' : 'bg-coral/[.1] border border-coral/30 text-coral'}`}>
                  <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {isIn ? <><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></> : <><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></>}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t.concept}</div>
                  <div className="text-[11.5px] text-white/35 truncate mt-0.5 flex items-center gap-1.5">
                    {t.status === 'vencido' && <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-coral shadow-[0_0_8px_rgba(248,113,113,.8)]" />}
                    {meta || 'Sin detalles'}
                  </div>
                </div>
                <span className={`font-extrabold whitespace-nowrap text-right ${isIn ? 'text-mint' : 'text-coral'}`}>
                  {isIn ? '+' : '−'}<MoneyDisplay amount={t.amount} currency={t.currency} amountArs={t.currency && t.currency !== 'ARS' ? t.amount_ars : null} />
                </span>
                <Pill value={t.status || 'pendiente'} />
                <div className="flex gap-1.5 flex-shrink-0">
                  <IconBtn onClick={() => openEdit(t)} title="Editar"><EditIcon /></IconBtn>
                  <IconBtn onClick={() => del(t)} danger title="Eliminar"><TrashIcon /></IconBtn>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHead title={editId ? 'Editar transacción' : 'Nueva transacción'} onClose={() => setOpen(false)} />
        <div className="relative flex bg-white/5 border border-white/[.07] rounded-lg p-1 mb-4.5">
          <motion.div className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md"
            animate={{ left: form.type === 'ingreso' ? 4 : '50%', background: form.type === 'ingreso' ? 'linear-gradient(135deg,rgba(16,185,129,.55),rgba(52,211,153,.32))' : 'linear-gradient(135deg,rgba(239,68,68,.55),rgba(248,113,113,.32))', boxShadow: form.type === 'ingreso' ? '0 0 18px rgba(52,211,153,.35)' : '0 0 18px rgba(248,113,113,.35)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }} />
          <button type="button" onClick={() => set('type', 'ingreso')} className={`relative z-[1] flex-1 py-2.5 rounded-md text-[13px] font-semibold transition-colors ${form.type === 'ingreso' ? 'text-white' : 'text-white/55'}`}>↑ Ingreso</button>
          <button type="button" onClick={() => set('type', 'egreso')} className={`relative z-[1] flex-1 py-2.5 rounded-md text-[13px] font-semibold transition-colors ${form.type === 'egreso' ? 'text-white' : 'text-white/55'}`}>↓ Egreso</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Concepto *" full><input className="field" value={form.concept} onChange={e => set('concept', e.target.value)} placeholder="Ej. Anticipo diseño web" /></Field>
          <Field label="Monto *" full>
            <MoneyField amount={form.amount} currency={form.currency} onAmount={v => set('amount', v)} onCurrency={v => set('currency', v)} />
          </Field>
          <Field label="Fecha"><input type="date" className="field" value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Estado">
            <Select value={form.status} onChange={v => set('status', v)}
              options={[{ value: 'pagado', label: 'Pagado' }, { value: 'pendiente', label: 'Pendiente' }, { value: 'vencido', label: 'Vencido' }]} />
          </Field>
          <Field label="Método">
            <Select value={form.method} onChange={v => set('method', v)} placeholder="—"
              options={[{ value: 'transferencia', label: 'Transferencia' }, { value: 'efectivo', label: 'Efectivo' }, { value: 'tarjeta', label: 'Tarjeta' }, { value: 'otro', label: 'Otro' }]} />
          </Field>
          <Field label="Cliente">
            <Select value={form.client} onChange={v => set('client', v)} placeholder="Sin cliente"
              options={clients.map(c => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Proyecto">
            <Select value={form.project} onChange={v => set('project', v)} placeholder="Sin proyecto"
              options={projects.map(p => ({ value: p.id, label: p.name }))} />
          </Field>
          {form.type === 'ingreso' && <Field label="Vence (si es factura por cobrar)" full><input type="date" className="field" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></Field>}
          <Field label="Notas" full><textarea className="field min-h-[64px]" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Referencia, factura, detalles…" /></Field>
        </div>
        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn-glass" disabled={saving} onClick={save}>Guardar ✦</button>
        </div>
      </Modal>
    </div>
  )
}
