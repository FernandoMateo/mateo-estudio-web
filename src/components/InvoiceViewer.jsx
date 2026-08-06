import { useEffect, useState } from 'react'
import { list, fmtByCurrency, fmtARS } from '../lib/api'
import { Modal } from './ui'
import Logo from './Logo'

const STATUS_META = {
  borrador: { label: 'Borrador', color: '#94A3B8' },
  enviada: { label: 'Pendiente de pago', color: '#FBBF24' },
  pagada: { label: 'Pagada', color: '#34D399' },
  vencida: { label: 'Vencida', color: '#FB7185' },
}

export default function InvoiceViewer({ open, onClose, invoice, clientName, autoPrint }) {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !invoice) return
    setLoading(true)
    list('invoice_lines', `&filter=${encodeURIComponent('invoice="' + invoice.id + '"')}&sort=created`)
      .then(setLines).catch(() => setLines([])).finally(() => setLoading(false))
  }, [open, invoice?.id])

  useEffect(() => {
    if (!open || loading || !autoPrint) return
    const t = setTimeout(() => window.print(), 450)
    return () => clearTimeout(t)
  }, [open, loading, autoPrint])

  if (!invoice) return null
  const fmt = n => fmtByCurrency(n, invoice.currency)
  const meta = STATUS_META[invoice.status] || STATUS_META.borrador
  let extras = []
  try { extras = JSON.parse(invoice.extra_fields || '[]') } catch { /* noop */ }

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h3 className="text-[15px] font-bold">Factura</h3>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-ghost !py-1.5 !px-3 text-[12px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Imprimir / PDF
          </button>
          <button onClick={onClose} className="text-white/35 hover:text-white p-1.5 rounded-lg hover:bg-white/[.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      <div className="rounded-[26px] overflow-hidden bg-white text-[#1a1a1f]">
        <div className="grid grid-cols-1 sm:grid-cols-[1.25fr_1fr]">
          <div className="p-7 sm:p-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F3F1FA' }}>
                <Logo size={28} />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-extrabold truncate">Mateo Estudio</div>
                <div className="text-[10px] text-gray-400">Factura</div>
              </div>
            </div>

            <div className="text-[36px] sm:text-[42px] font-extrabold leading-[0.95] tracking-tight" style={{ backgroundImage: 'linear-gradient(120deg, #8B5CF6, #F472F0)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Factura
            </div>
            <p className="text-[13.5px] text-gray-500 mt-3 max-w-[280px] leading-snug">{invoice.title}</p>

            <div className="mt-6 text-[10.5px] text-gray-400 leading-relaxed">
              {invoice.number && <div className="font-bold uppercase tracking-wide text-gray-500">N° {invoice.number}</div>}
              <div>Emitida: {invoice.issue_date ? invoice.issue_date.slice(0, 10) : invoice.created?.slice(0, 10)}</div>
              {invoice.due_date && <div>Vence: {invoice.due_date.slice(0, 10)}</div>}
            </div>
          </div>

          <div className="p-6 sm:p-7 text-white flex flex-col justify-center gap-4" style={{ background: 'linear-gradient(155deg, #8B5CF6, #8B5CF6CC 55%, #1a1230)' }}>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider opacity-70 mb-1.5">Estado</div>
              <span className="inline-block text-[12px] font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.18)' }}>{meta.label}</span>
            </div>
            <div className="h-px bg-white/20" />
            <div className="text-[12px] space-y-1.5">
              <div className="flex justify-between gap-3"><span className="opacity-70">Facturado a</span><span className="font-semibold text-right">{clientName || '—'}</span></div>
              {invoice.notes && <div className="opacity-90 pt-1 leading-relaxed">{invoice.notes}</div>}
            </div>
            {!!extras.length && (
              <>
                <div className="h-px bg-white/20" />
                <div className="text-[12px] space-y-1">
                  {extras.map((ex, i) => (
                    <div key={i} className="flex justify-between gap-3"><span className="opacity-70">{ex.label}</span><span className="font-semibold text-right">{ex.value}</span></div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8 pt-7">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 text-[10px] uppercase tracking-wide font-bold text-gray-400 mb-2">
            <span>Descripción</span><span>Cant.</span><span className="text-right">Precio</span><span className="text-right">Total</span>
          </div>
          <div className="flex flex-col gap-2">
            {loading ? (
              <div className="py-6 text-center text-gray-400 text-[13px]">Cargando ítems…</div>
            ) : lines.map((l, i) => (
              <div key={l.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 rounded-xl px-4 py-3 text-white" style={{ background: i % 2 === 0 ? '#141220' : '#1c1830' }}>
                <span className="text-[12.5px] font-medium truncate pr-2">{l.description}</span>
                <span className="text-[12px] opacity-70 text-center">{l.quantity}</span>
                <span className="text-[12px] opacity-70 text-right whitespace-nowrap">{fmt(l.unit_price)}</span>
                <span className="text-[12.5px] font-bold text-right whitespace-nowrap">{fmt(l.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <div className="rounded-full px-6 py-3 flex items-center gap-4" style={{ background: 'linear-gradient(120deg, #8B5CF6, #F472F0)' }}>
              <span className="text-[12px] font-bold uppercase tracking-wide text-white/80">Total</span>
              <span className="text-[19px] font-extrabold text-white">{fmt(invoice.total)}</span>
            </div>
          </div>
          {invoice.currency !== 'ARS' && <div className="text-[10.5px] text-gray-400 text-right mt-2">≈ {fmtARS(invoice.total_ars)} a la cotización de emisión</div>}
        </div>
      </div>
    </Modal>
  )
}
