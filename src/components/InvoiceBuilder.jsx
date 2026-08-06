import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { list, createRec, updateRec, removeRec, fmtByCurrency, notifyUser, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Field, Select } from './ui'
import { useFx, convertAmount } from '../context/FxContext'

const emptyLine = () => ({ tempId: crypto.randomUUID(), description: '', quantity: 1, unit_price: '' })
const emptyExtra = () => ({ tempId: crypto.randomUUID(), label: '', value: '' })

export default function InvoiceBuilder({ open, onClose, editingInvoice, onSaved }) {
  const toast = useToast()
  const { rates } = useFx()
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [client, setClient] = useState('')
  const [project, setProject] = useState('')
  const [title, setTitle] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [extras, setExtras] = useState([])
  const [saving, setSaving] = useState(false)
  const [loadingLines, setLoadingLines] = useState(false)

  useEffect(() => {
    if (!open) return
    list('clients', '&sort=name').then(setClients).catch(() => {})
    list('projects', '&sort=name').then(setProjects).catch(() => {})
    if (editingInvoice) {
      setClient(editingInvoice.client || ''); setProject(editingInvoice.project || '')
      setTitle(editingInvoice.title || ''); setCurrency(editingInvoice.currency || 'ARS')
      setIssueDate(editingInvoice.issue_date?.slice(0, 10) || new Date().toISOString().slice(0, 10))
      setDueDate(editingInvoice.due_date?.slice(0, 10) || ''); setNotes(editingInvoice.notes || '')
      try { setExtras(JSON.parse(editingInvoice.extra_fields || '[]').map(e => ({ ...e, tempId: crypto.randomUUID() }))) } catch { setExtras([]) }
      setLoadingLines(true)
      list('invoice_lines', '&filter=' + encodeURIComponent(`invoice="${editingInvoice.id}"`))
        .then(items => setLines(items.length ? items.map(l => ({ tempId: l.id, description: l.description, quantity: l.quantity, unit_price: l.unit_price })) : [emptyLine()]))
        .finally(() => setLoadingLines(false))
    } else {
      setClient(''); setProject(''); setTitle(''); setCurrency('ARS')
      setIssueDate(new Date().toISOString().slice(0, 10)); setDueDate(''); setNotes('')
      setLines([emptyLine()]); setExtras([])
    }
  }, [open, editingInvoice])

  const clientProjects = projects.filter(p => p.client === client)
  const subtotal = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)

  function addLine() { setLines(ls => [...ls, emptyLine()]) }
  function updateLine(id, patch) { setLines(ls => ls.map(l => l.tempId === id ? { ...l, ...patch } : l)) }
  function removeLine(id) { setLines(ls => ls.length > 1 ? ls.filter(l => l.tempId !== id) : ls) }
  function addExtra() { setExtras(es => [...es, emptyExtra()]) }
  function updateExtra(id, patch) { setExtras(es => es.map(e => e.tempId === id ? { ...e, ...patch } : e)) }
  function removeExtra(id) { setExtras(es => es.filter(e => e.tempId !== id)) }

  async function save(sendNow) {
    if (!client) { toast('Elegí a qué cliente le corresponde.', true); return }
    if (!title.trim()) { toast('Ponele un título o concepto a la factura.', true); return }
    const validLines = lines.filter(l => (l.description || '').trim())
    if (!validLines.length) { toast('Agregá al menos un ítem con descripción.', true); return }
    setSaving(true)
    try {
      const totalArs = currency === 'ARS' ? subtotal : convertAmount(subtotal, currency, 'ARS', rates)
      const fx = currency === 'ARS' ? 1 : (subtotal ? totalArs / subtotal : 1)
      const body = {
        client, project: project || '', title: title.trim(), currency, fx_rate: fx,
        subtotal: Math.round(subtotal * 100) / 100, total: Math.round(subtotal * 100) / 100, total_ars: Math.round(totalArs * 100) / 100,
        status: sendNow ? 'enviada' : 'borrador',
        issue_date: issueDate ? issueDate + ' 00:00:00' : '', due_date: dueDate ? dueDate + ' 00:00:00' : '',
        notes: notes.trim(), extra_fields: JSON.stringify(extras.filter(e => e.label.trim()).map(e => ({ label: e.label.trim(), value: e.value }))),
      }
      let invoiceId = editingInvoice?.id
      if (editingInvoice) {
        await updateRec('invoices', invoiceId, body)
        const old = await list('invoice_lines', '&filter=' + encodeURIComponent(`invoice="${invoiceId}"`))
        await Promise.all(old.map(l => removeRec('invoice_lines', l.id)))
      } else {
        const created = await createRec('invoices', body)
        invoiceId = created.id
      }
      await Promise.all(validLines.map(l => createRec('invoice_lines', {
        invoice: invoiceId, description: l.description.trim(), quantity: Number(l.quantity) || 1, unit_price: Number(l.unit_price) || 0,
        line_total: Math.round((Number(l.quantity) || 1) * (Number(l.unit_price) || 0) * 100) / 100,
      })))
      // Mantiene sincronizado Finanzas: la factura se refleja como un ingreso.
      let txId = editingInvoice?.transaction
      const txBody = {
        type: 'ingreso', concept: title.trim(), amount: body.total, currency, fx_rate: fx, amount_ars: body.total_ars,
        status: sendNow ? 'pendiente' : 'pendiente', date: body.issue_date || new Date().toISOString(), due_date: body.due_date,
        client, project: project || '', notes: 'Generado desde Facturas',
      }
      if (txId) await updateRec('transactions', txId, txBody)
      else { const tx = await createRec('transactions', txBody); txId = tx.id; await updateRec('invoices', invoiceId, { transaction: txId }) }

      if (sendNow) {
        const c = clients.find(x => x.id === client)
        if (c?.user) notifyUser(c.user, { title: 'Recibiste una nueva factura', message: title.trim(), type: 'pago', client })
      }
      logActivity({ action: editingInvoice ? 'actualizar' : 'crear', entity: 'factura', entity_name: title.trim(), project: project || '' })
      toast(sendNow ? '✦ Factura enviada al cliente' : 'Factura guardada ✓')
      onSaved?.(); onClose()
    } catch (e) {
      console.error('[Facturas] Error al guardar:', e?.data || e)
      toast('No se pudo guardar la factura.', true)
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <ModalHead title={editingInvoice ? 'Editar factura' : 'Nueva factura'} onClose={onClose} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Cliente *">
          <Select value={client} onChange={v => { setClient(v); setProject('') }} placeholder="Elegí un cliente…"
            options={clients.map(c => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Proyecto (opcional)">
          <Select value={project} onChange={setProject} placeholder={client ? 'Sin proyecto' : 'Elegí un cliente primero'}
            options={clientProjects.map(p => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label="Título / concepto *" full><input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Factura de agosto — Manejo de redes" /></Field>
        <Field label="Moneda">
          <Select value={currency} onChange={setCurrency} options={[{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }, { value: 'MXN', label: 'Pesos MXN' }]} />
        </Field>
        <Field label="Fecha de emisión"><input type="date" className="field" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></Field>
        <Field label="Vence"><input type="date" className="field" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="field-label !mb-0">Ítems</span>
          <button onClick={addLine} className="text-[11.5px] font-semibold text-violet-light hover:text-violet-light/80">+ Agregar ítem</button>
        </div>
        {loadingLines ? <p className="text-[12px] text-white/35">Cargando…</p> : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {lines.map(l => (
                <motion.div key={l.tempId} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                  <div className="flex items-start gap-2">
                    <input className="field flex-1 min-w-0" placeholder="Descripción" value={l.description} onChange={e => updateLine(l.tempId, { description: e.target.value })} />
                    <button onClick={() => removeLine(l.tempId)} className="text-white/25 hover:text-coral p-2 flex-shrink-0">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="number" min="0" step="0.01" className="field" placeholder="Cant." value={l.quantity} onChange={e => updateLine(l.tempId, { quantity: e.target.value })} />
                    <input type="number" min="0" step="0.01" className="field" placeholder="Precio u." value={l.unit_price} onChange={e => updateLine(l.tempId, { unit_price: e.target.value })} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        <div className="text-right text-[13px] font-bold mt-2.5">Subtotal: {fmtByCurrency(subtotal, currency)}</div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="field-label !mb-0">Campos personalizados (opcional)</span>
          <button onClick={addExtra} className="text-[11.5px] font-semibold text-violet-light hover:text-violet-light/80">+ Agregar campo</button>
        </div>
        <p className="text-[11px] text-white/30 mb-2.5">Para cualquier dato extra que quieras que aparezca en la factura — orden de compra, CUIT, referencia, lo que sea.</p>
        <div className="flex flex-col gap-2">
          {extras.map(ex => (
            <div key={ex.tempId} className="flex gap-2">
              <input className="field flex-1" placeholder="Nombre del campo" value={ex.label} onChange={e => updateExtra(ex.tempId, { label: e.target.value })} />
              <input className="field flex-1" placeholder="Valor" value={ex.value} onChange={e => updateExtra(ex.tempId, { value: e.target.value })} />
              <button onClick={() => removeExtra(ex.tempId)} className="text-white/25 hover:text-coral px-2 flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <Field label="Notas" full><textarea className="field min-h-[60px] mt-4" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condiciones, forma de pago, aclaraciones…" /></Field>

      <div className="flex justify-end gap-2.5 mt-6">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button disabled={saving} onClick={() => save(false)} className="btn-ghost">Guardar borrador</button>
        <motion.button whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => save(true)} className="btn-glass">
          {saving ? 'Enviando…' : 'Enviar al portal ✦'}
        </motion.button>
      </div>
    </Modal>
  )
}
