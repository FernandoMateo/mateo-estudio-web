import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from './Logo'

const DISMISS_KEY = 'pwa_install_dismissed'
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [showIosTip, setShowIosTip] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    if (isStandalone() || dismissed) return

    function onPrompt(e) {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    if (isIOS()) setShowIosTip(true)

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [dismissed])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  const visible = !dismissed && (deferred || showIosTip)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:w-[340px] z-50 rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(15,14,22,.97)', border: '1px solid rgba(167,139,250,.3)', backdropFilter: 'blur(16px)', boxShadow: '0 20px 50px rgba(0,0,0,.5), 0 0 30px rgba(139,92,246,.15)' }}>
          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.3), rgba(244,114,240,.18))', border: '1px solid rgba(167,139,250,.4)' }}>
            <Logo size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold">Instalá Mateo Estudio</div>
            <div className="text-[11px] text-white/45 mt-0.5 leading-snug">
              {deferred ? 'Se abre como una app, más rápido y sin la barra del navegador.' : 'Tocá Compartir → "Agregar a pantalla de inicio"'}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {deferred && (
              <button onClick={install} className="btn-glass !py-1.5 !px-3 text-[11px]">Instalar</button>
            )}
            <button onClick={dismiss} className="text-[10.5px] text-white/30 hover:text-white/60 transition-colors">Ahora no</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
