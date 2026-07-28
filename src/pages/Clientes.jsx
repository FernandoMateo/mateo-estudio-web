import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { list, createRec, updateRec, removeRec, fileUrl, logActivity } from '../lib/api'
import { COUNTRIES, flagOf } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Stepper, StepPanel, Field, Pill, Row, IconBtn, EditIcon, TrashIcon, ModuleHead, EmptyState, Select, MoneyField } from '../components/ui'
import { useFx, toArs } from '../context/FxContext'

const STEPS = ['Identidad', 'Contacto', 'Fiscal', 'Comercial']
const emptyForm = {
  name: '', company: '', country: '', brand_color: '', logoFile: null, logoPreview: '',
  contact_name: '', phone: '', email: '', website: '', instagram: '', facebook: '',
  rfc: '', tax_regime: '', legal_name: '', tax_address: '',
  status: 'prospecto', source: '', interested_service: '', estimated_value: '', estimated_value_currency: 'ARS', user: '', notes: '',
}

export default function Clientes() {
  const { me } = useOutletContext()
  const isAdmin = me.role === 'admin'
  const toast = useToast()
  const { rates } = useFx()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [services, setServices] = useState([])
  const [portalUsers, setPortalUsers] = useState([])
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => list('clients', '&sort=-created').then(setClients).catch(() => toast('No se pudieron cargar los clientes.', true))
  useEffect(() => {
    load()
    list('services', '&sort=name').then(setServices).catch(() => {})
    list('users', '&filter=' + encodeURIComponent('role="cliente"')).then(setPortalUsers).catch(() => {})
  }, [])

  const filtered = clients.filter(c => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return [c.name, c.company, c.contact_name, c.email].some(v => (v || '').toLowerCase().includes(q))
  })

  function openNew() { setEditId(null); setForm(emptyForm); setStep(0); setOpen(true) }
  function openEdit(c) {
    setEditId(c.id)
    setForm({
      ...emptyForm, ...c,
      logoFile: null,
      logoPreview: c.logo ? fileUrl('clients', c.id, c.logo, '100x100') : '',
      estimated_value: c.estimated_value || '',
      estimated_value_currency: c.estimated_value_currency || 'ARS',
    })
    setStep(0); setOpen(true)
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function go(delta) {
    if (delta > 0 && step === 0 && !form.name.trim()) { toast('El nombre del cliente es obligatorio.', true); return }
    if (delta > 0 && step === STEPS.length - 1) { save(); return }
    setDir(delta); setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + delta)))
  }

  async function save() {
    if (!form.name.trim()) { toast('El nombre del cliente es obligatorio.', true); return }
    setSaving(true)
    const fd = new FormData()
    const fields = ['name', 'company', 'country', 'brand_color', 'contact_name', 'phone', 'website', 'instagram', 'facebook',
      'rfc', 'tax_regime', 'legal_name', 'tax_address', 'status', 'source', 'interested_service', 'notes']
    fields.forEach(k => fd.append(k, form[k] || ''))
    if (form.email) fd.append('email', form.email)
    if (form.estimated_value) {
    fd.append('estimated_value', form.estimated_value)
    const val = Number(form.estimated_value)
    const valArs = Math.round(toArs(val, form.estimated_value_currency, rates))
    fd.append('estimated_value_currency', form.estimated_value_currency || 'ARS')
    fd.append('estimated_value_fx_rate', (form.estimated_value_currency && form.estimated_value_currency !== 'ARS') ? (val ? valArs / val : 0) : 1)
    fd.append('estimated_value_ars', valArs)
  }
    fd.append('user', form.user || '')
    if (form.logoFile) fd.append('logo', form.logoFile)
    try {
      if (editId) await updateRec('clients', editId, fd, true)
      else await createRec('clients', fd, true)
      logActivity({ action: editId ? 'actualizar' : 'crear', entity: 'cliente', entity_name: form.name?.trim() })
      setOpen(false); toast(editId ? 'Cliente actualizado ✓' : '✦ Cliente creado con éxito'); load()
    } catch (err) {
      const d = err?.data?.data
      let msg = 'No se pudo guardar. Revisa los datos.'
      if (d?.email) msg = 'El correo no tiene un formato válido.'
      else if (d?.website) msg = 'El sitio web debe iniciar con https://'
      else if (d?.logo) msg = 'El logo debe ser imagen de máx. 5 MB.'
      toast(msg, true)
    } finally { setSaving(false) }
  }

  async function del(c) {
    if (!confirm(`¿Eliminar al cliente "${c.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await removeRec('clients', c.id)
      logActivity({ action: 'eliminar', entity: 'cliente', entity_name: c.name })
      toast('Cliente eliminado ✓'); load()
    }
    catch { toast('No se pudo eliminar. Puede tener registros ligados.', true) }
  }

  return (
    <div>
      <ModuleHead title="Clientes" count={`${clients.length} en cartera`} search={search} onSearch={setSearch} onNew={openNew} newLabel="Nuevo cliente" />
      {!clients.length ? (
        <EmptyState title="Tu cartera está lista para crecer" text='Registra tu primer cliente con el botón "Nuevo cliente".' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Sin resultados para "{search}".</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(c => (
            <Row key={c.id}
              icon={<div className="w-10 h-10 rounded-[11px] flex-shrink-0 bg-violet/[.14] border border-violet-light/30 flex items-center justify-center text-[15px] font-bold text-violet-light overflow-hidden">
                {c.logo ? <img src={fileUrl('clients', c.id, c.logo, '100x100')} className="w-full h-full object-cover" /> : (c.name?.[0] || '?').toUpperCase()}
              </div>}
              title={<><span className="mr-1.5">{flagOf(c.country)}</span>{c.name}</>}
              meta={[c.company, c.contact_name, c.email, c.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
              right={<Pill value={c.status || 'prospecto'} />}
            >
              <div className="flex gap-1.5 flex-shrink-0">
                <IconBtn onClick={() => openEdit(c)} title="Editar"><EditIcon /></IconBtn>
                {isAdmin && <IconBtn onClick={() => del(c)} danger title="Eliminar"><TrashIcon /></IconBtn>}
              </div>
            </Row>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHead title={editId ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setOpen(false)} />
        <Stepper steps={STEPS} current={step} />
        <div className="min-h-[230px] relative">
          <StepPanel stepKey={step} direction={dir}>
            {step === 0 && (
              <>
                <p className="text-[11.5px] text-white/35 -mt-1.5 mb-4">Lo esencial: quién es y de dónde es.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre del cliente *" full><input className="field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Panadería La Espiga" /></Field>
                  <Field label="Empresa / razón comercial"><input className="field" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Nombre comercial" /></Field>
                  <Field label="País">
                    <Select value={form.country} onChange={v => set('country', v)} placeholder="—"
                      options={COUNTRIES.map(([code, name]) => ({ value: code, label: `${flagOf(code)} ${name}` }))} />
                  </Field>
                  <Field label="Logo del cliente" full>
                    <label className="flex items-center gap-3 border-[1.5px] border-dashed border-violet-light/30 rounded-lg p-3 cursor-pointer hover:border-violet-light/60 hover:bg-violet/5 transition">
                      <div className="w-11 h-11 rounded-lg bg-violet/[.12] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {form.logoPreview ? <img src={form.logoPreview} className="w-full h-full object-cover" /> :
                          <svg className="w-[18px] h-[18px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5-9 9"/></svg>}
                      </div>
                      <span className="text-xs text-white/55"><b className="text-violet-light font-semibold">Toca para subir</b> · PNG, JPG, SVG o WebP (máx. 5 MB)</span>
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { set('logoFile', f); set('logoPreview', URL.createObjectURL(f)) } }} />
                    </label>
                  </Field>
                  <Field label="Color de marca" full>
                    <div className="flex items-center gap-2.5">
                      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.brand_color) ? form.brand_color : '#8B5CF6'}
                        onChange={e => set('brand_color', e.target.value)} className="w-11 h-10 p-1 rounded-lg bg-white/[.04] border border-white/[.09] cursor-pointer" />
                      <input className="field flex-1" value={form.brand_color} onChange={e => set('brand_color', e.target.value)} placeholder="#8B5CF6" />
                    </div>
                  </Field>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <p className="text-[11.5px] text-white/35 -mt-1.5 mb-4">Con quién hablamos y dónde vive su marca en internet.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Persona de contacto"><input className="field" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Nombre y apellido" /></Field>
                  <Field label="Teléfono"><input className="field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="55 0000 0000" /></Field>
                  <Field label="Correo" full><input type="email" className="field" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@cliente.com" /></Field>
                  <Field label="Sitio web" full><input className="field" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://cliente.com" /></Field>
                  <Field label="Instagram"><input className="field" value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@cuenta" /></Field>
                  <Field label="Facebook"><input className="field" value={form.facebook} onChange={e => set('facebook', e.target.value)} placeholder="/pagina" /></Field>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <p className="text-[11.5px] text-white/35 -mt-1.5 mb-4">
                  Datos para facturación <span className="text-[9.5px] font-bold text-amber bg-amber/[.08] border border-amber/30 rounded px-1.5 py-0.5 ml-1.5">OPCIONAL</span>
                  <br />Si tu cliente es del extranjero o aún no factura, puedes saltarte este paso.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="RFC / ID fiscal"><input className="field" value={form.rfc} onChange={e => set('rfc', e.target.value)} placeholder="XXXX000000XXX" /></Field>
                  <Field label="Régimen fiscal"><input className="field" value={form.tax_regime} onChange={e => set('tax_regime', e.target.value)} placeholder="Ej. Persona moral" /></Field>
                  <Field label="Razón social" full><input className="field" value={form.legal_name} onChange={e => set('legal_name', e.target.value)} placeholder="Nombre legal completo" /></Field>
                  <Field label="Dirección fiscal" full><textarea className="field min-h-[64px]" value={form.tax_address} onChange={e => set('tax_address', e.target.value)} placeholder="Calle, número, colonia, CP, ciudad" /></Field>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <p className="text-[11.5px] text-white/35 -mt-1.5 mb-4">Cómo llegó, qué le interesa y su acceso al portal.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Estado">
                    <Select value={form.status} onChange={v => set('status', v)}
                      options={[{ value: 'prospecto', label: 'Prospecto' }, { value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
                  </Field>
                  <Field label="Origen">
                    <Select value={form.source} onChange={v => set('source', v)} placeholder="—"
                      options={[
                        { value: 'referido', label: 'Referido' }, { value: 'redes_sociales', label: 'Redes sociales' },
                        { value: 'organico', label: 'Orgánico' }, { value: 'publicidad', label: 'Publicidad' }, { value: 'otro', label: 'Otro' },
                      ]} />
                  </Field>
                  <Field label="Servicio de interés">
                    <Select value={form.interested_service} onChange={v => set('interested_service', v)} placeholder="—"
                      options={services.map(s => ({ value: s.id, label: s.name }))} />
                  </Field>
                  <Field label="Valor estimado" full>
                    <MoneyField amount={form.estimated_value} currency={form.estimated_value_currency}
                      onAmount={v => set('estimated_value', v)} onCurrency={v => set('estimated_value_currency', v)} />
                  </Field>
                  <Field label="Acceso al portal de cliente" full>
                    <Select value={form.user} onChange={v => set('user', v)} placeholder="Sin acceso todavía"
                      options={portalUsers.map(u => ({ value: u.id, label: u.name || u.email }))} />
                  </Field>
                  <Field label="Notas" full><textarea className="field min-h-[64px]" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Acuerdos, contexto, detalles…" /></Field>
                </div>
              </>
            )}
          </StepPanel>
        </div>
        <div className="flex justify-between gap-2.5 mt-5">
          <button className="btn-ghost" style={{ visibility: step === 0 ? 'hidden' : 'visible' }} onClick={() => go(-1)}>← Atrás</button>
          <div className="flex gap-2.5 ml-auto">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-glass" disabled={saving} onClick={() => go(1)}>
              {step === STEPS.length - 1 ? (editId ? 'Guardar cambios' : 'Crear cliente ✦') : 'Siguiente →'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
