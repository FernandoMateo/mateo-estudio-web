import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { list, createRec, updateRec, removeRec, fileUrl, logActivity, notifyTeam } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Field } from './ui'

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const STATUS_META = {
  borrador: { label: 'Borrador', color: '#94A3B8', bg: 'rgba(148,163,184,.12)' },
  enviado: { label: 'Esperando aprobación', color: '#FBBF24', bg: 'rgba(251,191,36,.12)' },
  aprobado: { label: 'Aprobado', color: '#34D399', bg: 'rgba(52,211,153,.12)' },
  rechazado: { label: 'Rechazado — a revisar', color: '#FB7185', bg: 'rgba(251,113,133,.12)' },
}

function dateForDay(startDate, dayIndex) {
  if (!startDate) return null
  const d = new Date(startDate.slice(0, 10) + 'T00:00:00')
  d.setDate(d.getDate() + dayIndex)
  return d
}
function fmtShort(d) { return d ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '' }

const emptyPostForm = { title: '', copy: '', hashtags: '' }

/** canManage=true (admin/equipo): crea semanas y publicaciones, las manda a aprobar.
 *  canManage=false (cliente/colaborador): solo aprueba o rechaza lo que ya le enviaron. */
export default function ContentPlanner({ projectId, clientId, canManage }) {
  const toast = useToast()
  const [plans, setPlans] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState({ name: '', start_date: '' })
  const [planSaving, setPlanSaving] = useState(false)

  const [postModal, setPostModal] = useState(null) // { planId, dayIndex, post }
  const [postForm, setPostForm] = useState(emptyPostForm)
  const [postImage, setPostImage] = useState(null)
  const [postImagePreview, setPostImagePreview] = useState('')
  const [postSaving, setPostSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const fileInputRef = useRef(null)

  const load = () => {
    setLoading(true)
    list('content_plans', '&filter=' + encodeURIComponent(`project="${projectId}"`) + '&sort=-start_date&expand=client')
      .then(async ps => {
        setPlans(ps)
        if (!ps.length) { setPosts([]); return }
        const all = await list('content_posts', '&filter=' + encodeURIComponent(`plan.project="${projectId}"`))
        setPosts(all)
      })
      .catch(() => toast('No se pudo cargar el planificador.', true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [projectId])

  function openNewPlan() { setPlanForm({ name: '', start_date: '' }); setPlanOpen(true) }
  async function savePlan() {
    if (!planForm.name.trim() || !planForm.start_date) { toast('Ponele un nombre y elegí el primer día de la semana.', true); return }
    if (!clientId) { toast('No se pudo identificar el cliente de este proyecto — revisá que el proyecto tenga un cliente asignado.', true); return }
    setPlanSaving(true)
    try {
      await createRec('content_plans', { project: projectId, client: clientId, name: planForm.name.trim(), start_date: planForm.start_date + ' 00:00:00' })
      logActivity({ action: 'crear', entity: 'planificación', entity_name: planForm.name.trim() })
      setPlanOpen(false); toast('✦ Semana creada'); load()
    } catch (e) {
      const fieldErrors = e?.data?.data
      const firstMsg = fieldErrors && Object.values(fieldErrors)[0]?.message
      console.error('[Planificador] Error al crear la semana:', e?.data || e)
      toast(firstMsg ? `No se pudo crear: ${firstMsg}` : 'No se pudo crear la semana.', true)
    } finally { setPlanSaving(false) }
  }
  async function delPlan(plan) {
    if (!confirm(`¿Eliminar "${plan.name}" y todas sus publicaciones?`)) return
    try {
      const its = posts.filter(p => p.plan === plan.id)
      await Promise.all(its.map(p => removeRec('content_posts', p.id)))
      await removeRec('content_plans', plan.id)
      toast('Semana eliminada ✓'); load()
    } catch { toast('No se pudo eliminar.', true) }
  }

  function openDay(planId, dayIndex, post) {
    setRejecting(false); setRejectReason('')
    setPostImage(null); setPostImagePreview(post?.image ? fileUrl('content_posts', post.id, post.image) : '')
    setPostForm(post ? { title: post.title || '', copy: post.copy || '', hashtags: post.hashtags || '' } : emptyPostForm)
    setPostModal({ planId, dayIndex, post: post || null })
  }
  function pickImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setPostImage(f); setPostImagePreview(URL.createObjectURL(f))
  }

  async function savePost(sendForApproval) {
    if (!postForm.title.trim()) { toast('Ponele un título a la publicación.', true); return }
    setPostSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', postForm.title.trim()); fd.append('copy', postForm.copy.trim()); fd.append('hashtags', postForm.hashtags.trim())
      if (postImage) fd.append('image', postImage)
      if (sendForApproval) fd.append('status', 'enviado')
      let saved
      if (postModal.post) {
        saved = await updateRec('content_posts', postModal.post.id, fd, true)
      } else {
        fd.append('plan', postModal.planId); fd.append('day_index', postModal.dayIndex)
        if (!sendForApproval) fd.append('status', 'borrador')
        saved = await createRec('content_posts', fd, true)
      }
      if (sendForApproval) {
        logActivity({ action: 'actualizar', entity: 'publicación', entity_name: postForm.title.trim(), summary: 'enviada para aprobación' })
        notifyTeam({ title: 'Publicación enviada a aprobación', message: postForm.title.trim(), type: 'info' })
      }
      toast(sendForApproval ? '✦ Enviada para aprobación' : 'Guardado ✓')
      setPostModal(null); load()
    } catch (e) {
      const fieldErrors = e?.data?.data
      const firstMsg = fieldErrors && Object.values(fieldErrors)[0]?.message
      console.error('[Planificador] Error al guardar la publicación:', e?.data || e)
      toast(firstMsg ? `No se pudo guardar: ${firstMsg}` : 'No se pudo guardar la publicación.', true)
    } finally { setPostSaving(false) }
  }

  async function delPost() {
    if (!postModal?.post) return
    if (!confirm('¿Eliminar esta publicación?')) return
    try { await removeRec('content_posts', postModal.post.id); toast('Eliminada ✓'); setPostModal(null); load() }
    catch { toast('No se pudo eliminar.', true) }
  }

  async function decide(status) {
    if (!postModal?.post) return
    if (status === 'rechazado' && !rejectReason.trim()) { toast('Contanos por qué la rechazás.', true); return }
    setPostSaving(true)
    try {
      await updateRec('content_posts', postModal.post.id, { status, rejection_reason: status === 'rechazado' ? rejectReason.trim() : '' })
      notifyTeam({
        title: `Publicación ${status === 'aprobado' ? 'aprobada' : 'rechazada'}`,
        message: status === 'rechazado' ? `Motivo: ${rejectReason.trim()}` : postModal.post.title, type: 'info',
      })
      logActivity({ action: 'actualizar', entity: 'publicación', entity_name: postModal.post.title, summary: status === 'aprobado' ? 'el cliente la aprobó' : `rechazada: ${rejectReason.trim()}` })
      toast(status === 'aprobado' ? '✓ Publicación aprobada' : 'Publicación rechazada'); setPostModal(null); load()
    } catch { toast('No se pudo registrar tu decisión.', true) } finally { setPostSaving(false) }
  }

  const postsByPlanDay = (planId, day) => posts.find(p => p.plan === planId && p.day_index === day)

  if (loading) return <p className="text-[12.5px] text-white/35">Cargando planificador…</p>

  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-4">
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" onClick={openNewPlan}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nueva semana
          </motion.button>
        </div>
      )}

      {!plans.length ? (
        <div className="card text-center py-14">
          <p className="text-[14px] font-semibold">Todavía no hay semanas planificadas</p>
          <p className="text-[12.5px] text-white/40 mt-1.5">{canManage ? 'Creá la primera con "Nueva semana".' : 'Tu equipo de Mateo Estudio todavía no armó el contenido de esta semana.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {plans.map(plan => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card !p-4">
              <div className="flex items-center justify-between gap-2 mb-3.5">
                <div>
                  <div className="text-[14px] font-bold">{plan.name}</div>
                  <div className="text-[11px] text-white/35 mt-0.5">
                    {fmtShort(dateForDay(plan.start_date, 0))} – {fmtShort(dateForDay(plan.start_date, 6))}
                  </div>
                </div>
                {canManage && (
                  <button onClick={() => delPlan(plan)} className="text-white/25 hover:text-coral transition-colors p-1.5 flex-shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                  </button>
                )}
              </div>

              {canManage && !plan.client && (
                <div className="flex items-center gap-2 mb-3.5 px-3 py-2 rounded-lg text-[11.5px] text-[#FCA5A5]" style={{ background: 'rgba(251,113,133,.08)', border: '1px solid rgba(251,113,133,.3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
                  Esta semana no tiene cliente vinculado — el cliente no la va a ver en su Portal. Borrala y creá una nueva.
                </div>
              )}

              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                {DAY_LABELS.map((label, i) => {
                  const post = postsByPlanDay(plan.id, i)
                  const meta = post ? STATUS_META[post.status || 'borrador'] : null
                  const d = dateForDay(plan.start_date, i)
                  return (
                    <button key={i} onClick={() => openDay(plan.id, i, post)} style={{ scrollSnapAlign: 'start' }}
                      className="flex-shrink-0 w-[118px] rounded-2xl overflow-hidden text-left"
                      >
                      <div className="rounded-2xl h-[164px] flex flex-col" style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${post ? meta.color + '55' : 'rgba(255,255,255,.08)'}` }}>
                        <div className="px-2.5 pt-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-white/40">{DAY_SHORT[i]}</div>
                          <div className="text-[10px] text-white/25">{fmtShort(d)}</div>
                        </div>
                        {post ? (
                          <>
                            {post.image ? (
                              <img src={fileUrl('content_posts', post.id, post.image, '200x200')} alt="" className="w-full h-16 object-cover mt-1.5" />
                            ) : (
                              <div className="w-full h-16 mt-1.5 flex items-center justify-center bg-white/[.03]">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" /><path d="m21 15-5-5L5 21" /></svg>
                              </div>
                            )}
                            <div className="px-2.5 py-1.5 flex-1 flex flex-col justify-between min-h-0">
                              <div className="text-[11px] font-semibold line-clamp-2 leading-snug">{post.title}</div>
                              <span className="text-[8.5px] font-bold uppercase tracking-wide mt-1 px-1.5 py-0.5 rounded self-start" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                            </div>
                          </>
                        ) : canManage ? (
                          <div className="flex-1 flex items-center justify-center text-white/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-[10px] text-white/20 px-2 text-center">Sin contenido</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Modal: nueva semana ── */}
      <Modal open={planOpen} onClose={() => setPlanOpen(false)}>
        <ModalHead title="Nueva semana" onClose={() => setPlanOpen(false)} />
        <p className="text-[12px] text-white/35 -mt-2 mb-4">Elegí el lunes (o el primer día que uses) — a partir de esa fecha se arman los 7 días.</p>
        <div className="flex flex-col gap-3">
          <Field label="Nombre *"><input className="field" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Semana del 4 al 10 de agosto" /></Field>
          <Field label="Primer día *"><input type="date" className="field" value={planForm.start_date} onChange={e => setPlanForm(f => ({ ...f, start_date: e.target.value }))} /></Field>
        </div>
        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setPlanOpen(false)}>Cancelar</button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={planSaving} onClick={savePlan}>
            {planSaving ? 'Creando…' : 'Crear semana ✦'}
          </motion.button>
        </div>
      </Modal>

      {/* ── Modal: publicación del día ── */}
      <Modal open={!!postModal} onClose={() => setPostModal(null)} wide>
        {postModal && (() => {
          const post = postModal.post
          const canDecide = !canManage && post && post.status === 'enviado'
          return (
            <>
              <ModalHead title={`${DAY_LABELS[postModal.dayIndex]}${post ? '' : ' — nueva publicación'}`} onClose={() => setPostModal(null)} />

              {canDecide && !rejecting && (
                <div className="flex items-center gap-3 mb-5 justify-center flex-wrap rounded-2xl p-4" style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)' }}>
                  <p className="text-[12.5px] text-white/50 w-full text-center mb-0.5">¿Aprobás esta publicación?</p>
                  <button disabled={postSaving} onClick={() => setRejecting(true)}
                    className="flex-1 max-w-[180px] justify-center flex items-center gap-2 py-3 rounded-xl border text-[13px] font-semibold transition-colors disabled:opacity-50"
                    style={{ background: 'rgba(251,113,133,.08)', borderColor: 'rgba(251,113,133,.3)', color: '#FB7185' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    Rechazar
                  </button>
                  <motion.button whileTap={{ scale: 0.97 }} disabled={postSaving} onClick={() => decide('aprobado')} className="btn-glass flex-1 max-w-[180px] justify-center disabled:opacity-50">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 13l4 4 10-11" /></svg>
                    Aprobar
                  </motion.button>
                </div>
              )}
              {canDecide && rejecting && (
                <div className="mb-5 rounded-2xl p-4" style={{ background: 'rgba(251,113,133,.06)', border: '1px solid rgba(251,113,133,.3)' }}>
                  <p className="text-[13px] font-semibold text-[#FCA5A5] mb-2.5">¿Por qué la rechazás?</p>
                  <textarea autoFocus className="field min-h-[70px]" placeholder="Contanos qué cambiarías…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  <div className="flex justify-end gap-2.5 mt-3">
                    <button className="btn-ghost" onClick={() => setRejecting(false)}>Cancelar</button>
                    <button disabled={postSaving || !rejectReason.trim()} onClick={() => decide('rechazado')}
                      className="px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-40" style={{ background: 'rgba(251,113,133,.16)', border: '1px solid rgba(251,113,133,.4)', color: '#FCA5A5' }}>
                      {postSaving ? 'Enviando…' : 'Confirmar rechazo'}
                    </button>
                  </div>
                </div>
              )}

              {post?.status === 'rechazado' && post.rejection_reason && (
                <div className="mb-4 px-3.5 py-2.5 rounded-lg text-[12.5px] text-[#FCA5A5]" style={{ background: 'rgba(251,113,133,.08)', border: '1px solid rgba(251,113,133,.3)' }}>
                  <span className="font-semibold">Motivo del rechazo:</span> {post.rejection_reason}
                </div>
              )}
              {post?.status && post.status !== 'borrador' && (
                <div className="mb-4">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ color: STATUS_META[post.status].color, background: STATUS_META[post.status].bg }}>
                    {STATUS_META[post.status].label}
                  </span>
                </div>
              )}

              {canManage ? (
                <div className="flex flex-col gap-3">
                  <Field label="Título *"><input className="field" value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value }))} placeholder="Título interno del post" /></Field>
                  <Field label="Copy"><textarea className="field min-h-[90px]" value={postForm.copy} onChange={e => setPostForm(f => ({ ...f, copy: e.target.value }))} placeholder="Texto de la publicación…" /></Field>
                  <Field label="Hashtags"><input className="field" value={postForm.hashtags} onChange={e => setPostForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#marca #diseño #contenido" /></Field>
                  <Field label="Imagen">
                    <label className="flex items-center gap-3 border-[1.5px] border-dashed border-violet-light/30 rounded-xl p-3 cursor-pointer hover:border-violet-light/60 hover:bg-violet/5 transition">
                      {postImagePreview ? (
                        <img src={postImagePreview} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-violet/[.1] flex items-center justify-center flex-shrink-0">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-violet-light"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" /><path d="m21 15-5-5L5 21" /></svg>
                        </div>
                      )}
                      <span className="text-[12.5px] text-white/55">{postImage ? postImage.name : 'Subí la imagen del post'}</span>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
                    </label>
                  </Field>
                  <div className="flex justify-between items-center gap-2.5 mt-2 flex-wrap">
                    {post ? <button onClick={delPost} className="text-[12px] text-coral/80 hover:text-coral transition-colors">Eliminar publicación</button> : <span />}
                    <div className="flex gap-2.5 ml-auto">
                      <button className="btn-ghost" disabled={postSaving} onClick={() => savePost(false)}>Guardar borrador</button>
                      <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={postSaving} onClick={() => savePost(true)}>
                        {postSaving ? 'Enviando…' : 'Enviar para aprobación ✦'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {postImagePreview && <img src={postImagePreview} alt="" className="w-full rounded-xl object-cover mb-4 max-h-[280px]" />}
                  <div className="text-[15px] font-bold mb-2">{post?.title}</div>
                  {post?.copy && <p className="text-[13px] text-white/60 whitespace-pre-line leading-relaxed mb-3">{post.copy}</p>}
                  {post?.hashtags && <p className="text-[12.5px] text-violet-light">{post.hashtags}</p>}
                </div>
              )}
            </>
          )
        })()}
      </Modal>
    </div>
  )
}
