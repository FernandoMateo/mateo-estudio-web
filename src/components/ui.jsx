import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PILL } from '../lib/constants'
import { fmtARS, fmtUSD } from '../lib/api'
import { useFx, usdToArs } from '../context/FxContext'

const spring = { type: 'spring', stiffness: 340, damping: 28 }

/* ── Pill de estado con glow sutil ── */
export const Pill = ({ value }) => (
  <span className={`pill ${PILL[value] || PILL.pendiente} shadow-[0_0_10px_-2px_currentColor]`}>{(value || '').replace('_', ' ')}</span>
)

/* ── Modal: vidrio profundo + borde animado con gradiente ── */
export function Modal({ open, onClose, children, wide }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'radial-gradient(circle at 50% 30%, rgba(20,10,40,.55), rgba(2,2,5,.86))', backdropFilter: 'blur(6px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30, rotateX: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 14 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            style={{ perspective: 1000 }}
            className={`relative w-full ${wide ? 'max-w-xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto rounded-[22px] p-[1px]`}
          >
            <div className="absolute inset-0 rounded-[22px] opacity-70" style={{ background: 'linear-gradient(135deg,#7C3AED,#F472F0 45%,#5EEAD4 75%,#7C3AED)', filter: 'blur(.5px)' }} />
            <div className="relative rounded-[21px] bg-[#0A0A10]/[.97] p-6"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 40px 100px rgba(0,0,0,.7)' }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const ModalHead = ({ title, onClose }) => (
  <div className="flex items-center justify-between mb-5">
    <h3 className="text-[16px] font-bold tracking-tight">{title}</h3>
    <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.85 }} onClick={onClose}
      className="text-white/35 hover:text-white p-1.5 rounded-lg hover:bg-white/[.06] transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </motion.button>
  </div>
)

