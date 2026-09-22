import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { fmtByCurrency } from '../lib/api'
import { Modal } from './ui'

const TONE_LABEL = { cercano: 'Cercano', formal: 'Formal', premium: 'Premium' }

function useParsedProposal(proposal) {
  return useMemo(() => {
    if (!proposal?.generated_json) return null
    try { return JSON.parse(proposal.generated_json) } catch { return null }
  }, [proposal?.generated_json])
}

/** Muestra una propuesta comercial generada por IA con una estética "de otro mundo":
 *  hero con aurora animada, secciones en vidrio con entrada escalonada, servicios como
 *  tarjetas con brillo, timeline vertical y cierre con llamado a la acción. */
export default function ProposalViewer({ open, onClose, proposal }) {
  const data = useParsedProposal(proposal)
  if (!proposal) return null

  const recipient = proposal.expand?.client?.name || proposal.recipient_name || 'tu cliente'
  const company = proposal.expand?.client?.company || proposal.recipient_company || ''

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-bold">Propuesta — {proposal.title}</h3>
        <button onClick={onClose} className="text-white/35 hover:text-white p-1.5 rounded-lg hover:bg-white/[.06]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {proposal.status !== 'listo' && (
        <div className="card flex flex-col items-center text-center py-14 gap-3">
          <motion.div className="w-12 h-12 rounded-full border-2 border-violet-light/30 border-t-violet-light"
            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
          <p className="text-[13px] text-white/50">
            {proposal.status === 'error' ? (proposal.error_message || 'Hubo un error generando esta propuesta.') : 'Todavía se está redactando…'}
          </p>
        </div>
      )}

      {proposal.status === 'listo' && !data && (
        <div className="card py-14 text-center text-[13px] text-white/40">No se pudo leer el contenido generado.</div>
      )}

      {proposal.status === 'listo' && data && (
        <div className="rounded-[26px] overflow-hidden relative" style={{ background: '#0A0A10' }}>
          {/* ── Hero: aurora animada + headline ── */}
          <div className="relative overflow-hidden px-7 py-10 sm:px-10 sm:py-14">
            <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(139,92,246,.35), transparent 55%), radial-gradient(circle at 85% 15%, rgba(244,114,240,.28), transparent 50%), radial-gradient(circle at 60% 90%, rgba(94,234,212,.18), transparent 55%)' }} />
            <motion.div className="absolute -top-24 -left-24 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,.4), transparent 70%)', filter: 'blur(30px)' }}
              animate={{ x: [0, 40, 0], y: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(244,114,240,.32), transparent 70%)', filter: 'blur(30px)' }}
              animate={{ x: [0, -30, 0], y: [0, -20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />

            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-violet-light bg-violet/[.14] border border-violet/30 rounded-full px-2.5 py-1">Propuesta para {recipient}{company ? ` · ${company}` : ''}</span>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-white/35">{TONE_LABEL[proposal.tone] || ''}</span>
              </div>
              <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="text-[28px] sm:text-[36px] font-extrabold leading-[1.05] tracking-tight max-w-2xl"
                style={{ backgroundImage: 'linear-gradient(120deg, #fff, #C4B5FD 60%, #F472F0)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                {data.headline}
              </motion.h1>
              {data.subheadline && (
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-[14px] text-white/55 mt-3 max-w-xl leading-relaxed">{data.subheadline}</motion.p>
              )}
            </div>
          </div>

          <div className="px-6 sm:px-10 pb-10 flex flex-col gap-8">
            {/* ── Intro + entendimiento ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.intro && (
                <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card !p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/35 mb-2">Propuesta</div>
                  <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-line">{data.intro}</p>
                </motion.div>
              )}
              {data.understanding && (
                <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }} className="card !p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/35 mb-2">Entendemos que necesitás</div>
                  <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-line">{data.understanding}</p>
                </motion.div>
              )}
            </div>

            {/* ── Secciones libres ── */}
            {!!data.sections?.length && (
              <div className="flex flex-col gap-3">
                {data.sections.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                    className="rounded-2xl px-5 py-4 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}>
                    <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-light to-neon-pink" />
                    <div className="text-[13.5px] font-bold mb-1.5">{s.title}</div>
                    <p className="text-[12.5px] text-white/60 leading-relaxed whitespace-pre-line">{s.body}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── Servicios ── */}
            {!!data.services?.length && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/35 mb-3">Qué incluye</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.services.map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                      whileHover={{ y: -3 }} className="card !p-5">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet/[.14] border border-violet-light/30 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4 10-11" /></svg>
                        </div>
                        <div className="text-[13.5px] font-bold">{s.name}</div>
                      </div>
                      {s.description && <p className="text-[12px] text-white/55 leading-relaxed mb-2.5">{s.description}</p>}
                      {!!s.deliverables?.length && (
                        <ul className="flex flex-col gap-1">
                          {s.deliverables.map((d, j) => (
                            <li key={j} className="text-[11.5px] text-white/45 flex items-start gap-1.5">
                              <span className="text-violet-light mt-0.5">·</span>{d}
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Timeline ── */}
            {!!data.timeline?.length && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/35 mb-3">Cómo lo llevamos adelante</div>
                <div className="relative pl-6">
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-violet-light/60 via-violet/30 to-transparent" />
                  <div className="flex flex-col gap-5">
                    {data.timeline.map((t, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="relative">
                        <span className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-violet-light to-neon-pink shadow-[0_0_12px_rgba(139,92,246,.7)]" />
                        <div className="text-[12.5px] font-bold text-violet-light">{t.label}</div>
                        <div className="text-[12.5px] text-white/55 mt-0.5">{t.detail}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Inversión ── */}
            {data.investment_note && (
              <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(120deg, rgba(139,92,246,.12), rgba(244,114,240,.08))', border: '1px solid rgba(139,92,246,.3)' }}>
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-violet-light mb-2">Inversión</div>
                <p className="text-[13px] text-white/75 leading-relaxed">{data.investment_note}</p>
                {proposal.budget_hint ? (
                  <div className="text-[22px] font-extrabold text-gradient mt-2">{fmtByCurrency(proposal.budget_hint, proposal.currency)}</div>
                ) : null}
              </div>
            )}

            {/* ── Por qué nosotros ── */}
            {!!data.why_us?.length && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.why_us.map((w, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                    <p className="text-[12px] text-white/65 leading-relaxed">{w}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── Cierre ── */}
            {data.next_steps && (
              <div className="rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.18), rgba(244,114,240,.12))', border: '1px solid rgba(139,92,246,.35)' }}>
                <p className="text-[14px] font-semibold text-white/90 leading-relaxed max-w-lg mx-auto">{data.next_steps}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
