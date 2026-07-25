import { useEffect } from 'react'
import { fileUrl, fmtByCurrency } from '../lib/api'
import { Modal } from './ui'

const TYPE_LABELS = { material: 'Materiales', mano_obra: 'Mano de obra', servicio: 'Servicios', otro: 'Otros' }
const TYPE_ORDER = ['servicio', 'material', 'mano_obra', 'otro']

export default function CatalogViewer({ open, onClose, items = [], client, autoPrint }) {
  useEffect(() => {
    if (!open || !autoPrint) return
    const t = setTimeout(() => window.print(), 450)
    return () => clearTimeout(t)
  }, [open, autoPrint])

  const brandColor = (client?.brand_color && /^#[0-9a-fA-F]{6}$/.test(client.brand_color)) ? client.brand_color : '#8B5CF6'
  const brandLogo = client?.logo ? fileUrl('clients', client.id, client.logo, '200x200') : null
  const brandName = client?.name || 'Tu negocio'
  const contactBits = [client?.phone, client?.email, client?.website].filter(Boolean)

  const grouped = TYPE_ORDER.map(t => ({ type: t, items: items.filter(i => (i.type || 'otro') === t) })).filter(g => g.items.length)

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex items-center justify-between mb-5 print:hidden">
        <h3 className="text-[15px] font-bold">Vista del catálogo</h3>
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

      <div className="rounded-2xl p-6 bg-white text-[#1a1a1f]">
        <div className="flex items-center gap-3 pb-5 mb-5" style={{ borderBottom: `3px solid ${brandColor}` }}>
          {brandLogo ? (
            <img src={brandLogo} alt="" className="w-14 h-14 rounded-lg object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-extrabold text-xl" style={{ background: brandColor }}>{brandName[0]?.toUpperCase()}</div>
          )}
          <div>
            <div className="text-lg font-extrabold">{brandName}</div>
            <div className="text-[11px] text-gray-500">Catálogo de productos y servicios</div>
            {!!contactBits.length && <div className="text-[10.5px] text-gray-400 mt-0.5">{contactBits.join(' · ')}</div>}
          </div>
        </div>

        {!grouped.length ? (
          <p className="text-gray-400 text-center py-10">Todavía no cargaste ítems en tu catálogo.</p>
        ) : grouped.map(g => (
          <div key={g.type} className="mb-6 last:mb-0">
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: brandColor }}>{TYPE_LABELS[g.type]}</div>
            <table className="w-full text-[12.5px]">
              <tbody>
                {g.items.map(it => (
                  <tr key={it.id} className="border-b border-gray-100">
                    <td className="py-2 break-words">{it.name}{it.unit ? <span className="text-gray-400"> · {it.unit}</span> : ''}</td>
                    <td className="py-2 text-right font-semibold">{fmtByCurrency(it.unit_cost, it.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="mt-6 pt-4 border-t border-gray-100 text-[10.5px] text-gray-400 text-center">Precios sujetos a modificación sin previo aviso.</div>
      </div>
    </Modal>
  )
}
