import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, createRec, updateRec, removeRec } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Field, IconBtn, EditIcon, TrashIcon, ModuleHead, EmptyState, Select, MoneyField, MoneyDisplay, FilterTabs } from '../components/ui'
import { useFx, usdToArs } from '../context/FxContext'

const BILLING = {
  unico: { label: 'Único', recurring: false },
  por_hora: { label: 'Por hora', recurring: false },
  mensual: { label: 'Mensual', recurring: true },
  trimestral: { label: 'Trimestral', recurring: true },
  anual: { label: 'Anual', recurring: true },
}
const BILLING_OPTIONS = Object.entries(BILLING).map(([value, v]) => ({ value, label: v.label }))
const ICONS_SUGGERIDOS = ['🎨', '💻', '📱', '📈', '✍️', '📸', '🎥', '🔧', '🛒', '⚙️', '🌐', '✨']
const TABS = [['todos', 'Todos'], ['activo', 'Activos'], ['recurrente', 'Recurrentes'], ['unico', 'Únicos / por hora'], ['inactivo', 'Inactivos']]

const emptyForm = { name: '', category: '', icon: '🎨', price: '', price_currency: 'ARS', billing_type: 'unico', description: '', active: true }

export default function Servicios() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const toast = useToast()
  const { rates } = useFx()
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => list('services', '&sort=name').then(setServices).catch(() => toast('No se pudieron cargar los servicios.', true))
  useEffect(() => { load() }, [])

  const filtered = services.filter(s => {
    const q = search.toLowerCase().trim()
    if (q && !((s.name || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q))) return false
    if (filter === 'activo') return s.active !== false
    if (filter === 'inactivo') return s.active === false
    if (filter === 'recurrente') return BILLING[s.billing_type]?.recurring
    if (filter === 'unico') return !BILLING[s.billing_type]?.recurring
    return true
  })

  function openNew() { setEditId(null); setForm(emptyForm); setOpen(true) }
  function openEdit(s) {
    setEditId(s.id)
    setForm({ ...emptyForm, ...s, price: s.price || '', price_currency: s.price_currency || 'ARS', icon: s.icon || '🎨', active: s.active !== false })
    setOpen(true)
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.name.trim()) { toast('El nombre del servicio es obligatorio.', true); return }
    setSaving(true)
    const priceNum = form.price ? Number(form.price) : 0
    const isUsd = form.price_currency === 'USD'
    const rate = usdToArs(rates)
    const body = {
      name: form.name.trim(), category: form.category.trim(), icon: form.icon || '🎨',
      price: priceNum, price_currency: form.price_currency || 'ARS',
      price_fx_rate: isUsd ? (rate || 0) : 1,
      price_ars: isUsd ? (rate ? Math.round(priceNum * rate) : priceNum) : priceNum,
      billing_type: form.billing_type, description: form.description.trim(), active: !!form.active,
    }
    try {
      if (editId) await updateRec('services', editId, body)
      else await createRec('services', body)
      setOpen(false); toast(editId ? 'Servicio actualizado ✓' : '✦ Servicio creado con éxito'); load()
    } catch { toast('No se pudo guardar el servicio.', true) } finally { setSaving(false) }
  }

  async function del(s) {
    if (!confirm(`¿Eliminar el servicio "${s.name}"? Esta acción no se puede deshacer.`)) return
    try { await removeRec('services', s.id); toast('Servicio eliminado ✓'); load() }
    catch { toast('No se pudo eliminar. Puede estar en uso por algún cliente.', true) }
  }

  async function toggleActive(s) {
    try {
      await updateRec('services', s.id, { active: !(s.active !== false) })
      setServices(list => list.map(x => x.id === s.id ? { ...x, active: !(x.active !== false) } : x))
    } catch { toast('No se pudo actualizar el estado.', true) }
  }

  return (
    <div>
      <ModuleHead title="Servicios" count={`${services.length} en el catálogo`} search={search} onSearch={setSearch} onNew={openNew} newLabel="Nuevo servicio" />
      <FilterTabs tabs={TABS} value={filter} onChange={setFilter} />

      {!services.length ? (
        <EmptyState title="Tu catálogo está vacío" text='Cargá tu primer servicio con "Nuevo servicio" — después vas a poder elegirlo desde la ficha de cada cliente.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Sin resultados para este filtro.</p>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          {filtered.map((s, i) => {
            const billing = BILLING[s.billing_type] || BILLING.unico
            const inactive = s.active === false
            return (
              <motion.div key={s.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: inactive ? 0.5 : 1, y: 0 }}
                whileHover={{ y: -3 }} className="card !p-4 relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[19px] flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.18), rgba(244,114,240,.1))', border: '1px solid rgba(167,139,250,.3)' }}>
                    {s.icon || '🎨'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold truncate">{s.name}</div>
                    {s.category && <div className="text-[11px] text-white/40 truncate mt-0.5">{s.category}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <IconBtn onClick={() => openEdit(s)} title="Editar"><EditIcon /></IconBtn>
                    {isAdmin && <IconBtn onClick={() => del(s)} danger title="Eliminar"><TrashIcon /></IconBtn>}
                  </div>
                </div>

                {s.description && <p className="text-[11.5px] text-white/40 mt-3 leading-relaxed line-clamp-2">{s.description}</p>}

                <div className="flex items-end justify-between mt-4 pt-3.5 border-t border-white/[.06]">
                  <div>
                    <MoneyDisplay amount={s.price} currency={s.price_currency} amountArs={s.price_currency === 'USD' ? s.price_ars : null} className="text-[16px] font-extrabold" />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`pill ${billing.recurring ? 'text-violet-light bg-violet/10 border border-violet/35' : 'text-white/45 bg-white/5 border border-white/10'}`}>
                        {billing.recurring && <span className="mr-1">↻</span>}{billing.label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => toggleActive(s)}
                    className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors flex-shrink-0
                      ${inactive ? 'text-white/35 border-white/10 hover:text-white/60' : 'text-mint border-mint/30 bg-mint/10'}`}>
                    {inactive ? 'Inactivo' : 'Activo'}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHead title={editId ? 'Editar servicio' : 'Nuevo servicio'} onClose={() => setOpen(false)} />
        <div className="grid grid-cols-2 gap-3.5 max-[520px]:grid-cols-1">
          <Field label="Nombre del servicio *" full><input className="field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Diseño de identidad de marca" /></Field>

          <Field label="Ícono" full>
            <div className="flex items-center gap-2 flex-wrap">
              {ICONS_SUGGERIDOS.map(ic => (
                <button key={ic} type="button" onClick={() => set('icon', ic)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-[16px] border transition-all
                    ${form.icon === ic ? 'border-violet-light bg-violet/20 scale-110 shadow-[0_0_12px_rgba(139,92,246,.4)]' : 'border-white/10 bg-white/[.03] hover:border-white/25'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Categoría"><input className="field" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Ej. Diseño, Desarrollo, Marketing" /></Field>
          <Field label="Cadencia de cobro">
            <Select value={form.billing_type} onChange={v => set('billing_type', v)} options={BILLING_OPTIONS} />
          </Field>

          <Field label="Precio" full>
            <MoneyField amount={form.price} currency={form.price_currency} onAmount={v => set('price', v)} onCurrency={v => set('price_currency', v)} />
          </Field>

          <Field label="Descripción" full><textarea className="field min-h-[72px]" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Qué incluye, alcance, entregables…" /></Field>

          <Field label="Estado" full>
            <button type="button" onClick={() => set('active', !form.active)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-[13px] font-semibold transition-colors w-full
                ${form.active ? 'text-mint border-mint/30 bg-mint/10' : 'text-white/45 border-white/10 bg-white/[.03]'}`}>
              <span className={`rounded-full relative transition-colors flex-shrink-0 ${form.active ? 'bg-mint/40' : 'bg-white/10'}`} style={{ height: 18, width: 32 }}>
                <motion.span className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white" animate={{ left: form.active ? 16 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              </span>
              {form.active ? 'Visible en el catálogo' : 'Oculto (archivado)'}
            </button>
          </Field>
        </div>
        <div className="flex justify-end gap-2.5 mt-5">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={saving} onClick={save}>
            {saving ? 'Guardando…' : (editId ? 'Guardar cambios' : 'Crear servicio ✦')}
          </motion.button>
        </div>
      </Modal>
    </div>
  )
}
