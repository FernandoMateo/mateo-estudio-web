import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list } from '../lib/api'

export default function NotificationBell({ onClick, refreshKey }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    list('notifications', '&filter=' + encodeURIComponent('read=false'))
      .then(items => { if (alive) setCount(items.length) })
      .catch(() => {})
    return () => { alive = false }
  }, [refreshKey])

  return (
    <button onClick={onClick} title="Notificaciones"
      className="relative w-[38px] h-[38px] rounded-xl flex items-center justify-center text-white/55 bg-white/[.035] border border-white/[.08] hover:text-white hover:border-violet-light/35 transition-colors flex-shrink-0">
      <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></svg>
      {count > 0 && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-white text-[10px] font-bold flex items-center justify-center"
          style={{ boxShadow: '0 0 10px rgba(251,113,133,.7)' }}>
          {count > 9 ? '9+' : count}
        </motion.span>
      )}
    </button>
  )
}
