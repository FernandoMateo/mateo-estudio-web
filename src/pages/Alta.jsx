import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PB_URL, list } from '../lib/api'
import { COUNTRIES, flagOf } from '../lib/constants'
import AuroraBackground from '../components/AuroraBackground'
import SharedLogo from '../components/Logo'
import { Stepper, StepPanel, Field, Select } from '../components/ui'

const STEPS = ['Tu negocio', 'Contacto', 'Tu acceso']
const emptyForm = {
  name: '', company: '', country: '',
  contact_name: '', phone: '', email: '', website: '', instagram: '', facebook: '',
  interested_service: '', password: '', passwordConfirm: '',
}

function LocalLogo({ size = 56 }) {
  return (
    <div className="relative flex items-center justify-center rounded-2xl" style={{ width: size, height: size, background: 'linear-gradient(135deg, rgba(139,92,246,.25), rgba(244,114,240,.15))', border: '1px solid rgba(167,139,250,.4)' }}>
      <SharedLogo size={size * 0.82} />
    </div>
  )
}

export default function Alta() {
  const { id } = useParams()
  const nav = useNavigate()
  const [invite, setInvite] = useState(null)
  const [status, setStatus] = useState('loading') // loading | invalid | intro | form | success | error
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [services, setServices] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    fetch(`${PB_URL}/api/collections/client_invites/records/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        if (data.status === 'completado') { setStatus('invalid'); return }
        setInvite(data)
        setForm(f => ({ ...f, name: data.name || '', email: data.email || '', phone: data.phone || '' }))
        setStatus('intro')
      })
      .catch(() => setStatus('invalid'))
    list('services', '&sort=name&filter=' + encodeURIComponent('active=true')).then(setServices).catch(() => {})
  }, [id])

  useEffect(() => {
    if (status !== 'intro') return
    const t = setTimeout(() => setStatus('form'), 2600)
    return () => clearTimeout(t)
  }, [status])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function go(delta) {
    if (delta > 0) {
      if (step === 0 && !form.name.trim()) { setError('Contanos el nombre de tu negocio.'); return }
      if (step === 1 && !form.email.trim()) { setError('Necesitamos tu correo para crear tu acceso.'); return }
      if (step === STEPS.length - 1) { submit(); return }
    }
    setError('')
    setDir(delta); setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + delta)))
  }

  async function submit() {
    if (!form.password || form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (form.password !== form.passwordConfirm) { setError('Las contraseñas no coinciden.'); return }
    setError(''); setSaving(true)
    try {
      // 1) Crear el usuario — la regla del servidor solo permite role="cliente" desde acá.
      await fetch(`${PB_URL}/api/collections/users/records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(), password: form.password, passwordConfirm: form.passwordConfirm,
          name: form.contact_name.trim() || form.name.trim(), role: 'cliente',
        }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw { step: 'usuario', data: d }; return d })

      // 2) Autenticar para poder crear su propia ficha de cliente
      const auth = await fetch(`${PB_URL}/api/collections/users/auth-with-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: form.email.trim(), password: form.password }),
      }).then(async r => { const d = await r.json(); if (!r.ok || !d.token) throw { step: 'acceso', data: d }; return d })
      const token = auth.token

      // 3) Crear la ficha de cliente vinculada
      const client = await fetch(`${PB_URL}/api/collections/clients/records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          name: form.name.trim(), company: form.company.trim(), country: form.country,
          contact_name: form.contact_name.trim(), phone: form.phone.trim(), email: form.email.trim(),
          website: form.website.trim(), instagram: form.instagram.trim(), facebook: form.facebook.trim(),
          interested_service: form.interested_service, status: 'activo', source: 'referido',
          user: auth.record.id, brand_color: '#8B5CF6',
        }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw { step: 'negocio', data: d }; return d })

      // 4) Marcar la invitación como completada
      if (invite) {
        await fetch(`${PB_URL}/api/collections/client_invites/records/${invite.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ status: 'completado', client: client.id }),
        }).catch(() => {})
      }

      // 5) Avisar al equipo que se sumó un cliente nuevo
      try {
        const team = await fetch(`${PB_URL}/api/collections/users/records?filter=${encodeURIComponent('role="admin" || role="equipo"')}`, {
          headers: { Authorization: token },
        }).then(r => r.json())
        await Promise.all((team.items || []).map(u => fetch(`${PB_URL}/api/collections/notifications/records`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ user: u.id, title: `¡${form.name.trim()} se unió a Mateo Estudio!`, message: 'Completó su alta desde el enlace de invitación.', type: 'info', client: client.id }),
        })))
      } catch { /* no bloquea el flujo de bienvenida */ }

      setStatus('success')
    } catch (e) {
      const d = e?.data?.data || {}
      const firstFieldMsg = Object.values(d)[0]?.message
      let msg = firstFieldMsg || 'Algo no salió bien. Revisá los datos e intentá de nuevo.'
      if (d?.email?.message?.includes('valid') || d?.email?.message?.includes('unique')) {
        msg = 'Ese correo ya tiene una cuenta, o no es válido — iniciá sesión directamente si ya te registraste.'
      }
      if (e?.step === 'acceso') msg = 'Creamos tu usuario pero no pudimos iniciar sesión automáticamente. Intentá de nuevo en unos segundos.'
      console.error('[Alta de cliente] Error en el paso:', e?.step, e?.data || e)
      setError(msg)
      setStatus('form')
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-ink">
      <AuroraBackground intense />

      {/* ── Cargando / inválido ── */}
      {status === 'loading' && (
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-[13px] text-white/50">
          Preparando todo…
        </motion.div>
      )}

      {status === 'invalid' && (
        <div className="relative z-10 text-center px-6">
          <LocalLogo />
          <h1 className="text-[20px] font-bold mt-5">Este enlace ya no está disponible</h1>
          <p className="text-[13px] text-white/45 mt-2 max-w-sm mx-auto">Puede que ya lo hayas usado antes, o que el enlace haya expirado. Si creés que es un error, escribinos.</p>
          <button onClick={() => nav('/')} className="btn-glass mt-6">Ir al inicio</button>
        </div>
      )}

      {/* ── Intro pantalla completa ── */}
      <AnimatePresence>
        {status === 'intro' && (
          <motion.div exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.6 }} className="relative z-10 text-center px-6">
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
              <LocalLogo size={72} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-[34px] sm:text-[46px] font-extrabold tracking-tight mt-7 text-gradient">
              Todo comienza aquí.
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-[13px] text-white/40 mt-3">
              Preparando tu espacio en Mateo Estudio OS…
            </motion.p>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
              onClick={() => setStatus('form')} className="btn-ghost mt-8 mx-auto">
              Continuar ahora →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Formulario ── */}
      {status === 'form' && (
        <motion.main initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="relative z-10 w-[min(560px,94vw)] rounded-[18px] px-7 py-8 my-8"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015))', border: '1px solid rgba(167,139,250,.18)', backdropFilter: 'blur(22px)', boxShadow: '0 24px 70px rgba(0,0,0,.6), 0 0 60px rgba(139,92,246,.08)' }}>
          <div className="flex items-center gap-3 mb-6">
            <LocalLogo size={44} />
            <div>
              <div className="text-[15px] font-bold">Bienvenido a Mateo Estudio</div>
              <div className="text-[11.5px] text-white/40">Completá tus datos para crear tu acceso</div>
            </div>
          </div>

          <Stepper steps={STEPS} current={step} />

          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-3.5 py-2.5 rounded-lg bg-coral/[.08] border border-coral/30 text-[12.5px] text-[#FCA5A5]">{error}</motion.div>
          )}

          <div className="min-h-[230px] relative">
            <StepPanel stepKey={step} direction={dir}>
              {step === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Nombre de tu negocio *" full><input className="field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Panadería La Espiga" /></Field>
                  <Field label="Razón comercial"><input className="field" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Nombre legal (opcional)" /></Field>
                  <Field label="País">
                    <Select value={form.country} onChange={v => set('country', v)} placeholder="—" options={COUNTRIES.map(([c, n]) => ({ value: c, label: `${flagOf(c)} ${n}` }))} />
                  </Field>
                  {!!services.length && (
                    <Field label="¿Qué te interesa?" full>
                      <Select value={form.interested_service} onChange={v => set('interested_service', v)} placeholder="Elegí un servicio (opcional)" options={services.map(s => ({ value: s.id, label: s.name }))} />
                    </Field>
                  )}
                </div>
              )}
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Tu nombre"><input className="field" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Nombre y apellido" /></Field>
                  <Field label="Teléfono"><input className="field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+54 9 11…" /></Field>
                  <Field label="Correo * (también será tu usuario)" full><input type="email" className="field" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@tuempresa.com" /></Field>
                  <Field label="Sitio web" full><input className="field" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://tuempresa.com" /></Field>
                  <Field label="Instagram"><input className="field" value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@cuenta" /></Field>
                  <Field label="Facebook"><input className="field" value={form.facebook} onChange={e => set('facebook', e.target.value)} placeholder="/pagina" /></Field>
                </div>
              )}
              {step === 2 && (
                <div className="flex flex-col gap-3.5">
                  <Field label="Contraseña *" full>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} className="field pr-10" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70">
                        {showPass
                          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.4M6.5 6.9C4.2 8.4 3 10.6 3 12c0 2.5 4 7 9 7a9.6 9.6 0 003.4-.6" /></svg>
                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" /><circle cx="12" cy="12" r="2.5" /></svg>}
                      </button>
                    </div>
                  </Field>
                  <Field label="Repetir contraseña *" full><input type={showPass ? 'text' : 'password'} className="field" value={form.passwordConfirm} onChange={e => set('passwordConfirm', e.target.value)} placeholder="Repetí tu contraseña" /></Field>
                  <p className="text-[11.5px] text-white/35 -mt-1">Con esto vas a poder entrar a tu portal las veces que quieras, cuando quieras.</p>
                </div>
              )}
            </StepPanel>
          </div>

          <div className="flex justify-between gap-2.5 mt-6">
            <button className="btn-ghost" style={{ visibility: step === 0 ? 'hidden' : 'visible' }} onClick={() => go(-1)}>← Atrás</button>
            <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={saving} onClick={() => go(1)}>
              {saving ? 'Creando tu cuenta…' : step === STEPS.length - 1 ? 'Crear mi cuenta ✦' : 'Siguiente →'}
            </motion.button>
          </div>
        </motion.main>
      )}

      {/* ── Éxito ── */}
      {status === 'success' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 text-center px-6 max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.1 }}>
            <LocalLogo size={68} />
          </motion.div>
          <motion.div className="relative w-20 h-20 mx-auto -mt-2 mb-1" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.35, type: 'spring', stiffness: 260 }}>
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="absolute inset-0 rounded-full border border-violet-light/50"
                initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, delay: 0.5 + i * 0.35, ease: 'easeOut' }} />
            ))}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-[26px] font-extrabold tracking-tight mt-3">
            ¡Felicitaciones por unirte a <span className="text-gradient">Mateo Estudio OS</span>!
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }} className="text-[13.5px] text-white/50 mt-3 leading-relaxed">
            Tu cuenta ya está lista. Iniciá sesión con el correo y la contraseña que acabás de crear para entrar a tu portal.
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.78 }}
            whileTap={{ scale: 0.97 }} className="btn-glass mt-7" onClick={() => nav('/')}>
            Iniciar sesión
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}
