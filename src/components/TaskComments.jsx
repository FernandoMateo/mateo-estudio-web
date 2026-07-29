import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, removeRec, getAuth } from '../lib/api'
import { useToast } from '../context/ToastContext'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'recién'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

export default function TaskComments({ taskId }) {
  const toast = useToast()
  const me = getAuth()?.record
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const load = () => list('task_comments', '&filter=' + encodeURIComponent(`task="${taskId}"`) + '&sort=created&expand=user')
    .then(setComments).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [taskId])

  async function send() {
    if (!text.trim()) return
    if (!me?.id) { toast('Tu sesión expiró — recargá la página e iniciá sesión de nuevo.', true); return }
    setSending(true)
    try {
      await createRec('task_comments', { task: taskId, user: me.id, message: text.trim() })
      setText(''); load()
    } catch { toast('No se pudo enviar el comentario.', true) } finally { setSending(false) }
  }

  async function del(c) {
    if (!confirm('¿Eliminar este comentario?')) return
    try { await removeRec('task_comments', c.id); load() } catch { toast('No se pudo eliminar.', true) }
  }

  return (
    <div>
      {loading ? (
        <p className="text-[12px] text-white/35">Cargando comentarios…</p>
      ) : !comments.length ? (
        <p className="text-[12px] text-white/35 mb-3">Todavía no hay comentarios en esta tarea.</p>
      ) : (
        <div className="flex flex-col gap-2.5 mb-3 max-h-[220px] overflow-y-auto pr-1">
          {comments.map(c => {
            const mine = c.user === me?.id
            const who = c.expand?.user?.name || c.expand?.user?.email || 'Alguien'
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11.5px] font-bold text-violet-light">{who}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-white/30">{timeAgo(c.created)}</span>
                    {(mine || me?.role === 'admin') && (
                      <button onClick={() => del(c)} className="text-white/25 hover:text-coral transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[12.5px] text-white/75 whitespace-pre-line break-words">{c.message}</p>
              </motion.div>
            )
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input className="field flex-1" placeholder="Escribí un comentario…" value={text}
          onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={sending || !text.trim()} className="btn-glass !px-3.5 disabled:opacity-40">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </div>
    </div>
  )
}
