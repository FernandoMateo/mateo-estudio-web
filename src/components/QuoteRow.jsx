import { motion } from 'framer-motion'
import { fmtARS, fmtUSD } from '../lib/api'
import { Pill, IconBtn, EditIcon, TrashIcon } from './ui'

export default function QuoteRow({ quote, subtitle, onView, onEdit, onDelete, onDownload, tag }) {
  const isUsd = quote.currency === 'USD'
  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
      className="group relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 flex-wrap sm:flex-nowrap overflow-hidden cursor-pointer"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}
      onClick={onView}>
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-light to-neon-pink opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-10 h-10 rounded-[11px] flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
        <svg className="w-[17px] h-[17px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 7h6M9 11h6M9 15h3" /><rect x="4" y="3" width="16" height="18" rx="2" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{quote.title}</div>
        <div className="text-[11px] text-white/35 truncate mt-0.5">{subtitle}</div>
      </div>
      {tag}
      <div className="text-right flex-shrink-0">
        <div className="text-[14px] font-extrabold">{isUsd ? fmtUSD(quote.total) : fmtARS(quote.total)}</div>
      </div>
      <Pill value={quote.status || 'borrador'} />
      {(onDownload || onEdit || onDelete) && (
        <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {onDownload && (
            <IconBtn onClick={onDownload} title="Descargar PDF">
              <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
            </IconBtn>
          )}
          {onEdit && <IconBtn onClick={onEdit} title="Editar"><EditIcon /></IconBtn>}
          {onDelete && <IconBtn onClick={onDelete} danger title="Eliminar"><TrashIcon /></IconBtn>}
        </div>
      )}
    </motion.div>
  )
}
