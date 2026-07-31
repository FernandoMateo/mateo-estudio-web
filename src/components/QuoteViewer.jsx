import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, fileUrl, fmtARS, fmtByCurrency } from '../lib/api'
import { Modal } from './ui'
import Logo from './Logo'

const PAYMENT_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque', otro: 'A convenir' }

/**
 * quote: registro de la cotización (con expand.client opcional)
 * brandClient: registro de clients del emisor (para marca blanca, cuando issuer_type='cliente')
 * autoPrint: si true, dispara el diálogo de impresión apenas carga (para el botón "descargar" de la lista)
 * onDecide(status, reason?): al aprobar o rechazar. En rechazo, reason es el motivo cargado.
 */
export default function QuoteViewer({ open, onClose, quote, brandClient, autoPrint, canDecide, onDecide, deciding }) {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    if (!open || !quote) return
    setLoading(true)
    setRejecting(false); setRejectReason('')
    list('quote_lines', `&filter=${encodeURIComponent('quote="' + quote.id + '"')}&sort=created`)
      .then(setLines).catch(() => setLines([])).finally(() => setLoading(false))
  }, [open, quote?.id])

  useEffect(() => {
    if (!open || loading || !autoPrint) return
    const t = setTimeout(() => window.print(), 450)
    return () => clearTimeout(t)
  }, [open, loading, autoPrint])

  if (!quote) return null
  const fmt = n => fmtByCurrency(n, quote.currency)
  const isWhiteLabel = quote.issuer_type === 'cliente'
  const brandColor = (isWhiteLabel && brandClient?.brand_color && /^#[0-9a-fA-F]{6}$/.test(brandClient.brand_color)) ? brandClient.brand_color : '#8B5CF6'
  const brandLogo = isWhiteLabel && brandClient?.logo ? fileUrl('clients', brandClient.id, brandClient.logo, '200x200') : null
  const brandNameTxt = isWhiteLabel ? (brandClient?.name || 'Tu negocio') : 'Mateo Estudio'
  const proposalUrl = quote.proposal_file ? fileUrl('quotes', quote.id, quote.proposal_file) : null
  const qrTarget = isWhiteLabel ? brandClient?.website : null
  const qrUrl = (qrTarget && (qrTarget.startsWith('http://') || qrTarget.startsWith('https://'))) ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(qrTarget)}` : null

  // Margen diluido en el precio unitario: el cliente final nunca ve el margen por separado.
  const marginMult = 1 + (Number(quote.margin_pct) || 0) / 100
  const displayLines = lines.map(l => {
    const unitDisplay = (Number(l.unit_cost) || 0) * marginMult
    return { ...l, unitDisplay, lineTotalDisplay: unitDisplay * (Number(l.quantity) || 0) }
  })
  const grandTotal = displayLines.reduce((a, l) => a + l.lineTotalDisplay, 0) || quote.total

  const contactBits = isWhiteLabel
    ? [brandClient?.phone, brandClient?.email, brandClient?.website].filter(Boolean)
    : []

  function confirmReject() {
    if (!rejectReason.trim()) return
    onDecide?.('rechazado', rejectReason.trim())
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h3 className="text-[15px] font-bold">Vista de cotización</h3>
        <div className="flex gap-2">
          {proposalUrl && (
            <a href={proposalUrl} target="_blank" rel="noopener" className="btn-ghost !py-1.5 !px-3 text-[12px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              Ver propuesta
            </a>
          )}
          <button onClick={() => window.print()} className="btn-ghost !py-1.5 !px-3 text-[12px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Imprimir / PDF
          </button>
          <button onClick={onClose} className="text-white/35 hover:text-white p-1.5 rounded-lg hover:bg-white/[.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      {/* ── Decisión del cliente: arriba de todo ── */}
      {canDecide && !rejecting && (
        <div className="print:hidden flex items-center gap-3 mb-5 justify-center flex-wrap rounded-2xl p-4" style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)' }}>
          <p className="text-[12.5px] text-white/50 w-full text-center mb-0.5">¿Qué decidís sobre esta cotización?</p>
          <motion.button whileTap={{ scale: 0.97 }} disabled={deciding} onClick={() => setRejecting(true)}
            className="flex-1 max-w-[180px] justify-center flex items-center gap-2 py-3 rounded-xl border text-[13px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'rgba(251,113,133,.08)', borderColor: 'rgba(251,113,133,.3)', color: '#FB7185' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
            Rechazar
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} disabled={deciding} onClick={() => onDecide?.('aprobado')}
            className="btn-glass flex-1 max-w-[180px] justify-center disabled:opacity-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 13l4 4 10-11" /></svg>
            {deciding ? 'Guardando…' : 'Aprobar'}
          </motion.button>
        </div>
      )}

      {canDecide && rejecting && (
        <div className="print:hidden mb-5 rounded-2xl p-4" style={{ background: 'rgba(251,113,133,.06)', border: '1px solid rgba(251,113,133,.3)' }}>
          <p className="text-[13px] font-semibold text-[#FCA5A5] mb-2.5">¿Por qué la rechazás?</p>
          <textarea autoFocus className="field min-h-[70px]" placeholder="Contanos el motivo — nos ayuda a ajustar la propuesta…"
            value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <div className="flex justify-end gap-2.5 mt-3">
            <button className="btn-ghost" onClick={() => setRejecting(false)}>Cancelar</button>
            <motion.button whileTap={{ scale: 0.97 }} disabled={deciding || !rejectReason.trim()} onClick={confirmReject}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-40 transition-colors"
              style={{ background: 'rgba(251,113,133,.16)', border: '1px solid rgba(251,113,133,.4)', color: '#FCA5A5' }}>
              {deciding ? 'Enviando…' : 'Confirmar rechazo'}
            </motion.button>
          </div>
        </div>
      )}

      <div className="rounded-[26px] overflow-hidden bg-white text-[#1a1a1f]" id="quote-print-area">
        {/* ── Encabezado partido: título a la izquierda, tarjeta de contacto/términos a la derecha ── */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.25fr_1fr]">
          <div className="p-7 sm:p-8">
            <div className="flex items-center gap-3 mb-7">
              {brandLogo ? (
                <img src={brandLogo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              ) : isWhiteLabel ? (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0" style={{ background: brandColor }}>
                  {brandNameTxt[0]?.toUpperCase()}
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F3F1FA' }}>
                  <Logo size={38} />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[14px] font-extrabold truncate">{brandNameTxt}</div>
                {!!contactBits.length && <div className="text-[10px] text-gray-400 truncate">{contactBits.join(' · ')}</div>}
              </div>
            </div>

            <div className="text-[38px] sm:text-[44px] font-extrabold leading-[0.95] tracking-tight" style={{ backgroundImage: `linear-gradient(120deg, ${brandColor}, #F472F0)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Presu-<br />puesto
            </div>
            <p className="text-[13.5px] text-gray-500 mt-3 max-w-[280px] leading-snug">
              Tu propuesta de <b className="text-[#1a1a1f]">{quote.title}</b> ya está lista.
            </p>

            <div className="flex items-center gap-3 mt-7">
              {qrUrl && <img src={qrUrl} alt="QR" className="w-16 h-16 rounded-lg border border-gray-200 flex-shrink-0" />}
              <div className="text-[10.5px] text-gray-400 leading-relaxed">
                <div className="font-bold uppercase tracking-wide text-gray-500">N° {quote.id.slice(0, 8).toUpperCase()}</div>
                <div>{quote.created?.slice(0, 10)}</div>
                {qrUrl && <div className="mt-0.5">Escaneá para visitarnos</div>}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-7 text-white flex flex-col justify-center gap-4" style={{ background: `linear-gradient(155deg, ${brandColor}, ${brandColor}CC 55%, #1a1230)` }}>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider opacity-70 mb-1.5">Términos y condiciones</div>
              <p className="text-[11.5px] leading-relaxed opacity-90 whitespace-pre-line">
                {quote.notes || 'Presupuesto sujeto a disponibilidad. Los precios pueden variar según el alcance final acordado.'}
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div className="text-[12px] space-y-1.5">
              <div className="flex justify-between gap-3"><span className="opacity-70">Dirigido a</span><span className="font-semibold text-right">{quote.recipient_name || quote.expand?.client?.name || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="opacity-70">Método de pago</span><span className="font-semibold text-right">{PAYMENT_LABELS[quote.payment_method] || 'A convenir'}</span></div>
              <div className="flex justify-between gap-3"><span className="opacity-70">Válido hasta</span><span className="font-semibold text-right">{quote.valid_until ? quote.valid_until.slice(0, 10) : 'Sin vencimiento'}</span></div>
            </div>
            {!!contactBits.length && (
              <>
                <div className="h-px bg-white/20" />
                <div className="text-[11.5px] opacity-90 leading-relaxed">{contactBits.join('\n')}</div>
              </>
            )}
          </div>
        </div>

        {/* ── Ítems: cada uno como una barra oscura, igual que el resto de la identidad de la app ── */}
        <div className="p-6 sm:p-8 pt-7">
          {proposalUrl && (
            <a href={proposalUrl} target="_blank" rel="noopener" className="print:hidden inline-flex items-center gap-2 text-[12px] font-semibold mb-5 px-3 py-1.5 rounded-full" style={{ color: brandColor, background: `${brandColor}14`, border: `1px solid ${brandColor}40` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              Ver propuesta adjunta
            </a>
          )}

          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 text-[10px] uppercase tracking-wide font-bold text-gray-400 mb-2">
            <span>Descripción</span><span>Cant.</span><span className="text-right">Precio</span><span className="text-right">Total</span>
          </div>

          <div className="flex flex-col gap-2">
            {loading ? (
              <div className="py-6 text-center text-gray-400 text-[13px]">Cargando ítems…</div>
            ) : displayLines.map((l, i) => (
              <div key={l.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 rounded-xl px-4 py-3 text-white"
                style={{ background: i % 2 === 0 ? '#141220' : '#1c1830' }}>
                <span className="text-[12.5px] font-medium truncate pr-2">{l.description}</span>
                <span className="text-[12px] opacity-70 text-center">{l.quantity}</span>
                <span className="text-[12px] opacity-70 text-right whitespace-nowrap">{fmt(l.unitDisplay)}</span>
                <span className="text-[12.5px] font-bold text-right whitespace-nowrap">{fmt(l.lineTotalDisplay)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <div className="rounded-full px-6 py-3 flex items-center gap-4" style={{ background: `linear-gradient(120deg, ${brandColor}, #F472F0)` }}>
              <span className="text-[12px] font-bold uppercase tracking-wide text-white/80">Total</span>
              <span className="text-[19px] font-extrabold text-white">{fmt(grandTotal)}</span>
            </div>
          </div>
          {quote.currency !== 'ARS' && <div className="text-[10.5px] text-gray-400 text-right mt-2">≈ {fmtARS(quote.total_ars)} a la cotización de emisión</div>}
        </div>
      </div>
    </Modal>
  )
}
