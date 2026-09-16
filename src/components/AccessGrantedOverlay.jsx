import { motion } from 'framer-motion'

const TEXT = 'INGRESO AUTORIZADO'

const letter = {
  hidden: { opacity: 0, y: 8 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.35 + i * 0.032, duration: 0.32, ease: [0.22, 0.8, 0.3, 1] } }),
}

export default function AccessGrantedOverlay({ name }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#04030A]"
    >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <motion.div
        initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 3.4, opacity: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className="absolute w-[260px] h-[260px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,.35), transparent 70%)' }}
      />
      <motion.div
        initial={{ y: '-120%', opacity: 0 }} animate={{ y: '120%', opacity: [0, .5, 0] }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
        className="absolute left-0 right-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(139,92,246,.16), transparent)' }}
      />

      <div className="relative flex flex-col items-center">
        <div className="relative w-[104px] h-[104px] mb-6">
          <svg viewBox="0 0 104 104" className="absolute inset-0 -rotate-90">
            <circle cx="52" cy="52" r="46" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="2.5" />
            <motion.circle
              cx="52" cy="52" r="46" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="289"
              initial={{ strokeDashoffset: 289 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 0.8, 0.3, 1] }}
              style={{ filter: 'drop-shadow(0 0 8px rgba(52,211,153,.8))' }}
            />
          </svg>
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.4, type: 'spring', stiffness: 320, damping: 18 }}
            className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{ boxShadow: '0 0 26px rgba(52,211,153,.28)' }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,.7))' }}>
              <motion.path d="M4 12l5 5L20 6"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }} />
            </svg>
          </motion.div>
        </div>

        <div className="flex flex-wrap justify-center px-6" aria-label="Ingreso autorizado">
          {TEXT.split('').map((ch, i) => (
            <motion.span key={i} custom={i} variants={letter} initial="hidden" animate="visible"
              className="text-[15px] sm:text-[17px] font-bold tracking-[.2em] text-white/95"
              style={{ marginLeft: ch === ' ' ? '0.4em' : 0 }}>
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </div>

        {name && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 0.4 }}
            className="mt-2.5 text-[12.5px] text-mint/85 tracking-wide">
            Bienvenido, {name}
          </motion.p>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.4] }} transition={{ delay: 1.2, duration: 1.4, repeat: Infinity }}
          className="mt-5 flex items-center gap-1.5 text-[10px] text-white/35 tracking-[.28em] uppercase">
          <span className="w-[5px] h-[5px] rounded-full bg-mint shadow-[0_0_6px_rgba(52,211,153,.8)]" />
          Cargando espacio de trabajo
        </motion.div>
      </div>
    </motion.div>
  )
}

