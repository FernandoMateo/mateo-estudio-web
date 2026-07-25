import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createRec, updateRec, removeRec, list, fmtARS, fmtUSD } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { useFx, usdToArs } from '../context/FxContext'
import { Modal, ModalHead, Field, Select } from './ui'

function convert(amount, from, to, rate) {
  if (from === to || !rate) return Number(amount) || 0
  if (from === 'USD' && to === 'ARS') return (Number(amount) || 0) * rate
  if (from === 'ARS' && to === 'USD') return (Number(amount) || 0) / rate
  return Number(amount) || 0
}

/**
 * mode: 'estudio' (admin arma presupuesto para un cliente/prospecto de la cartera)
 *       'cliente' (el cliente arma un presupuesto para SU propio cliente, marca blanca)
 * clientOptions: [{value,label}] — a quién va dirigido (estudio) — no se usa en modo cliente
 * ownClientId: id del cliente dueño de la cuenta (obligatorio en modo cliente)
 * catalog: [{id,name,unit_cost,currency,unit}] — de dónde salen los ítems sugeridos
 * editingQuote: objeto de cotización si se está editando, o null para nueva
 */
export default function QuoteBuilder({ open, onClose, mode, clientOptions = [], ownClientId, catalog = [], editingQuote, onSaved }) {
  const toast = useToast()
  const { rates } = useFx()
  const rate = usdToArs(rates)

  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientContact, setRecipientContact] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [marginPct, setMarginPct] = useState('30')
  const [status, setStatus] = useState('borrador')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)
  const [loadingLines, setLoadingLines] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingQuote) {
      setTitle(editingQuote.title || '')
      setClient(editingQuote.client || '')
      setRecipientName(editingQuote.recipient_name || '')
      setRecipientContact(editingQuote.recipient_contact || '')
      setCurrency(editingQuote.currency || 'ARS')
      setMarginPct(String(editingQuote.margin_pct ?? 30))
      setStatus(editingQuote.status || 'borrador')
      setValidUntil(editingQuote.valid_until?.slice(0, 10) || '')
      setNotes(editingQuote.notes || '')
      setLoadingLines(true)
      list('quote_lines', `&filter=${encodeURIComponent('quote="' + editingQuote.id + '"')}`)
        .then(items => setLines(items.map(l => ({ tempId: l.id, description: l.description, unit: l.unit || '', quantity: l.quantity, unit_cost: l.unit_cost }))))
        .catch(() => toast('No se pudieron cargar los ítems de esta cotización.', true))
        .finally(() => setLoadingLines(false))
    } else {
      setTitle(''); setClient(mode === 'cliente' ? ownClientId : ''); setRecipientName(''); setRecipientContact('')
      setCurrency('ARS'); setMarginPct('30'); setStatus('borrador'); setValidUntil(''); setNotes('')
      setLines([{ tempId: crypto.randomUUID(), description: '', unit: 'unidad', quantity: 1, unit_cost: '' }])
    }
  }, [open, editingQuote])

  function addLine(fromCatalog) {
    if (fromCatalog) {
      const converted = convert(fromCatalog.unit_cost, fromCatalog.currency || 'ARS', currency, rate)
      setLines(ls => [...ls, { tempId: crypto.randomUUID(), description: fromCatalog.name, unit: fromCatalog.unit || 'unidad', quantity: 1, unit_cost: Math.round(converted * 100) / 100 }])
    } else {
      setLines(ls => [...ls, { tempId: crypto.randomUUID(), description: '', unit: 'unidad', quantity: 1, unit_cost: '' }])
    }
  }
  function updateLine(tempId, patch) { setLines(ls => ls.map(l => l.tempId === tempId ? { ...l, ...patch } : l)) }
  function removeLine(tempId) { setLines(ls => ls.filter(l => l.tempId !== tempId)) }

  const subtotal = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0)
  const marginAmount = subtotal * ((Number(marginPct) || 0) / 100)
  const total = subtotal + marginAmount
  const totalArs = currency === 'USD' ? (rate ? total * rate : total) : total

  async function save() {
    if (!title.trim()) { toast('Ponele un título a la cotización.', true); return }
    if (mode === 'estudio' && !client) { toast('Elegí a quién va dirigida.', true); return }
    const validLines = lines.filter(l => l.description.trim() && Number(l.quantity) > 0)
    if (!validLines.length) { toast('Agregá al menos un ítem con descripción y cantidad.', true); return }
    setSaving(true)
    try {
      const body = {
        issuer_type: mode,
        client: mode === 'cliente' ? ownClientId : client,
        title: title.trim(),
        recipient_name: recipientName.trim(),
        recipient_contact: recipientContact.trim(),
        currency, fx_rate: rate || 0,
        margin_pct: Number(marginPct) || 0,
        subtotal: Math.round(subtotal * 100) / 100,
        margin_amount: Math.round(marginAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        total_ars: Math.round(totalArs * 100) / 100,
        status, valid_until: validUntil ? validUntil + ' 00:00:00' : '', notes: notes.trim(),
      }
      let quoteId = editingQuote?.id
      if (editingQuote) {
        await updateRec('quotes', quoteId, body)
        const oldLines = await list('quote_lines', `&filter=${encodeURIComponent('quote="' + quoteId + '"')}`)
        await Promise.all(oldLines.map(l => removeRec('quote_lines', l.id)))
      } else {
        const created = await createRec('quotes', body)
        quoteId = created.id
      }
      await Promise.all(validLines.map(l => createRec('quote_lines', {
        quote: quoteId, description: l.description.trim(), unit: l.unit || '',
        quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) || 0,
        line_total: Math.round((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0) * 100) / 100,
      })))
      onClose()
      toast(editingQuote ? 'Cotización actualizada ✓' : '✦ Cotización creada')
      onSaved?.()
    } catch {
      toast('No se pudo guardar la cotización. Revisá los datos.', true)
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <ModalHead title={editingQuote ? 'Editar cotización' : 'Nueva cotización'} onClose={onClose} />

      <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
        <Field label="Título *" full><input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Remodelación de cocina" /></Field>

        {mode === 'estudio' ? (
          <Field label="Dirigida a *" full>
            <Select value={client} onChange={setClient} placeholder="Elegí un cliente de tu cartera…" options={clientOptions} />
          </Field>
        ) : (
          <>
            <Field label="Cliente / destinatario"><input className="field" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nombre de tu cliente" /></Field>
            <Field label="Contacto"><input className="field" value={recipientContact} onChange={e => setRecipientContact(e.target.value)} placeholder="Teléfono o email" /></Field>
          </>
        )}

        <Field label="Moneda">
          <Select value={currency} onChange={setCurrency} options={[{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }]} />
        </Field>
        <Field label="Margen de ganancia (%)"><input type="number" min="0" max="100" className="field" value={marginPct} onChange={e => setMarginPct(e.target.value)} /></Field>
        <Field label="Estado">
          <Select value={status} onChange={setStatus} options={[{ value: 'borrador', label: 'Borrador' }, { value: 'enviado', label: 'Enviado' }, { value: 'aprobado', label: 'Aprobado' }, { value: 'rechazado', label: 'Rechazado' }]} />
        </Field>
        <Field label="Válida hasta"><input type="date" className="field" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></Field>
      </div>

      {/* ── Ítems ── */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="field-label !mb-0">Ítems del presupuesto</span>
          {!!catalog.length && (
            <Select value="" onChange={id => { const it = catalog.find(c => c.id === id); if (it) addLine(it) }}
              options={catalog.map(c => ({ value: c.id, label: `+ ${c.name}` }))} placeholder="Agregar del catálogo…" />
          )}
        </div>

        {loadingLines ? (
          <p className="text-[12.5px] text-white/35 py-4">Cargando ítems…</p>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {lines.map(l => (
                <motion.div key={l.tempId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <input className="field flex-[3] min-w-[140px]" placeholder="Descripción" value={l.description} onChange={e => updateLine(l.tempId, { description: e.target.value })} />
                  <input className="field w-20 flex-shrink-0" placeholder="Unidad" value={l.unit} onChange={e => updateLine(l.tempId, { unit: e.target.value })} />
                  <input type="number" min="0" step="0.01" className="field w-20 flex-shrink-0" placeholder="Cant." value={l.quantity} onChange={e => updateLine(l.tempId, { quantity: e.target.value })} />
                  <input type="number" min="0" step="0.01" className="field w-28 flex-shrink-0" placeholder="Costo u." value={l.unit_cost} onChange={e => updateLine(l.tempId, { unit_cost: e.target.value })} />
                  <span className="text-[12px] text-white/50 w-24 flex-shrink-0 text-right">{currency === 'USD' ? fmtUSD((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0)) : fmtARS((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}</span>
                  <button onClick={() => removeLine(l.tempId)} className="text-white/25 hover:text-coral transition-colors flex-shrink-0 p-1.5">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button onClick={() => addLine(null)} className="btn-ghost self-start !py-1.5 !px-3 text-[12px] mt-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Agregar ítem
            </button>
          </div>
        )}
      </div>

      <Field label="Notas / condiciones" full><textarea className="field min-h-[60px] mt-4" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Formas de pago, validez, aclaraciones…" /></Field>

      {/* ── Totales ── */}
      <div className="mt-5 rounded-xl p-4 flex flex-col gap-1.5" style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)' }}>
        <div className="flex justify-between text-[12.5px] text-white/55"><span>Subtotal</span><span>{currency === 'USD' ? fmtUSD(subtotal) : fmtARS(subtotal)}</span></div>
        <div className="flex justify-between text-[12.5px] text-white/55"><span>Margen ({marginPct || 0}%)</span><span>{currency === 'USD' ? fmtUSD(marginAmount) : fmtARS(marginAmount)}</span></div>
        <div className="flex justify-between text-[16px] font-extrabold pt-2 mt-1 border-t border-white/10">
          <span>Total</span>
          <span className="text-gradient">{currency === 'USD' ? fmtUSD(total) : fmtARS(total)}</span>
        </div>
        {currency === 'USD' && <div className="text-[10.5px] text-white/30 text-right">≈ {fmtARS(totalArs)} ARS a la cotización de hoy</div>}
      </div>

      <div className="flex justify-end gap-2.5 mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={saving} onClick={save}>
          {saving ? 'Guardando…' : (editingQuote ? 'Guardar cambios' : 'Crear cotización ✦')}
        </motion.button>
      </div>
    </Modal>
  )
}
