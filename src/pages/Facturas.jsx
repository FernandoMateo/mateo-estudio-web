import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, updateRec, removeRec, createRec, fmtByCurrency, notifyUser, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { ModuleHead, EmptyState, FilterTabs, Pill } from '../components/ui'
import InvoiceBuilder from '../components/InvoiceBuilder'
import InvoiceViewer from '../components/InvoiceViewer'

const TABS = [['todas', 'Todas'], ['borrador', 'Borrador'], ['enviada', 'Pendientes'], ['pagada', 'Pagadas'], ['vencida', 'Vencidas']]
const PERIOD_MONTHS = { mensual: 1, trimestral: 3, anual: 12 }

export default function Facturas() {
  const toast = useToast()
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todas')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [autoPrint, setAutoPrint] = useState(false)

  const load = () => list('invoices', '&sort=-created&expand=client,project').then(setInvoices).catch(() => toast('No se pudieron cargar las facturas.', true))
  useEffect(() => {
    load()
    list('clients', '&sort=name').then(setClients).catch(() => {})
    generateRecurringInvoices()
  }, [])

  // Igual que con los gastos recurrentes: sin proceso corriendo solo en el servidor —
  // cuando abrís Facturas, se revisa si algún proyecto recurrente ya llegó a su fecha
  // y, si es así, se genera sola la factura del mes y se corre la fecha al próximo período.
  async function generateRecurringInvoices() {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const projects = await list('projects', '&expand=service,client&filter=' + encodeURIComponent('next_renewal_date != ""'))
      let generatedAny = false
      for (const p of projects) {
        const billing = p.expand?.service?.billing_type
        const months = PERIOD_MONTHS[billing]
        if (!months || !p.next_renewal_date) continue
        const due = new Date(p.next_renewal_date.slice(0, 10) + 'T00:00:00')
        if (due > today) continue
        try {
          const total = Number(p.budget) || 0
          const invBody = {
            client: p.client, project: p.id, title: `Factura recurrente — ${p.name}`, currency: p.budget_currency || 'ARS',
            fx_rate: p.budget_fx_rate || 1, subtotal: total, total, total_ars: p.budget_ars || total,
            status: 'enviada', issue_date: p.next_renewal_date, recurring: true,
          }
          const inv = await createRec('invoices', invBody)
          await createRec('invoice_lines', { invoice: inv.id, description: p.expand?.service?.name || p.name, quantity: 1, unit_price: total, line_total: total })
          const tx = await createRec('transactions', {
            type: 'ingreso', concept: invBody.title, amount: total, currency: invBody.currency, fx_rate: invBody.fx_rate, amount_ars: invBody.total_ars,
            status: 'pendiente', date: p.next_renewal_date, client: p.client, project: p.id, notes: 'Generado automáticamente — servicio recurrente',
          })
          await updateRec('invoices', inv.id, { transaction: tx.id })
          const nextDate = new Date(due); nextDate.setMonth(nextDate.getMonth() + months)
          await updateRec('projects', p.id, { next_renewal_date: nextDate.toISOString().slice(0, 10) + ' 00:00:00' })
          if (p.expand?.client?.user) notifyUser(p.expand.client.user, { title: 'Recibiste una nueva factura', message: invBody.title, type: 'pago', client: p.client })
          logActivity({ action: 'crear', entity: 'factura', entity_name: invBody.title, project: p.id, summary: 'generada automáticamente' })
          generatedAny = true
        } catch { /* seguimos con las demás aunque una falle */ }
      }
      if (generatedAny) load()
    } catch { /* no bloquea el resto del módulo */ }
  }

  const filtered = invoices.filter(i => {
    if (filter !== 'todas' && i.status !== filter) return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (i.title || '').toLowerCase().includes(q) || (i.expand?.client?.name || '').toLowerCase().includes(q)
  })

  async function markPaid(inv) {
    try {
      await updateRec('invoices', inv.id, { status: 'pagada' })
      if (inv.transaction) await updateRec('transactions', inv.transaction, { status: 'pagado' })
      logActivity({ action: 'actualizar', entity: 'factura', entity_name: inv.title, summary: 'marcada como pagada', project: inv.project || '' })
      toast('✓ Factura marcada como pagada'); load()
    } catch { toast('No se pudo actualizar.', true) }
  }

  async function del(inv) {
    if (!confirm(`¿Eliminar la factura "${inv.title}"?`)) return
    try {
      const lines = await list('invoice_lines', '&filter=' + encodeURIComponent(`invoice="${inv.id}"`))
      await Promise.all(lines.map(l => removeRec('invoice_lines', l.id)))
      if (inv.transaction) await removeRec('transactions', inv.transaction).catch(() => {})
      await removeRec('invoices', inv.id)
      logActivity({ action: 'eliminar', entity: 'factura', entity_name: inv.title })
      toast('Factura eliminada ✓'); load()
    } catch { toast('No se pudo eliminar.', true) }
  }

  return (
    <div>
      <ModuleHead title="Facturas" count={`${invoices.length} en total`} search={search} onSearch={setSearch}
        onNew={() => { setEditing(null); setOpen(true) }} newLabel="Nueva factura" />
      <FilterTabs tabs={TABS} value={filter} onChange={setFilter} />

      {!invoices.length ? (
        <EmptyState title="Sin facturas todavía" text='Crea la primera con "Nueva factura", o esperá a que se generen solas las de tus servicios recurrentes.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Nada con este filtro.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(inv => (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 rounded-2xl px-4 py-3.5 cursor-pointer"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}
              onClick={() => { setAutoPrint(false); setViewing(inv) }}>
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-[11px] flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
                  <svg className="w-[17px] h-[17px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 7h6M9 11h6M9 15h3" /><rect x="4" y="3" width="16" height="18" rx="2" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{inv.title}</div>
                  <div className="text-[11px] text-white/35 truncate mt-0.5">{inv.expand?.client?.name || 'Sin cliente'}{inv.recurring ? ' · recurrente' : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap sm:ml-auto" onClick={e => e.stopPropagation()}>
                <span className="text-[14px] font-extrabold flex-shrink-0">{fmtByCurrency(inv.total, inv.currency)}</span>
                <Pill value={inv.status || 'borrador'} />
                {inv.status !== 'pagada' && (
                  <button onClick={() => markPaid(inv)} title="Marcar como pagada" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-mint hover:bg-mint/10 transition">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </button>
                )}
                <button onClick={() => { setAutoPrint(true); setViewing(inv) }} title="Descargar" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-violet-light hover:bg-violet/10 transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
                </button>
                <button onClick={() => { setEditing(inv); setOpen(true) }} title="Editar" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-white hover:bg-white/[.08] transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                </button>
                <button onClick={() => del(inv)} title="Eliminar" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-coral hover:bg-coral/10 transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <InvoiceBuilder open={open} onClose={() => setOpen(false)} editingInvoice={editing} onSaved={load} />
      <InvoiceViewer open={!!viewing} onClose={() => setViewing(null)} invoice={viewing} clientName={viewing?.expand?.client?.name} autoPrint={autoPrint} />
    </div>
  )
}
