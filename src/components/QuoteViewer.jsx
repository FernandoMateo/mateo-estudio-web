import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, fileUrl, fmtARS, fmtUSD } from '../lib/api'
import { Modal } from './ui'

/**
 * quote: registro de la cotización (con expand.client opcional)
 * brand: { logoUrl, color, name } — si no se pasa, se arma automático según issuer_type
 */
export default function QuoteViewer({ open, onClose, quote, brandClient }) {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !quote) return
    setLoading(true)
    list('quote_lines', `&filter=${encodeURIComponent('quote="' + quote.id + '"')}&sort=created`)
      .then(setLines).catch(() => setLines([])).finally(() => setLoading(false))
  }, [open, quote?.id])

  if (!quote) return null
  const isUsd = quote.currency === 'USD'
  const fmt = isUsd ? fmtUSD : fmtARS
  const isWhiteLabel = quote.issuer_type === 'cliente'
  const brandColor = (isWhiteLabel && brandClient?.brand_color && /^#[0-9a-fA-F]{6}$/.test(brandClient.brand_color)) ? brandClient.brand_color : '#8B5CF6'
  const brandLogo = isWhiteLabel && brandClient?.logo ? fileUrl('clients', brandClient.id, brandClient.logo, '200x200') : null
  const brandName = isWhiteLabel ? (brandClient?.name || 'Tu negocio') : 'Mateo Estudio'

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex items-center justify-between mb-5 print:hidden">
        <h3 className="text-[15px] font-bold">Vista de cotización</h3>
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

      <div className="rounded-2xl p-6 bg-white text-[#1a1a1f]" id="quote-print-area">
        <div className="flex items-start justify-between gap-4 pb-5 mb-5" style={{ borderBottom: `3px solid ${brandColor}` }}>
          <div className="flex items-center gap-3">
            {brandLogo ? (
              <img src={brandLogo} alt="" className="w-14 h-14 rounded-lg object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-extrabold text-xl" style={{ background: brandColor }}>
                {brandName[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-lg font-extrabold">{brandName}</div>
              <div className="text-[11px] text-gray-500">Presupuesto{isWhiteLabel ? '' : ' — Mateo Estudio'}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide font-bold">N°</div>
            <div className="text-[12px] font-mono text-gray-600">{quote.id.slice(0, 8).toUpperCase()}</div>
            <div className="text-[11px] text-gray-400 mt-1">{quote.created?.slice(0, 10)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5 text-[13px]">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">Dirigido a</div>
            <div className="font-semibold">{quote.recipient_name || quote.expand?.client?.name || '—'}</div>
            {quote.recipient_contact && <div className="text-gray-500 text-[12px] mt-0.5">{quote.recipient_contact}</div>}
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">Válido hasta</div>
            <div className="font-semibold">{quote.valid_until ? quote.valid_until.slice(0, 10) : 'Sin vencimiento'}</div>
          </div>
        </div>

        <div className="text-[15px] font-bold mb-3">{quote.title}</div>

        <table className="w-full text-[12.5px] mb-5">
          <thead>
            <tr className="text-left text-gray-400 text-[10.5px] uppercase tracking-wide border-b border-gray-200">
              <th className="pb-2 font-bold">Descripción</th>
              <th className="pb-2 font-bold text-right">Cant.</th>
              <th className="pb-2 font-bold text-right">Unit.</th>
              <th className="pb-2 font-bold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-4 text-center text-gray-400">Cargando ítems…</td></tr>
            ) : lines.map(l => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-2">{l.description}{l.unit ? <span className="text-gray-400"> · {l.unit}</span> : ''}</td>
                <td className="py-2 text-right">{l.quantity}</td>
                <td className="py-2 text-right">{fmt(l.unit_cost)}</td>
                <td className="py-2 text-right font-semibold">{fmt(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56 flex flex-col gap-1.5 text-[12.5px]">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(quote.subtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Margen ({quote.margin_pct}%)</span><span>{fmt(quote.margin_amount)}</span></div>
            <div className="flex justify-between text-[17px] font-extrabold pt-2 mt-1 border-t-2" style={{ borderColor: brandColor }}>
              <span>Total</span><span style={{ color: brandColor }}>{fmt(quote.total)}</span>
            </div>
            {isUsd && <div className="text-[10.5px] text-gray-400 text-right">≈ {fmtARS(quote.total_ars)} ARS a la cotización de emisión</div>}
          </div>
        </div>

        {quote.notes && (
          <div className="mt-5 pt-4 border-t border-gray-100 text-[11.5px] text-gray-500 whitespace-pre-line">{quote.notes}</div>
        )}
      </div>
    </Modal>
  )
}
