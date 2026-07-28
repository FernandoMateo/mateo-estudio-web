import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list } from '../lib/api'
import { FilterTabs, EmptyState } from '../components/ui'

const ACTION_META = {
  crear: { icon: '+', color: '#34D399', bg: 'rgba(52,211,153,.12)', label: 'creó' },
  actualizar: { icon: '✎', color: '#A78BFA', bg: 'rgba(139,92,246,.12)', label: 'actualizó' },
  eliminar: { icon: '×', color: '#FB7185', bg: 'rgba(251,113,133,.12)', label: 'eliminó' },
}
const ENTITY_LABELS = { cliente: 'un cliente', proyecto: 'un proyecto', cotización: 'una cotización', transacción: 'una transacción', usuario: 'una cuenta', invitación: 'una invitación' }
const TABS = [['todas', 'Todas'], ['crear', 'Creaciones'], ['actualizar', 'Cambios'], ['eliminar', 'Eliminaciones']]

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'recién'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`
  return new Date(dateStr).toLocaleDateString('es-AR')
}

export default function Historial() {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('todas')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    list('activity_log', '&sort=-created&expand=user').then(setLogs).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = logs.filter(l => filter === 'todas' || l.action === filter)

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h2 className="text-[19px] font-extrabold tracking-tight">Historial de cambios</h2>
        <span className="text-[11px] font-semibold text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2.5 py-0.5">{logs.length}</span>
      </div>
      <FilterTabs tabs={TABS} value={filter} onChange={setFilter} />

      {loading ? (
        <p className="text-[12.5px] text-white/35">Cargando…</p>
      ) : !logs.length ? (
        <EmptyState title="Todavía no hay actividad registrada" text="A medida que vos o tu equipo creen, editen o eliminen cosas, va a quedar acá quién hizo qué y cuándo." />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Sin resultados para este filtro.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((l, i) => {
            const meta = ACTION_META[l.action] || ACTION_META.actualizar
            const who = l.expand?.user?.name || l.expand?.user?.email || 'Alguien'
            return (
              <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.012))', border: '1px solid rgba(255,255,255,.06)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] font-bold flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0 text-[12.5px]">
                  <span className="font-semibold">{who}</span> <span className="text-white/45">{meta.label} {ENTITY_LABELS[l.entity] || l.entity}</span>
                  {l.entity_name && <span className="font-semibold"> "{l.entity_name}"</span>}
                  {l.summary && <span className="text-white/35"> — {l.summary}</span>}
                </div>
                <span className="text-[10.5px] text-white/30 flex-shrink-0">{timeAgo(l.created)}</span>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
