import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const show = useCallback((msg, isErr = false) => {
    clearTimeout(timer.current)
    setToast({ msg, isErr, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 12, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`fixed bottom-6 left-1/2 z-[90] rounded-xl px-5 py-3 text-[13px] font-medium
              bg-[#14131c]/95 shadow-[0_12px_34px_rgba(0,0,0,.5)] border
              ${toast.isErr ? 'border-coral/40' : 'border-mint/40'}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  )
}