/* ── Stepper: núcleo neón con anillo pulsante ── */
export function Stepper({ steps, current }) {
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0
  return (
    <div className="relative flex justify-between mx-1.5 mb-8">
      <div className="absolute top-[14px] left-[24px] right-[24px] h-[2px] bg-white/[.07] rounded overflow-hidden">
        <motion.div
          className="h-full rounded bg-gradient-to-r from-violet-dark via-violet-light to-neon-pink"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          style={{ boxShadow: '0 0 14px rgba(139,92,246,.8)' }}
        />
      </div>
      {steps.map((label, i) => {
        const active = i === current, done = i < current
        return (
          <div key={label} className="relative z-10 flex flex-col items-center gap-1.5 w-16">
            {active && (
              <motion.span
                className="absolute -top-1 w-9 h-9 rounded-full border border-violet-light/50"
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <motion.div
              animate={active ? { scale: 1.2 } : { scale: 1 }}
              transition={spring}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors
                ${active ? 'border-transparent text-white bg-gradient-to-br from-violet-light to-neon-pink shadow-[0_0_18px_rgba(139,92,246,.75)]'
                : done ? 'border-violet/50 text-violet-light bg-violet/[.18]'
                : 'border-white/10 text-white/30 bg-white/[.02]'}`}
            >{done ? '✓' : i + 1}</motion.div>
            <span className={`text-[9px] uppercase font-bold tracking-wider text-center transition-colors
              ${active ? 'text-violet-light' : done ? 'text-white/45' : 'text-white/25'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function StepPanel({ stepKey, direction, children }) {
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: direction >= 0 ? 50 : -50, filter: 'blur(4px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: direction >= 0 ? -30 : 30, filter: 'blur(4px)' }}
        transition={{ duration: 0.32, ease: [0.2, 0.9, 0.25, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export const Field = ({ label, children, full }) => (
  <div className={full ? 'col-span-2 max-[520px]:col-span-1' : 'max-[520px]:col-span-1'}>
    <label className="field-label">{label}</label>
    {children}
  </div>
)

/* ── Fila de lista: lift + glow lateral en hover ── */
export function Row({ icon, title, meta, right, children }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, borderColor: 'rgba(167,139,250,.4)' }}
      className="group relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 flex-wrap sm:flex-nowrap overflow-hidden transition-shadow"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-light to-neon-pink opacity-0 group-hover:opacity-100 transition-opacity" />
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{title}</div>
        {meta && <div className="text-[11.5px] text-white/35 truncate mt-0.5">{meta}</div>}
      </div>
      {right}
      {children}
    </motion.div>
  )
}

export const IconBtn = ({ onClick, danger, title, children }) => (
  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClick} title={title}
    className={`w-8 h-8 rounded-lg flex items-center justify-center text-white/35 border border-transparent transition-colors
      ${danger ? 'hover:text-coral hover:bg-coral/10 hover:border-coral/30 hover:shadow-[0_0_12px_rgba(251,113,133,.35)]'
      : 'hover:text-violet-light hover:bg-violet/10 hover:border-violet/30 hover:shadow-[0_0_12px_rgba(139,92,246,.35)]'}`}>
    {children}
  </motion.button>
)

export const EditIcon = () => <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 20l4-1L20 7.5a2 2 0 0 0-3-3L5 16z"/></svg>
export const TrashIcon = () => <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
export const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>

/* ── Encabezado de módulo ── */
export function ModuleHead({ title, count, search, onSearch, onNew, newLabel }) {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <h2 className="text-[19px] font-extrabold tracking-tight">{title}</h2>
      <span className="text-[11px] font-bold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2.5 py-0.5 shadow-[0_0_10px_-3px_rgba(139,92,246,.8)]">{count}</span>
      <div className="flex-1" />
      <div className="flex items-center gap-2 bg-white/[.035] border border-white/[.08] rounded-xl px-3.5 py-2.5 min-w-[180px] focus-within:border-violet-light/50 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,.12)] transition-all">
        <svg className="w-3.5 h-3.5 text-white/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Buscar…" className="bg-transparent outline-none text-[13px] w-full placeholder:text-white/25" />
      </div>
      {onNew && (
        <motion.button whileTap={{ scale: 0.96 }} className="btn-glass" onClick={onNew}><PlusIcon />{newLabel}</motion.button>
      )}
    </div>
  )
}

/* ── Estado vacío con orbe plasma ── */
export const EmptyState = ({ title, text }) => (
  <div className="card flex flex-col items-center justify-center text-center py-20 gap-4">
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-full animate-pulse-neon" style={{ background: 'radial-gradient(circle at 35% 30%, rgba(244,114,240,.5), rgba(139,92,246,.2) 60%, transparent)', filter: 'blur(2px)' }} />
      <div className="absolute inset-2 rounded-full border border-violet-light/40" />
    </div>
    <h2 className="text-[18px] font-bold">{title}</h2>
    <p className="text-[13px] text-white/45 max-w-sm">{text}</p>
  </div>
)

/* ── Tabs de filtro: pill magnética con layoutId ── */
export function FilterTabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1.5 mb-5 flex-wrap">
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`relative text-xs font-bold px-4 py-2 rounded-full transition-colors z-0
            ${value === key ? 'text-white' : 'text-white/45 hover:text-white/80'}`}>
          {value === key && (
            <motion.span layoutId="tab-pill" transition={spring}
              className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-violet-dark to-violet-light shadow-[0_0_18px_rgba(139,92,246,.55)]" />
          )}
          {label}
        </button>
      ))}
    </div>
  )
}

/* ── Select personalizado: mismo vidrio que los campos, dropdown animado ── */
export function Select({ value, onChange, options, placeholder = 'Selecciona…' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = options.find(o => String(o.value) === String(value))

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`field flex items-center justify-between gap-2 text-left cursor-pointer select-none
          ${open ? 'border-violet-light/70 shadow-[0_0_0_4px_rgba(139,92,246,.14),0_0_18px_rgba(139,92,246,.18)] bg-white/[.05]' : ''}`}>
        <span className={`truncate ${current ? '' : 'text-white/30'}`}>{current ? current.label : placeholder}</span>
        <motion.svg animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}
          className="w-3 h-3 text-violet-light flex-shrink-0" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.2, 0.9, 0.25, 1] }}
            className="absolute z-30 mt-2 w-full max-h-56 overflow-y-auto rounded-xl p-1.5"
            style={{
              background: 'rgba(12,12,18,.98)',
              border: '1px solid rgba(139,92,246,.3)',
              boxShadow: '0 16px 40px rgba(0,0,0,.6), 0 0 24px rgba(139,92,246,.18)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {!options.length && <div className="px-3 py-2.5 text-[12.5px] text-white/30">Sin opciones</div>}
            {options.map(o => {
              const sel = String(o.value) === String(value)
              return (
                <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] flex items-center justify-between gap-2 transition-colors
                    ${sel ? 'text-white bg-violet/[.22]' : 'text-white/65 hover:bg-white/[.06] hover:text-white'}`}>
                  {o.label}
                  {sel && <svg className="w-3.5 h-3.5 text-violet-light flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 13l4 4 10-11"/></svg>}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Campo de monto dual-moneda (ARS/USD) con conversión en vivo ── */
export function MoneyField({ amount, currency, onAmount, onCurrency, placeholder }) {
  const { rates } = useFx()
  const rate = usdToArs(rates)
  const isUsd = currency === 'USD'
  const preview = isUsd && rate && amount ? Number(amount) * rate : null
  return (
    <div>
      <div className="flex gap-2">
        <input type="number" min="0" step="0.01" className="field flex-1" value={amount}
          onChange={e => onAmount(e.target.value)} placeholder={placeholder || '0.00'} />
        <div className="w-[104px] flex-shrink-0">
          <Select value={currency || 'ARS'} onChange={onCurrency}
            options={[{ value: 'ARS', label: 'ARS $' }, { value: 'USD', label: 'USD US$' }]} />
        </div>
      </div>
      {isUsd && (
        <p className="text-[11px] text-white/35 mt-1.5 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-violet-light/60 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 10h10M7 14h6"/><circle cx="12" cy="12" r="9"/></svg>
          {preview != null
            ? <>≈ {fmtARS(preview)} ARS <span className="text-white/20">· cotización de hoy{rates?.live === false ? ' (referencia)' : ''}</span></>
            : 'Obteniendo cotización…'}
        </p>
      )}
    </div>
  )
}

/* ── Muestra un monto guardado, con su conversión congelada al momento del registro ── */
export function MoneyDisplay({ amount, currency, amountArs, className }) {
  if (currency === 'USD') {
    return (
      <span className={className}>
        {fmtUSD(amount)}
        {amountArs != null && <span className="block text-[10px] text-white/30 font-normal mt-0.5">≈ {fmtARS(amountArs)} ARS al registrarse</span>}
      </span>
    )
  }
  return <span className={className}>{fmtARS(amount)}</span>
}
