import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { list, updateRec, removeRec, getAuth } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { FilterTabs, EmptyState } from './ui'

const TYPE_META = {
  info: { icon: 'ℹ️', color: '#60A5FA', bg: 'rgba(96,165,250,.12)', border: 'rgba(96,165,250,.3)' },
  tarea: { icon: '✓', color: '#A78BFA', bg: 'rgba(139,92,246,.12)', border: 'rgba(139,92,246,.3)' },
  proyecto: { icon: '📁', color: '#A78BFA', bg: 'rgba(139,92,246,.12)', border: 'rgba(139,92,246,.3)' },
  pago: { icon: '💰', color: '#34D399', bg: 'rgba(52,211,153,.12)', border: 'rgba(52,211,153,.3)' },
  alerta: { icon: '⚠️', color: '#FB7185', bg: 'rgba(251,113,133,.12)', border: 'rgba(251,113,133,.3)' },
}
const TABS = [['todas', 'Todas'], ['no_leidas', 'No leídas']]

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'recién'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`
  return new Date(dateStr).toLocaleDateString('es-AR')
}

export default function NotificationsList({ onCountChange }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('todas')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    const me = getAuth()?.record
    const userFilter = me ? '&filter=' + encodeURIComponent(`user="${me.id}"`) : ''
    list('notifications', '&sort=-created' + userFilter)
      .then(data => { setItems(data); onCountChange?.(data.filter(n => !n.read).length) })
      .catch(() => toast('No se pudieron cargar las notificaciones.', true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = items.filter(n => filter === 'todas' || !n.read)
  const unreadCount = items.filter(n => !n.read).length

  async function markRead(n) {
    if (n.read) return
    setItems(list => list.map(x => x.id === n.id ? { ...x, read: true } : x))
    onCountChange?.(Math.max(0, unreadCount - 1))
    try { await updateRec('notifications', n.id, { read: true }) } catch {}
  }

  async function markAllRead() {
    const unread = items.filter(n => !n.read)
    if (!unread.length) return
    setItems(list => list.map(x => ({ ...x, read: true })))
    onCountChange?.(0)
    try { await Promise.all(unread.map(n => updateRec('notifications', n.id, { read: true }))) }
    catch { toast('Algunas no se pudieron marcar como leídas.', true) }
  }

  async function del(n) {
    try {
      setItems(list => list.filter(x => x.id !== n.id))
      if (!n.read) onCountChange?.(Math.max(0, unreadCount - 1))
      await removeRec('notifications', n.id)
    } catch { toast('No se pudo eliminar.', true); load() }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterTabs tabs={TABS} value={filter} onChange={setFilter} />
        <div className="flex-1" />
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-ghost !py-2 !px-3 text-[12px] mb-4">
            Marcar todas como leídas
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[12.5px] text-white/35 px-1">Cargando…</p>
      ) : !items.length ? (
        <EmptyState title="Sin notificaciones" text="Cuando pase algo importante — una solicitud, una cotización nueva, un cliente que se une — te vamos a avisar acá." />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">No tenés notificaciones sin leer. 🎉</p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {filtered.map(n => {
              const meta = TYPE_META[n.type] || TYPE_META.info
              return (
                <motion.div key={n.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  onClick={() => markRead(n)}
                  className={`group relative flex items-start gap-3 rounded-2xl px-4 py-3.5 cursor-pointer transition-colors overflow-hidden
                    ${n.read ? 'opacity-55' : ''}`}
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}>
                  {!n.read && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: meta.color }} />}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13.5px] truncate ${n.read ? 'font-medium' : 'font-bold'}`}>{n.title}</div>
                    {n.message && <div className="text-[12px] text-white/45 mt-0.5 line-clamp-2">{n.message}</div>}
                    <div className="text-[10.5px] text-white/30 mt-1">{timeAgo(n.created)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />}
                    <button onClick={e => { e.stopPropagation(); del(n) }} title="Eliminar"
                      className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-coral transition-all p-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
