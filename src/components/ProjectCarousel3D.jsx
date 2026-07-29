import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STATUS_GLOW = {
  en_progreso: '#8B5CF6', propuesta: '#60A5FA', pausado: '#FBBF24', completado: '#34D399', cancelado: '#FB7185',
}

/**
 * Carrusel "coverflow" en 3D: la tarjeta central queda de frente y grande,
 * las de al lado se inclinan en perspectiva y se atenúan. Tocar una tarjeta
 * lateral la trae al centro; tocar la central abre el proyecto.
 */
export default function ProjectCarousel3D({ projects, onOpen }) {
  const [index, setIndex] = useState(0)
  if (!projects.length) return null

  function go(delta) { setIndex(i => Math.max(0, Math.min(projects.length - 1, i + delta))) }

  function handleDragEnd(_, info) {
    const threshold = 60
    if (info.offset.x < -threshold || info.velocity.x < -400) go(1)
    else if (info.offset.x > threshold || info.velocity.x > 400) go(-1)
  }

  return (
    <div className="relative">
      <motion.div className="relative h-[220px] sm:h-[240px] touch-pan-y" style={{ perspective: 1200 }}
        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} onDragEnd={handleDragEnd}>
        {projects.map((p, i) => {
          const offset = i - index
          const abs = Math.abs(offset)
          if (abs > 2) return null
          const prog = Math.max(0, Math.min(100, Number(p.progress) || 0))
          const glow = STATUS_GLOW[p.status] || '#8B5CF6'
          return (
            <motion.div
              key={p.id}
              className="absolute top-0 left-1/2 w-[210px] sm:w-[230px]"
              style={{ transformStyle: 'preserve-3d' }}
              initial={false}
              animate={{
                x: `calc(-50% + ${offset * 62}%)`,
                rotateY: offset === 0 ? 0 : offset > 0 ? -38 : 38,
                scale: offset === 0 ? 1 : 0.82,
                opacity: abs > 2 ? 0 : offset === 0 ? 1 : 0.45,
                zIndex: 10 - abs,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={() => offset === 0 ? onOpen(p) : setIndex(i)}
            >
              <div className="rounded-[22px] p-4 h-[210px] sm:h-[220px] cursor-pointer flex flex-col"
                style={{
                  background: 'linear-gradient(160deg, rgba(255,255,255,.06), rgba(255,255,255,.015))',
                  border: `1px solid ${offset === 0 ? `${glow}55` : 'rgba(255,255,255,.09)'}`,
                  boxShadow: offset === 0 ? `0 20px 50px rgba(0,0,0,.5), 0 0 40px ${glow}30` : '0 10px 24px rgba(0,0,0,.35)',
                }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: glow, background: `${glow}18`, border: `1px solid ${glow}40` }}>
                    {(p.status || 'propuesta').replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[14.5px] font-bold leading-snug line-clamp-2 flex-1">{p.name}</div>
                <div className="mt-auto">
                  <div className="flex items-center justify-between text-[10.5px] text-white/40 mb-1.5">
                    <span>Progreso</span><span className="font-bold" style={{ color: glow }}>{prog}%</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/[.08] overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${glow}99, ${glow})`, boxShadow: `0 0 10px ${glow}90` }}
                      initial={{ width: 0 }} animate={{ width: `${prog}%` }} transition={{ duration: 1, delay: 0.15 }} />
                  </div>
                </div>
                {offset === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                    className="mt-3 text-[10.5px] font-semibold flex items-center gap-1" style={{ color: glow }}>
                    Abrir proyecto
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {projects.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={() => go(-1)} disabled={index === 0}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20 disabled:pointer-events-none bg-white/[.04] border border-white/[.08] hover:border-violet-light/40 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex gap-1.5">
            {projects.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)}
                className="rounded-full transition-all" style={{ width: i === index ? 16 : 5, height: 5, background: i === index ? '#A78BFA' : 'rgba(255,255,255,.18)', boxShadow: i === index ? '0 0 8px rgba(167,139,250,.8)' : 'none' }} />
            ))}
          </div>
          <button onClick={() => go(1)} disabled={index === projects.length - 1}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20 disabled:pointer-events-none bg-white/[.04] border border-white/[.08] hover:border-violet-light/40 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
