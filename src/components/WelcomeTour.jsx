import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { updateRec } from '../lib/api'
import { useToast } from '../context/ToastContext'
import Logo from './Logo'

const PRESETS = ['#8B5CF6', '#F472F0', '#60A5FA', '#34D399', '#FBBF24', '#FB7185', '#22D3EE', '#FFFFFF']

const SLIDES = [
  {
    icon: <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z" />,
    title: '¡Bienvenido a tu portal!',
    text: 'Este es tu espacio para seguir todo lo que hacemos juntos — proyectos, cotizaciones, facturas y más, todo en un solo lugar.',
  },
  {
    icon: <path d="M3 7l9-4 9 4-9 4-9-4z" />,
    title: 'Tus proyectos',
    text: 'Deslizá entre tus proyectos y tocá cualquiera para ver el detalle completo: progreso, archivos, tareas y todo lo que necesites.',
  },
  {
    icon: <><path d="M9 7h6M9 11h6M9 15h3" /><rect x="4" y="3" width="16" height="18" rx="2" /></>,
    title: 'Cotizaciones y facturas',
    text: 'Cuando te mandemos una cotización, la aprobás o rechazás desde acá mismo. Y siempre vas a poder ver qué facturas tenés pendientes.',
  },
]

export default function WelcomeTour({ client, onDone }) {
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [color, setColor] = useState('#8B5CF6')
  const [saving, setSaving] = useState(false)
  const isColorStep = step === SLIDES.length

  async function finish() {
    setSaving(true)
    try {
      await updateRec('clients', client.id, { brand_color: color })
      onDone(color)
    } catch { toast('No se pudo guardar el color, pero podés seguir — lo cambiás cuando quieras desde Mis datos.', true); onDone(color) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(5,5,8,.88)', backdropFilter: 'blur(6px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="w-[min(440px,94vw)] rounded-[26px] p-7 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, rgba(20,18,30,.98), rgba(8,7,12,.99))', border: '1px solid rgba(167,139,250,.25)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full blur-[70px] opacity-40" style={{ background: `radial-gradient(circle, ${isColorStep ? color : '#8B5CF6'}, transparent 70%)` }} />

        <div className="flex justify-center mb-5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,.14)', border: '1px solid rgba(167,139,250,.3)' }}>
            <Logo size={26} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!isColorStep ? (
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(139,92,246,.14)', border: '1px solid rgba(167,139,250,.3)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{SLIDES[step].icon}</svg>
              </div>
              <h2 className="text-[18px] font-extrabold text-center leading-snug">{SLIDES[step].title}</h2>
              <p className="text-[13.5px] text-white/55 text-center leading-relaxed mt-2.5">{SLIDES[step].text}</p>
            </motion.div>
          ) : (
            <motion.div key="color" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
              <h2 className="text-[18px] font-extrabold text-center leading-snug">¿De qué color te gustaría tu portal?</h2>
              <p className="text-[13px] text-white/55 text-center leading-relaxed mt-2 mb-5">Elegí el que más te guste — lo podés cambiar cuando quieras desde "Mis datos".</p>
              <div className="grid grid-cols-4 gap-3 justify-center mb-4">
                {PRESETS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="aspect-square rounded-full relative" style={{ background: c, border: c === '#FFFFFF' ? '1px solid rgba(255,255,255,.3)' : 'none' }}>
                    {color === c && (
                      <motion.span layoutId="swatch-ring" className="absolute -inset-1.5 rounded-full" style={{ border: `2px solid ${c === '#FFFFFF' ? '#fff' : c}`, boxShadow: `0 0 12px ${c}90` }} />
                    )}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-center gap-2.5 cursor-pointer text-[12.5px] text-white/50 hover:text-white/80 transition-colors">
                <span className="w-6 h-6 rounded-full border border-white/20 flex-shrink-0" style={{ background: color }} />
                Elegir un color personalizado
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="sr-only" />
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-1.5 mt-6 mb-5">
          {[...SLIDES, {}].map((_, i) => (
            <span key={i} className="rounded-full transition-all" style={{ width: i === step ? 18 : 6, height: 6, background: i === step ? (isColorStep ? color : '#A78BFA') : 'rgba(255,255,255,.15)' }} />
          ))}
        </div>

        <div className="flex gap-2.5">
          {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn-ghost flex-shrink-0">Atrás</button>}
          {!isColorStep ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep(s => s + 1)} className="btn-glass flex-1 justify-center">
              Siguiente →
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }} disabled={saving} onClick={finish} className="flex-1 justify-center flex items-center gap-2 py-3 rounded-xl font-bold text-[13.5px] text-white"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 8px 24px ${color}55` }}>
              {saving ? 'Guardando…' : '¡Listo, empezar! ✦'}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
