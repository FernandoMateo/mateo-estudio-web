import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
<<<<<<< HEAD
import { createRec, updateRec, removeRec, list, fmtByCurrency, notifyUser } from '../lib/api'
=======
import { createRec, updateRec, removeRec, list, fmtByCurrency } from '../lib/api'
>>>>>>> a9ede5ebefbd2796431aabcaa98c10b04e86995d
import { useToast } from '../context/ToastContext'
import { useFx, convertAmount, toArs } from '../context/FxContext'
import { Modal, ModalHead, Field, Select } from './ui'

const CURRENCIES = [{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }, { value: 'MXN', label: 'Pesos MX (MXN)' }]
const PAYMENT_METHODS = [{ value: 'efectivo', label: 'Efectivo' }, { value: 'transferencia', label: 'Transferencia' }, { value: 'cheque', label: 'Cheque' }, { value: 'otro', label: 'Otro' }]

/**
 * mode: 'estudio' (admin arma presupuesto para un cliente/prospecto de la cartera)
 *       'cliente' (el cliente arma un presupuesto para SU propio cliente, marca blanca)
 * clientOptions: [{value,label,phone,email}] — a quién va dirigido (estudio)
 * ownClientId: id del cliente dueño de la cuenta (obligatorio en modo cliente)
 * catalog: [{id,name,unit_cost,currency,unit}] — de dónde salen los ítems sugeridos
 * editingQuote: objeto de cotización si se está editando, o null para nueva
 * brandColor: color propio del cliente, usado en la animación de éxito (marca blanca)
 * brandName: nombre a mostrar en el mensaje de envío
 */
