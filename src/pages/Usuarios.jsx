import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, removeRec, PB_URL } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Modal, ModalHead, Field, Pill, IconBtn, TrashIcon, ModuleHead, EmptyState } from '../components/ui'

export default function Usuarios() {
  const toast = useToast()
  const [invites, setInvites] = useState([])
  const [team, setTeam] = useState([])
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const [sendOpen, setSendOpen] = useState(false)
  const [lastInvite, setLastInvite] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = () => {
    list('client_invites', '&sort=-created&expand=client').then(setInvites).catch(() => toast('No se pudieron cargar las invitaciones.', true))
    list('users', '&filter=' + encodeURIComponent('role!="cliente"') + '&sort=name').then(setTeam).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const filtered = invites.filter(i => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (i.name || '').toLowerCase().includes(q) || (i.email || '').toLowerCase().includes(q)
  })

  function openNew() { setForm({ name: '', email: '', phone: '' }); setOpen(true) }

  async function createInvite() {
    setSaving(true)
    try {
      const inv = await createRec('client_invites', { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), status: 'pendiente' })
      setOpen(false)
      setLastInvite(inv)
      setCopied(false)
      setSendOpen(true)
      load()
    } catch { toast('No se pudo generar la invitación.', true) } finally { setSaving(false) }
  }

  async function del(inv) {
    if (!confirm(`¿Eliminar la invitación de "${inv.name || inv.email || 'sin nombre'}"?`)) return
    try { await removeRec('client_invites', inv.id); toast('Invitación eliminada ✓'); load() }
    catch { toast('No se pudo eliminar.', true) }
  }

  const link = lastInvite ? `${PB_URL}/alta/${lastInvite.id}` : ''
  function sendWhatsapp() {
    const phone = (lastInvite?.phone || '').replace(/[^\d+]/g, '')
    const msg = encodeURIComponent(`¡Hola${lastInvite?.name ? ' ' + lastInvite.name : ''}! Bienvenido/a a Mateo Estudio 🎉\nCreá tu cuenta acá para arrancar: ${link}`)
    window.open(phone && phone.length >= 8 ? `https://wa.me/${phone.replace(/^\+/, '')}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
    setSendOpen(false)
  }
  function sendEmail() {
    const subject = encodeURIComponent('¡Bienvenido a Mateo Estudio!')
    const body = encodeURIComponent(`¡Hola${lastInvite?.name ? ' ' + lastInvite.name : ''}!\n\nBienvenido a Mateo Estudio. Creá tu cuenta y arrancá acá:\n${link}\n\n¡Nos vemos del otro lado!`)
    window.location.href = `mailto:${lastInvite?.email || ''}?subject=${subject}&body=${body}`
    setSendOpen(false)
  }
  function copyLink() {
    navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {})
  }

  return (
    <div>
      <ModuleHead title="Usuarios" count={`${invites.length} invitaciones`} search={search} onSearch={setSearch}
        onNew={openNew} newLabel="Enviar alta de cliente" />

      {!invites.length ? (
        <EmptyState title="Mandá tu primera invitación" text='Cuando cierres un trato, generá un enlace de alta — tu cliente carga sus propios datos y crea su acceso al portal solo.' />
      ) : !filtered.length ? (
        <p className="text-[12.5px] text-white/35 px-1">Sin resultados.</p>
      ) : (
        <div className="flex flex-col gap-2.5 mb-8">
          {filtered.map(i => {
            const done = i.status === 'completado'
            return (
              <motion.div key={i.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 flex-wrap sm:flex-nowrap"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.07)' }}>
                <div className="w-10 h-10 rounded-[11px] flex-shrink-0 flex items-center justify-center bg-violet/[.14] border border-violet-light/30">
                  <svg className="w-[17px] h-[17px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l1.5 7v6a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-6z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{i.name || i.email || 'Invitación sin nombre'}</div>
                  <div className="text-[11px] text-white/35 truncate mt-0.5">
                    {done ? `Se unió como ${i.expand?.client?.name || 'cliente'}` : (i.email || i.phone || 'Pendiente de completar')}
                  </div>
                </div>
                <Pill value={done ? 'activo' : 'prospecto'} />
                {!done && <IconBtn onClick={() => del(i)} danger title="Eliminar"><TrashIcon /></IconBtn>}
              </motion.div>
            )
          })}
        </div>
      )}

      {!!team.length && (
        <div>
          <h3 className="text-[13px] font-bold text-white/50 uppercase tracking-wide mb-3">Tu equipo</h3>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))' }}>
            {team.map(u => (
              <div key={u.id} className="card !p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>{(u.name || u.email || '?')[0].toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate">{u.name || u.email}</div>
                  <div className="text-[10.5px] text-violet-light/70 capitalize font-semibold">{u.role}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/25 mt-3">Las cuentas de equipo se crean desde el panel de PocketBase por ahora.</p>
        </div>
      )}

      {/* ── Modal: nueva invitación ── */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHead title="Enviar alta de cliente" onClose={() => setOpen(false)} />
        <p className="text-[12.5px] text-white/40 -mt-1.5 mb-4">Generá un enlace único para que tu nuevo cliente cargue sus propios datos y cree su acceso al portal.</p>
        <div className="grid grid-cols-2 gap-3.5 max-[480px]:grid-cols-1">
          <Field label="Nombre (opcional)" full><input className="field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Para personalizar el mensaje" /></Field>
          <Field label="Correo"><input type="email" className="field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Para mandarlo por correo" /></Field>
          <Field label="Teléfono"><input className="field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Para mandarlo por WhatsApp" /></Field>
        </div>
        <div className="flex justify-end gap-2.5 mt-6">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={saving} onClick={createInvite}>
            {saving ? 'Generando…' : 'Generar enlace ✦'}
          </motion.button>
        </div>
      </Modal>

      {/* ── Modal: cómo enviarlo ── */}
      <Modal open={sendOpen} onClose={() => setSendOpen(false)}>
        <div className="flex flex-col items-center text-center py-4 px-2">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,#8B5CF6,#F472F0)', boxShadow: '0 0 30px rgba(139,92,246,.5)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M5 13l4 4 10-11" /></svg>
          </div>
          <h3 className="text-[17px] font-extrabold">¡Enlace listo!</h3>
          <p className="text-[12.5px] text-white/40 mt-1.5 mb-6 max-w-xs">Elegí por dónde se lo mandás a tu cliente para que arranque su alta.</p>
          <div className="flex gap-3 w-full max-w-xs mb-4">
            <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} onClick={sendWhatsapp}
              className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border" style={{ background: 'rgba(37,211,102,.08)', borderColor: 'rgba(37,211,102,.3)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a7.7 7.7 0 0 1-2.3-1.4 8.4 8.4 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5L9.2 7c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2c0 1.3.9 2.6 1.1 2.8s1.8 2.7 4.3 3.8c2.5 1.1 2.5.7 3 .7s1.6-.7 1.8-1.3.2-1.2.1-1.3-.2-.2-.5-.3z" /><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2z" fill="none" stroke="#25D366" strokeWidth="1.6" /></svg>
              <span className="text-[12px] font-semibold">WhatsApp</span>
            </motion.button>
            <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} onClick={sendEmail}
              className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border" style={{ background: 'rgba(139,92,246,.08)', borderColor: 'rgba(139,92,246,.3)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
              <span className="text-[12px] font-semibold">Correo</span>
            </motion.button>
          </div>
          <button onClick={copyLink} className="btn-ghost w-full max-w-xs justify-center">
            {copied ? '✓ Enlace copiado' : 'Copiar enlace'}
          </button>
          <button className="btn-ghost mt-4 !border-transparent !bg-transparent" onClick={() => setSendOpen(false)}>Cerrar</button>
        </div>
      </Modal>
    </div>
  )
}
