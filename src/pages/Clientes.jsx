import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { list, createRec, updateRec, removeRec, fileUrl, logActivity } from '../lib/api'
import { COUNTRIES, flagOf } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Stepper, StepPanel, Field, Pill, Row, IconBtn, EditIcon, TrashIcon, ModuleHead, EmptyState, Select, MoneyField } from '../components/ui'
import ClientDocuments from '../components/ClientDocuments'
import { useFx, toArs } from '../context/FxContext'

const STEPS = ['Identidad', 'Contacto', 'Fiscal', 'Comercial']
const emptyForm = {
  name: '', company: '', country: '', brand_color: '', logoFile: null, logoPreview: '',
  contact_name: '', phone: '', email: '', website: '', instagram: '', facebook: '',
  rfc: '', tax_regime: '', legal_name: '', tax_address: '',
  status: 'prospecto', source: '', interested_service: '', estimated_value: '', estimated_value_currency: 'ARS', user: '', notes: '',
  access_mode: 'none', access_name: '', access_email: '', access_password: '',
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
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
  const [docsClient, setDocsClient] = useState(null)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [credsOpen, setCredsOpen] = useState(false)
  const [lastCreds, setLastCreds] = useState(null)
  const linkedUser = portalUsers.find(u => u.id === form.user)

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

  function openNew() { setEditId(null); setForm(emptyForm); setChangingPw(false); setStep(0); setOpen(true) }
  function openEdit(c) {
    setEditId(c.id)
    setForm({
      ...emptyForm, ...c,
      logoFile: null,
      logoPreview: c.logo ? fileUrl('clients', c.id, c.logo, '100x100') : '',
      estimated_value: c.estimated_value || '',
      estimated_value_currency: c.estimated_value_currency || 'ARS',
      access_mode: c.user ? 'linked' : 'none',
      access_name: '', access_email: '', access_password: '',
    })
    setChangingPw(false)
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
    if (form.access_mode === 'create' && (!form.access_email.trim() || !form.access_password || form.access_password.length < 8)) {
      toast('Para crear el acceso, completá el correo y una contraseña de al menos 8 caracteres.', true); return
    }
    if (form.access_mode === 'linked' && changingPw && form.access_password && form.access_password.length < 8) {
      toast('La contraseña nueva debe tener al menos 8 caracteres.', true); return
    }
    setSaving(true)

    // Si eligió crear el acceso al portal ahora mismo, primero armamos la cuenta (sin mandar
    // ningún link de alta) y usamos su id para vincularla al cliente en el mismo guardado.
    let userId = form.user || ''
    let createdCreds = null
    try {
      if (form.access_mode === 'create') {
        const newUser = await createRec('users', {
          name: form.access_name.trim() || form.contact_name.trim() || form.name.trim(),
          email: form.access_email.trim(),
          password: form.access_password, passwordConfirm: form.access_password,
          role: 'cliente',
        })
        userId = newUser.id
        createdCreds = { name: newUser.name, email: form.access_email.trim(), password: form.access_password, clientName: form.name.trim(), phone: form.phone }
      } else if (form.access_mode === 'linked' && changingPw && form.access_password) {
        await updateRec('users', userId, { password: form.access_password, passwordConfirm: form.access_password })
      } else if (form.access_mode === 'none') {
        userId = ''
      }
    } catch (err) {
      const d = err?.data?.data
      toast(d?.email?.message ? 'Ese correo ya tiene una cuenta.' : 'No se pudo crear el acceso al portal.', true)
      setSaving(false); return
    }

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
    fd.append('user', userId || '')
    if (form.logoFile) fd.append('logo', form.logoFile)
    try {
      if (editId) await updateRec('clients', editId, fd, true)
      else await createRec('clients', fd, true)
      logActivity({ action: editId ? 'actualizar' : 'crear', entity: 'cliente', entity_name: form.name?.trim() })
      setOpen(false); toast(editId ? 'Cliente actualizado ✓' : '✦ Cliente creado con éxito'); load()
      if (createdCreds) { setLastCreds(createdCreds); setCredsOpen(true) }
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
                <IconBtn onClick={() => setDocsClient(c)} title="Documentos">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 12V7a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /><path d="M17 15v6M14 18h6" /></svg>
                </IconBtn>
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
                    <p className="text-[11px] text-white/35 mt-1.5">La moneda que elijas acá (aunque no cargues un monto) es la que se usa siempre para las facturas, cotizaciones y saldos de este cliente.</p>
                  </Field>
                  <Field label="Acceso al portal de cliente" full>
                    {form.access_mode === 'linked' ? (
                      <div className="rounded-xl p-3.5" style={{ background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.25)' }}>
                        <div className="flex items-center gap-2.5">
                          <svg className="w-4 h-4 text-mint flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4 10-11" /></svg>
                          <span className="text-[12.5px] font-semibold text-mint">Ya tiene acceso al portal</span>
                        </div>
                        <p className="text-[12px] text-white/50 ml-[26px] mt-0.5 truncate">{linkedUser?.name || 'Cuenta vinculada'}{linkedUser?.email ? ` · ${linkedUser.email}` : ''}</p>
                        <div className="flex gap-2 mt-3 ml-[26px]">
                          <button type="button" className="btn-ghost !py-1.5 !px-2.5 text-[11.5px]" onClick={() => { setChangingPw(v => !v); set('access_password', '') }}>
                            {changingPw ? 'Cancelar' : 'Cambiar contraseña'}
                          </button>
                          <button type="button" className="btn-ghost !py-1.5 !px-2.5 text-[11.5px] !text-coral" onClick={() => { set('user', ''); set('access_mode', 'none'); setChangingPw(false) }}>
                            Quitar acceso
                          </button>
                        </div>
                        {changingPw && (
                          <div className="flex gap-2 mt-3 ml-[26px]">
                            <input className="field flex-1" value={form.access_password} onChange={e => set('access_password', e.target.value)} placeholder="Nueva contraseña (mín. 8)" />
                            <button type="button" className="btn-ghost !px-3" onClick={() => set('access_password', genPassword())}>Generar</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1.5 mb-2.5 flex-wrap">
                          {[['none', 'Sin acceso'], ['link', 'Vincular cuenta existente'], ['create', 'Crear acceso ahora']].map(([k, l]) => (
                            <button key={k} type="button" onClick={() => set('access_mode', k)}
                              className={`text-[11.5px] font-bold px-3 py-1.5 rounded-full border transition-colors
                                ${form.access_mode === k ? 'text-white bg-violet/[.28] border-violet-light/50' : 'text-white/40 border-white/10 hover:text-white/70'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                        {form.access_mode === 'link' && (
                          <Select value={form.user} onChange={v => set('user', v)} placeholder="Elegí una cuenta…"
                            options={portalUsers.map(u => ({ value: u.id, label: u.name || u.email }))} />
                        )}
                        {form.access_mode === 'create' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input className="field" value={form.access_name} onChange={e => set('access_name', e.target.value)} placeholder="Nombre para el login" />
                            <input type="email" className="field" value={form.access_email} onChange={e => set('access_email', e.target.value)} placeholder="Correo de acceso" />
                            <div className="flex gap-2 sm:col-span-2">
                              <input className="field flex-1" value={form.access_password} onChange={e => set('access_password', e.target.value)} placeholder="Contraseña (mín. 8)" />
                              <button type="button" className="btn-ghost !px-3" onClick={() => set('access_password', genPassword())}>Generar</button>
                            </div>
                            <p className="text-[10.5px] text-white/30 sm:col-span-2">Se crea al instante — se la pasás vos mismo, no se manda ningún link de alta.</p>
                          </div>
                        )}
                      </>
                    )}
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

      <Modal open={!!docsClient} onClose={() => setDocsClient(null)}>
        {docsClient && (
          <>
            <ModalHead title={`Documentos — ${docsClient.name}`} onClose={() => setDocsClient(null)} />
            <p className="text-[12px] text-white/35 -mt-2 mb-4">Estos son los documentos que el propio cliente cargó desde su Portal (o los que le subas vos acá).</p>
            <ClientDocuments clientId={docsClient.id} />
          </>
        )}
      </Modal>

      {/* ── Modal: credenciales del acceso recién creado (nunca se manda link, se le pasan directo) ── */}
      <Modal open={credsOpen} onClose={() => setCredsOpen(false)}>
        {lastCreds && (
          <div className="flex flex-col items-center text-center py-4 px-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,#8B5CF6,#F472F0)', boxShadow: '0 0 30px rgba(139,92,246,.5)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M5 13l4 4 10-11" /></svg>
            </div>
            <h3 className="text-[17px] font-extrabold">¡Acceso creado!</h3>
            <p className="text-[12.5px] text-white/40 mt-1.5 mb-5 max-w-xs">Pasale estos datos a {lastCreds.clientName} para que entre a su portal. No se mandó ningún link.</p>
            <div className="w-full max-w-xs flex flex-col gap-2.5 text-left mb-5">
              <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.08)' }}>
                <div className="text-[10px] uppercase tracking-wide text-white/35 font-bold">Correo</div>
                <div className="text-[13.5px] font-semibold">{lastCreds.email}</div>
              </div>
              <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.08)' }}>
                <div className="text-[10px] uppercase tracking-wide text-white/35 font-bold">Contraseña</div>
                <div className="text-[13.5px] font-semibold">{lastCreds.password}</div>
              </div>
            </div>
            <div className="flex gap-2.5 w-full max-w-xs">
              <button className="btn-ghost flex-1 justify-center" onClick={() => navigator.clipboard?.writeText(`Correo: ${lastCreds.email}\nContraseña: ${lastCreds.password}`)}>
                Copiar datos
              </button>
              {lastCreds.phone && (
                <button className="btn-glass flex-1 justify-center" onClick={() => {
                  const phone = lastCreds.phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
                  const msg = encodeURIComponent(`¡Hola! Ya tenés acceso a tu portal de Mateo Estudio.\nCorreo: ${lastCreds.email}\nContraseña: ${lastCreds.password}`)
                  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                }}>WhatsApp</button>
              )}
            </div>
            <button className="btn-ghost mt-4 !border-transparent !bg-transparent" onClick={() => setCredsOpen(false)}>Cerrar</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
