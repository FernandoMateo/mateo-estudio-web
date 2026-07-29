import { useEffect, useState } from 'react'
import { list, removeRec, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { ModuleHead, EmptyState, FilterTabs } from '../components/ui'
import QuoteBuilder from '../components/QuoteBuilder'
import QuoteViewer from '../components/QuoteViewer'
import QuoteRow from '../components/QuoteRow'

const TABS = [['todas', 'Todas'], ['borrador', 'Borrador'], ['enviado', 'Enviadas'], ['aprobado', 'Aprobadas'], ['rechazado', 'Rechazadas']]

export default function Cotizador() {
  const toast = useToast()
  const [quotes, setQuotes] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todas')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [autoPrint, setAutoPrint] = useState(false)

  const load = () => list('quotes', '&sort=-created&filter=' + encodeURIComponent('issuer_type="estudio"') + '&expand=client')
    .then(setQuotes).catch(() => toast('No se pudieron cargar las cotizaciones.', true))

  useEffect(() => {
    load()
    list('clients', '&sort=name').then(setClients).catch(() => {})
    list('services', '&sort=name&filter=' + encodeURIComponent('active=true')).then(setServices).catch(() => {})
  }, [])

  const clientName = q => q.expand?.client?.name || ''
  const filtered = quotes.filter(q => {
    if (filter !== 'todas' && q.status !== filter) return false
    const s = search.toLowerCase().trim()
    if (!s) return true
    return (q.title || '').toLowerCase().includes(s) || clientName(q).toLowerCase().includes(s)
  })

  const catalogFromServices = services.map(s => ({ id: s.id, name: s.name, unit_cost: 0, currency: 'ARS', unit: 'unidad' }))
  const clientOptions = clients.map(c => ({ value: c.id, label: c.name, phone: c.phone, email: c.email, user: c.user }))

  async function del(q) {
    if (!confirm(`¿Eliminar la cotización "${q.title}"?`)) return
    try {
      const lines = await list('quote_lines', '&filter=' + encodeURIComponent('quote="' + q.id + '"'))
      await Promise.all(lines.map(l => removeRec('quote_lines', l.id)))
      await removeRec('quotes', q.id)
      logActivity({ action: 'eliminar', entity: 'cotización', entity_name: q.title })
      toast('Cotización eliminada ✓'); load()
    } catch { toast('No se pudo eliminar.', true) }
  }

  return (
    <div>
      <ModuleHead title="Cotizador" count={`${quotes.length} cotizaciones`} search={search} onSearch={setSearch}
        onNew={() => { setEditing(null); setOpen(true) }} newLabel="Nueva cotización" />
      <FilterTabs tabs={TABS} value={filter} onChange={setFilter} />

      {!quotes.length ? (
        <EmptyState title="Armá tu primera cotización" text='Elegí un cliente de tu cartera, sumá ítems de tu catálogo de Servicios y definí tu margen — el total se calcula solo.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Sin resultados para este filtro.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(q => (
            <div key={q.id}>
              <QuoteRow quote={q} subtitle={clientName(q) || q.recipient_name || 'Sin destinatario'}
                onView={() => { setAutoPrint(false); setViewing(q) }}
                onDownload={() => { setAutoPrint(true); setViewing(q) }}
                onEdit={() => { setEditing(q); setOpen(true) }}
                onDelete={() => del(q)} />
              {q.status === 'rechazado' && q.rejection_reason && (
                <div className="mt-1.5 ml-4 pl-3 py-2 rounded-lg text-[12px] text-[#FCA5A5]" style={{ background: 'rgba(251,113,133,.06)', borderLeft: '2px solid rgba(251,113,133,.4)' }}>
                  <span className="font-semibold">Motivo del rechazo:</span> {q.rejection_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <QuoteBuilder open={open} onClose={() => setOpen(false)} mode="estudio"
        clientOptions={clientOptions} catalog={catalogFromServices} editingQuote={editing}
        brandName="Mateo Estudio" onSaved={load} />

      <QuoteViewer open={!!viewing} onClose={() => setViewing(null)} quote={viewing} autoPrint={autoPrint} />
    </div>
  )
}
