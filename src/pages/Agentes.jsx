import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, updateRec, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { ModuleHead, EmptyState } from '../components/ui'

// Toto y Fabian son el núcleo del sistema — siempre activos, no se pausan desde acá.
const CORE = new Set(['toto', 'fabian'])

const STATUS_DOT = {
  ok: 'bg-mint shadow-[0_0_8px_rgba(52,211,153,.7)]',
  corriendo: 'bg-violet-light shadow-[0_0_8px_rgba(167,139,250,.7)]',
  error: 'bg-coral shadow-[0_0_8px_rgba(248,113,113,.7)]',
  inactivo: 'bg-white/25',
}

function timeAgo(dateStr) {
  if (!dateStr) return 'todavía no corrió'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export default function Agentes() {
  const toast = useToast()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = () => list('agents', '&sort=created')
    .then(setAgents)
    .catch(() => { /* la colección puede no estar importada todavía */ })
    .finally(() => setLoading(false))

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  async function toggle(agent) {
    setBusy(agent.id)
    try {
      await updateRec('agents', agent.id, { enabled: !agent.enabled })
      logActivity({ action: agent.enabled ? 'pausar' : 'reanudar', entity: 'agente', entity_name: agent.display_name })
      toast(agent.enabled ? `⏸️ ${agent.display_name} pausado` : `▶️ ${agent.display_name} reanudado`)
      setAgents(list => list.map(a => a.id === agent.id ? { ...a, enabled: !agent.enabled } : a))
    } catch {
      toast('No se pudo actualizar el agente.', true)
    } finally { setBusy(null) }
  }

  return (
    <div>
      <ModuleHead title="Agentes" count={agents.length ? `${agents.length} agentes trabajando para vos` : 'Tu equipo de IA'} />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[158px] rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,.035)' }} />
          ))}
        </div>
      ) : !agents.length ? (
        <EmptyState title="Todavía no hay agentes registrados" text='Aparecen acá solos apenas el servicio de agentes arranca con la colección "agents" ya importada en PocketBase (pb-schema-agents.json).' />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((a, i) => {
            const core = CORE.has(a.name)
            const dotKey = core ? 'ok' : (a.status || 'inactivo')
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="card !p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-[12px] flex-shrink-0 flex items-center justify-center text-[19px] bg-violet/[.14] border border-violet-light/30">
                      {a.icon || '🤖'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-bold truncate">{a.display_name}</div>
                      <div className="text-[11px] text-white/35 truncate">{a.schedule_label}</div>
                    </div>
                  </div>
                  {core ? (
                    <span className="text-[10px] font-semibold text-mint bg-mint/10 border border-mint/30 rounded-full px-2.5 py-1 flex-shrink-0">Núcleo</span>
                  ) : (
                    <motion.button whileTap={{ scale: 0.92 }} disabled={busy === a.id} onClick={() => toggle(a)}
                      title={a.enabled ? 'Pausar' : 'Reanudar'}
                      className={`relative w-[38px] h-[21px] rounded-full flex-shrink-0 transition-colors ${a.enabled ? 'bg-gradient-to-r from-violet-dark to-violet-light' : 'bg-white/10'}`}>
                      <motion.span animate={{ x: a.enabled ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-[2px] w-[17px] h-[17px] rounded-full bg-white shadow" />
                    </motion.button>
                  )}
                </div>

                <p className="text-[12px] text-white/50 leading-snug">{a.role}</p>

                <div className="flex items-center gap-2 mt-auto pt-2.5 border-t border-white/[.06]">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[dotKey] || STATUS_DOT.inactivo}`} />
                  <span className="text-[11px] text-white/40 truncate">{core ? 'siempre activo' : (a.enabled ? timeAgo(a.last_run) : 'pausado')}</span>
                </div>
                {a.last_message && <p className="text-[11px] text-white/30 italic truncate" title={a.last_message}>"{a.last_message}"</p>}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