export default function QuoteBuilder({ open, onClose, mode, clientOptions = [], ownClientId, catalog = [], editingQuote, onSaved, brandColor, brandName }) {
  const toast = useToast()
  const { rates } = useFx()
  const color = brandColor || '#8B5CF6'

  const [stage, setStage] = useState('form') // form | success | send
  const [activeEditId, setActiveEditId] = useState(null)
  const [lastQuote, setLastQuote] = useState(null)

  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientContact, setRecipientContact] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [marginPct, setMarginPct] = useState('30')
  const [status, setStatus] = useState('borrador')
  const [paymentMethod, setPaymentMethod] = useState('transferencia')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([])
  const [saving, setSaving] = useState(false)
  const [loadingLines, setLoadingLines] = useState(false)

  function resetBlank() {
    setTitle(''); setClient(mode === 'cliente' ? ownClientId : ''); setRecipientName(''); setRecipientContact('')
    setCurrency('ARS'); setMarginPct('30'); setStatus('borrador'); setPaymentMethod('transferencia'); setValidUntil(''); setNotes('')
    setLines([{ tempId: crypto.randomUUID(), description: '', unit: 'unidad', quantity: 1, unit_cost: '' }])
    setActiveEditId(null)
  }

  useEffect(() => {
    if (!open) return
    setStage('form')
    if (editingQuote) {
      setActiveEditId(editingQuote.id)
      setTitle(editingQuote.title || '')
      setClient(editingQuote.client || '')
      setRecipientName(editingQuote.recipient_name || '')
      setRecipientContact(editingQuote.recipient_contact || '')
      setCurrency(editingQuote.currency || 'ARS')
      setMarginPct(String(editingQuote.margin_pct ?? 30))
      setStatus(editingQuote.status || 'borrador')
      setPaymentMethod(editingQuote.payment_method || 'transferencia')
      setValidUntil(editingQuote.valid_until?.slice(0, 10) || '')
      setNotes(editingQuote.notes || '')
      setLoadingLines(true)
      list('quote_lines', `&filter=${encodeURIComponent('quote="' + editingQuote.id + '"')}`)
        .then(items => setLines(items.map(l => ({ tempId: l.id, description: l.description, unit: l.unit || '', quantity: l.quantity, unit_cost: l.unit_cost }))))
        .catch(() => toast('No se pudieron cargar los ítems de esta cotización.', true))
        .finally(() => setLoadingLines(false))
    } else {
      resetBlank()
    }
  }, [open, editingQuote])

  function addLine(fromCatalog) {
    if (fromCatalog) {
      const converted = convertAmount(fromCatalog.unit_cost, fromCatalog.currency || 'ARS', currency, rates)
      setLines(ls => [...ls, { tempId: crypto.randomUUID(), description: fromCatalog.name, unit: fromCatalog.unit || 'unidad', quantity: 1, unit_cost: Math.round(converted * 100) / 100 }])
    } else {
      setLines(ls => [...ls, { tempId: crypto.randomUUID(), description: '', unit: 'unidad', quantity: 1, unit_cost: '' }])
    }
  }
  function updateLine(tempId, patch) { setLines(ls => ls.map(l => l.tempId === tempId ? { ...l, ...patch } : l)) }
  function removeLine(tempId) { setLines(ls => ls.filter(l => l.tempId !== tempId)) }

  const fmt = n => fmtByCurrency(n, currency)
  const subtotal = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0)
  const marginAmount = subtotal * ((Number(marginPct) || 0) / 100)
  const total = subtotal + marginAmount
  const totalArs = toArs(total, currency, rates)

  async function save() {
    if (!title.trim()) { toast('Ponele un título a la cotización.', true); return }
    if (mode === 'estudio' && !client) { toast('Elegí a quién va dirigida.', true); return }
    const validLines = lines.filter(l => (l.description || '').trim() && Number(l.quantity) > 0)
    if (!validLines.length) { toast('Agregá al menos un ítem con descripción y cantidad.', true); return }
    setSaving(true)
    try {
      const isForeign = currency !== 'ARS'
      const fxRate = isForeign ? (total ? totalArs / total : 0) : 1
      const body = {
        issuer_type: mode,
        client: mode === 'cliente' ? ownClientId : client,
        title: title.trim(),
        recipient_name: recipientName.trim(),
        recipient_contact: recipientContact.trim(),
        currency, fx_rate: fxRate,
        margin_pct: Number(marginPct) || 0,
        subtotal: Math.round(subtotal * 100) / 100,
        margin_amount: Math.round(marginAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        total_ars: Math.round(totalArs * 100) / 100,
        status, payment_method: paymentMethod,
        valid_until: validUntil ? validUntil + ' 00:00:00' : '', notes: notes.trim(),
      }
      let quoteId = activeEditId
      if (activeEditId) {
        await updateRec('quotes', quoteId, body)
        const oldLines = await list('quote_lines', `&filter=${encodeURIComponent('quote="' + quoteId + '"')}`)
        await Promise.all(oldLines.map(l => removeRec('quote_lines', l.id)))
      } else {
        const created = await createRec('quotes', body)
        quoteId = created.id
<<<<<<< HEAD
        if (mode === 'estudio') {
          const opt = clientOptions.find(o => o.value === client)
          if (opt?.user) notifyUser(opt.user, { title: 'Recibiste una nueva cotización', message: title.trim(), type: 'pago', client })
        }
=======
>>>>>>> a9ede5ebefbd2796431aabcaa98c10b04e86995d
      }
      await Promise.all(validLines.map(l => createRec('quote_lines', {
        quote: quoteId, description: (l.description || '').trim(), unit: l.unit || '',
        quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) || 0,
        line_total: Math.round((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0) * 100) / 100,
      })))
      onSaved?.()
      setLastQuote({ ...body, id: quoteId })
      setStage('success')
    } catch {
      toast('No se pudo guardar la cotización. Revisá los datos.', true)
    } finally { setSaving(false) }
  }

  function buildMessage() {
    const q = lastQuote
    const lines2 = [
      `Hola! Te comparto el presupuesto "${q.title}".`,
      `Total: ${fmtByCurrency(q.total, q.currency)}`,
      q.valid_until ? `Válido hasta: ${q.valid_until.slice(0, 10)}` : '',
      brandName ? `— ${brandName}` : '',
    ].filter(Boolean)
    return lines2.join('\n')
  }
  function resolveContact() {
    if (mode === 'cliente') {
      const raw = recipientContact || ''
      return { phone: raw.replace(/[^\d+]/g, ''), email: raw.includes('@') ? raw : '' }
    }
    const opt = clientOptions.find(o => o.value === client)
    return { phone: (opt?.phone || '').replace(/[^\d+]/g, ''), email: opt?.email || '' }
  }
  function sendWhatsapp() {
    const { phone } = resolveContact()
    const msg = encodeURIComponent(buildMessage())
    const url = phone && phone.length >= 8 ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${msg}` : `https://wa.me/?text=${msg}`
    window.open(url, '_blank')
    onClose()
  }
  function sendEmail() {
    const { email } = resolveContact()
    const subject = encodeURIComponent('Presupuesto — ' + (lastQuote?.title || ''))
    const body = encodeURIComponent(buildMessage())
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      {stage === 'form' && (
        <>
          <ModalHead title={activeEditId ? 'Editar cotización' : 'Nueva cotización'} onClose={onClose} />

          <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
            <Field label="Título *" full><input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Remodelación de cocina" /></Field>

            {mode === 'estudio' ? (
              <Field label="Dirigida a *" full>
                <Select value={client} onChange={setClient} placeholder="Elegí un cliente de tu cartera…" options={clientOptions} />
              </Field>
            ) : (
              <>
                <Field label="Cliente / destinatario"><input className="field" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nombre de tu cliente" /></Field>
                <Field label="Contacto (tel. o email)"><input className="field" value={recipientContact} onChange={e => setRecipientContact(e.target.value)} placeholder="+54 9 11… o correo@…" /></Field>
              </>
            )}

            <Field label="Moneda"><Select value={currency} onChange={setCurrency} options={CURRENCIES} /></Field>
            <Field label="Margen de ganancia (%)"><input type="number" min="0" max="100" className="field" value={marginPct} onChange={e => setMarginPct(e.target.value)} /></Field>
            <Field label="Método de pago"><Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS} /></Field>
            <Field label="Estado">
              <Select value={status} onChange={setStatus} options={[{ value: 'borrador', label: 'Borrador' }, { value: 'enviado', label: 'Enviado' }, { value: 'aprobado', label: 'Aprobado' }, { value: 'rechazado', label: 'Rechazado' }]} />
            </Field>
            <Field label="Válida hasta"><input type="date" className="field" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></Field>
          </div>

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
                    <motion.div key={l.tempId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto] sm:flex sm:items-center gap-2 w-full">
                        <input className="field sm:flex-[3] sm:min-w-[120px] col-span-2 sm:col-span-1" placeholder="Descripción" value={l.description || ''} onChange={e => updateLine(l.tempId, { description: e.target.value })} />
                        <input className="field sm:w-[76px] sm:flex-shrink-0 min-w-0" placeholder="Unidad" value={l.unit || ''} onChange={e => updateLine(l.tempId, { unit: e.target.value })} />
                        <input type="number" min="0" step="0.01" className="field sm:w-[72px] sm:flex-shrink-0 min-w-0" placeholder="Cant." value={l.quantity ?? ''} onChange={e => updateLine(l.tempId, { quantity: e.target.value })} />
                        <input type="number" min="0" step="0.01" className="field sm:w-[100px] sm:flex-shrink-0 min-w-0" placeholder="Costo u." value={l.unit_cost ?? ''} onChange={e => updateLine(l.tempId, { unit_cost: e.target.value })} />
                        <span className="text-[12px] text-white/50 sm:w-24 sm:flex-shrink-0 text-right self-center truncate">{fmt((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}</span>
                        <button onClick={() => removeLine(l.tempId)} title="Eliminar ítem" className="text-white/25 hover:text-coral transition-colors flex-shrink-0 p-1.5 justify-self-end sm:justify-self-auto">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </div>
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

          <div className="mt-5 rounded-xl p-4 flex flex-col gap-1.5" style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)' }}>
            <div className="flex justify-between text-[12.5px] text-white/55"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-[12.5px] text-white/55"><span>Margen ({marginPct || 0}%)</span><span>{fmt(marginAmount)}</span></div>
            <div className="flex justify-between text-[16px] font-extrabold pt-2 mt-1 border-t border-white/10">
              <span>Total</span>
              <span className="text-gradient">{fmt(total)}</span>
            </div>
            {currency !== 'ARS' && <div className="text-[10.5px] text-white/30 text-right">≈ {fmtByCurrency(totalArs, 'ARS')} a la cotización de hoy</div>}
          </div>

          <div className="flex justify-end gap-2.5 mt-5">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={saving} onClick={save}>
              {saving ? 'Guardando…' : (activeEditId ? 'Guardar cambios' : 'Crear cotización ✦')}
            </motion.button>
          </div>
        </>
      )}

      {stage === 'success' && (
        <div className="flex flex-col items-center text-center py-6 px-2">
          <motion.div className="relative w-24 h-24 mb-6" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="absolute inset-0 rounded-full" style={{ border: `2px solid ${color}` }}
                initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.35, ease: 'easeOut' }} />
            ))}
            <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 0 40px ${color}80` }}>
              <motion.svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 13l4 4 10-11" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }} />
              </motion.svg>
            </div>
          </motion.div>

          <motion.h3 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-[19px] font-extrabold">
            ¡Presupuesto creado!
          </motion.h3>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="text-[13px] text-white/45 mt-1.5 max-w-xs">
            "{lastQuote?.title}" por {lastQuote ? fmtByCurrency(lastQuote.total, lastQuote.currency) : ''} está listo.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex gap-3 mt-7 w-full max-w-xs">
            <button className="btn-ghost flex-1 justify-center" onClick={() => { resetBlank(); setStage('form') }}>Crear otro</button>
            <motion.button whileTap={{ scale: 0.97 }} className="btn-glass flex-1 justify-center" style={{ background: `linear-gradient(135deg, ${color}99, ${color}55)`, borderColor: `${color}90` }} onClick={() => setStage('send')}>
              Enviar
            </motion.button>
          </motion.div>
        </div>
      )}

      {stage === 'send' && (
        <div className="flex flex-col items-center text-center py-6 px-2">
          <h3 className="text-[16px] font-bold mb-1.5">¿Cómo lo enviás?</h3>
          <p className="text-[12.5px] text-white/40 mb-7 max-w-xs">Elegí por dónde se lo mandás a tu cliente.</p>
          <div className="flex gap-4 w-full max-w-xs">
            <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} onClick={sendWhatsapp}
              className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border transition-colors"
              style={{ background: 'rgba(37,211,102,.08)', borderColor: 'rgba(37,211,102,.3)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#25D366"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a7.7 7.7 0 0 1-2.3-1.4 8.4 8.4 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5L9.2 7c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2c0 1.3.9 2.6 1.1 2.8s1.8 2.7 4.3 3.8c2.5 1.1 2.5.7 3 .7s1.6-.7 1.8-1.3.2-1.2.1-1.3-.2-.2-.5-.3z" /><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2z" fill="none" stroke="#25D366" strokeWidth="1.6" /></svg>
              <span className="text-[12.5px] font-semibold">WhatsApp</span>
            </motion.button>
            <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} onClick={sendEmail}
              className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border transition-colors"
              style={{ background: 'rgba(139,92,246,.08)', borderColor: 'rgba(139,92,246,.3)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
              <span className="text-[12.5px] font-semibold">Correo</span>
            </motion.button>
          </div>
          <button className="btn-ghost mt-6" onClick={onClose}>Cerrar</button>
        </div>
      )}
    </Modal>
  )
}
