import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, removeRec, getAuth, notifyUser } from '../lib/api'
import { useToast } from '../context/ToastContext'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'recién'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

/** Comentarios internos del equipo sobre una publicación — con @menciones opcionales. */
export default function PostComments({ postId, team = [], postTitle }) {
  const toast = useToast()
  const me = getAuth()?.record
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [sending, setSending] = useState(false)

  const load = () => list('post_comments', '&filter=' + encodeURIComponent(`post="${postId}"`) + '&sort=created&expand=user')
    .then(setComments).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [postId])

  function insertMention(u) {
    setText(t => t.replace(/@$/, '') + `@${u.name || u.email} `)
    setShowMentions(false)
  }

  async function send() {
    if (!text.trim() || !me?.id) return
    setSending(true)
    try {
      const mentioned = team.filter(u => text.includes(`@${u.name}`) || text.includes(`@${u.email}`))
      await createRec('post_comments', { post: postId, user: me.id, message: text.trim(), mentions: mentioned.map(u => u.id) })
      await Promise.all(mentioned.filter(u => u.id !== me.id).map(u =>
        notifyUser(u.id, { title: `${me.name || 'Alguien'} te mencionó`, message: postTitle ? `En "${postTitle}"` : text.trim(), type: 'info' })
      ))
      setText(''); load()
    } catch { toast('No se pudo enviar el comentario.', true) } finally { setSending(false) }
  }

  async function del(c) {
    if (!confirm('¿Eliminar este comentario?')) return
    try { await removeRec('post_comments', c.id); load() } catch { toast('No se pudo eliminar.', true) }
  }

  return (
    <div>
      {loading ? (
        <p className="text-[12px] text-white/35">Cargando comentarios…</p>
      ) : !comments.length ? (
        <p className="text-[12px] text-white/35 mb-3">Sin comentarios todavía — usá esto para coordinar con el equipo.</p>
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
                    {mine && (
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
      <div className="relative">
        {showMentions && !!team.length && (
          <div className="absolute bottom-full mb-1.5 left-0 right-0 rounded-xl p-1.5 max-h-[140px] overflow-y-auto z-10"
            style={{ background: 'rgba(12,12,18,.98)', border: '1px solid rgba(139,92,246,.3)', boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
            {team.map(u => (
              <button key={u.id} onClick={() => insertMention(u)} className="w-full text-left px-3 py-2 rounded-lg text-[12.5px] text-white/70 hover:bg-white/[.06] hover:text-white transition-colors">
                {u.name || u.email}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input className="field flex-1" placeholder="Escribí un comentario… (@ para mencionar)" value={text}
            onChange={e => { setText(e.target.value); setShowMentions(e.target.value.endsWith('@')) }}
            onKeyDown={e => e.key === 'Enter' && send()} />
          <button onClick={send} disabled={sending || !text.trim()} className="btn-glass !px-3.5 disabled:opacity-40">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
