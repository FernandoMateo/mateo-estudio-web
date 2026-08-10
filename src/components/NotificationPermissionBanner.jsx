import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { notifSupported, notifPermission, requestNotifPermission } from '../lib/pushNotifications'

const DISMISS_KEY = 'mateo_notif_banner_dismissed'

export default function NotificationPermissionBanner() {
  const [show, setShow] = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!notifSupported()) return
    if (notifPermission() !== 'default') return
    if (localStorage.getItem(DISMISS_KEY)) return
    const t = setTimeout(() => setShow(true), 1400)
    return () => clearTimeout(t)
  }, [])

  async function accept() {
    setAsking(true)
    await requestNotifPermission()
    setAsking(false); setShow(false)
  }
  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24, scale: 0.95 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] w-[min(400px,92vw)] rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'linear-gradient(180deg, rgba(20,18,30,.98), rgba(8,7,12,.99))', border: '1px solid rgba(167,139,250,.3)', boxShadow: '0 20px 50px rgba(0,0,0,.6)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,.14)', border: '1px solid rgba(167,139,250,.3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.7"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[13.5px] font-bold">¿Querés avisos al instante?</h4>
            <p className="text-[12px] text-white/50 mt-1 leading-relaxed">
              Activá los avisos del navegador para enterarte apenas haya novedades en tus proyectos, aunque tengas la app en otra pestaña.
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={dismiss} className="btn-ghost !py-1.5 !px-3 text-[12px]">No, gracias</button>
              <motion.button whileTap={{ scale: 0.97 }} disabled={asking} onClick={accept} className="btn-glass !py-1.5 !px-3 text-[12px]">
                {asking ? 'Un momento…' : 'Activar avisos'}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
