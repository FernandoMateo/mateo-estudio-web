import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PB_URL, setAuth } from '../lib/api'
import Logo from '../components/Logo'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Escribe tu correo y tu contraseña para continuar.'); return }
    setLoading(true)
    try {
      const res = await fetch(`${PB_URL}/api/collections/users/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError('Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.'); setLoading(false); return }
      setAuth({ token: data.token, record: data.record })

      nav((data.record?.role === 'cliente' || data.record?.role === 'colaborador') ? '/portal' : '/app')
=======
      nav(data.record?.role === 'cliente' ? '/portal' : '/app')
>>>>>>> 
    } catch {
      setError('No se pudo conectar con el servidor. Verifica tu conexión.')
      setLoading(false)
    }
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center overflow-hidden relative bg-[#04030A]">
      {/* Estelas de luz */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="t1" gradientUnits="userSpaceOnUse" x1="-80" y1="640" x2="1180" y2="180">
            <stop offset="0" stopColor="#8B5CF6" stopOpacity="0" /><stop offset=".72" stopColor="#8B5CF6" stopOpacity=".45" /><stop offset="1" stopColor="#C4B5FD" stopOpacity=".95" />
          </linearGradient>
          <linearGradient id="t2" gradientUnits="userSpaceOnUse" x1="1520" y1="760" x2="260" y2="520">
            <stop offset="0" stopColor="#7C3AED" stopOpacity="0" /><stop offset=".7" stopColor="#7C3AED" stopOpacity=".3" /><stop offset="1" stopColor="#A78BFA" stopOpacity=".8" />
          </linearGradient>
          <linearGradient id="t3" gradientUnits="userSpaceOnUse" x1="-120" y1="140" x2="900" y2="60">
            <stop offset="0" stopColor="#8B5CF6" stopOpacity="0" /><stop offset=".75" stopColor="#8B5CF6" stopOpacity=".22" /><stop offset="1" stopColor="#C4B5FD" stopOpacity=".6" />
          </linearGradient>
          <filter id="halo" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7" /></filter>
          <radialGradient id="head1"><stop offset="0" stopColor="#E9D5FF" stopOpacity=".9" /><stop offset="1" stopColor="#8B5CF6" stopOpacity="0" /></radialGradient>
        </defs>
        <path d="M -80 640 C 320 560, 640 300, 1180 180" stroke="url(#t1)" strokeWidth="7" fill="none" filter="url(#halo)" opacity=".55" />
        <path d="M -80 640 C 320 560, 640 300, 1180 180" stroke="url(#t1)" strokeWidth="1.6" fill="none" />
        <circle cx="1180" cy="180" r="26" fill="url(#head1)" />
        <path d="M 1520 760 C 1080 780, 640 660, 260 520" stroke="url(#t2)" strokeWidth="6" fill="none" filter="url(#halo)" opacity=".45" />
        <path d="M 1520 760 C 1080 780, 640 660, 260 520" stroke="url(#t2)" strokeWidth="1.3" fill="none" />
        <path d="M -120 140 C 260 40, 560 130, 900 60" stroke="url(#t3)" strokeWidth="5" fill="none" filter="url(#halo)" opacity=".4" />
        <path d="M -120 140 C 260 40, 560 130, 900 60" stroke="url(#t3)" strokeWidth="1.1" fill="none" />
      </svg>

      {/* Dot grid + grano + vignette */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <svg className="fixed inset-0 w-full h-full pointer-events-none opacity-[.055] mix-blend-overlay" aria-hidden>
        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)' }} />

      <div className="fixed top-6 left-8 text-[11px] font-semibold tracking-[.32em] text-white/55 select-none z-10">MATEO&nbsp;ESTUDIO</div>

      <div className="fixed w-[42vw] h-[42vw] rounded-full blur-[110px] pointer-events-none animate-aurora"
        style={{ top: '38%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(139,92,246,.22), transparent 65%)' }} />

      <motion.main
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 0.8, 0.3, 1] }}
        className="relative z-10 w-[min(396px,92vw)] rounded-[18px] px-8 pt-9 pb-8"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015))',
          border: '1px solid rgba(167,139,250,.18)',
          backdropFilter: 'blur(22px)',
          boxShadow: '0 24px 70px rgba(0,0,0,.6), 0 0 60px rgba(139,92,246,.08), inset 0 1px 0 rgba(255,255,255,.05)',
        }}
      >
        <div className="w-[58px] h-[58px] mx-auto mb-4 flex items-center justify-center rounded-xl bg-white/5 border border-violet-light/[.22] backdrop-blur-md shadow-[0_0_22px_rgba(139,92,246,.18)]">
          <Logo size={48} />
        </div>

        <h1 className="text-[19px] font-semibold text-center tracking-tight">Bienvenido de vuelta</h1>
        <p className="text-[13px] text-white/55 text-center mt-1.5 mb-6">Ingresa a tu espacio de trabajo</p>

        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-3.5 px-3.5 py-2.5 rounded-lg bg-coral/[.08] border border-coral/30 text-[12.5px] text-[#FCA5A5] leading-relaxed" role="alert">
            {error}
          </motion.div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="relative mb-3.5">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" autoComplete="username" className="field pl-10" />
          </div>
          <div className="relative mb-3.5">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" autoComplete="current-password" className="field pl-10" />
          </div>
          <motion.button whileTap={{ scale: 0.985 }} disabled={loading} type="submit" className="btn-glass w-full justify-center py-3 group">
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
            {!loading && (
              <span className="opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition inline-flex">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
              </span>
            )}
          </motion.button>
        </form>

        <p className="mt-5 text-center text-[11px] text-white/30 tracking-wide">Acceso exclusivo · Mateo Estudio</p>
      </motion.main>

      <div className="fixed bottom-5 right-7 flex items-center gap-2 text-[11px] text-white/55 z-10">
        <motion.span animate={{ opacity: [1, 0.45, 1] }} transition={{ duration: 2.4, repeat: Infinity }}
          className="w-[7px] h-[7px] rounded-full bg-mint shadow-[0_0_8px_rgba(52,211,153,.8)]" />
        Sistema en línea
      </div>
    </div>
  )
}
