import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useToast } from '../context/ToastContext'
import { auth } from '../lib/api' // Asumo que tienes una función de autenticación en api.js
import { Field } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) {
      toast('Ingresa tu correo y contraseña.', true)
      return
    }
    setLoading(true)
    try {
      // La lógica de PocketBase iría aquí, llamando a la función de autenticación
      const { record: user } = await auth(email, password)
      toast(`¡Bienvenido, ${user.name || user.email}!`)
      
      if (user.role === 'cliente') {
        navigate('/portal')
      } else {
        navigate('/app')
      }
    } catch (err) {
      toast('Las credenciales son incorrectas. Intenta de nuevo.', true)
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4">
      <motion.div
        className="card w-full max-w-sm"
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gradient">Mateo Estudio OS</h1>
          <p className="text-sm text-white/50 mt-1.5 mb-6">Inicia sesión para acceder a tu panel.</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Field label="Correo electrónico">
            <input type="email" className="field" placeholder="tu@correo.com" value={email}
              onChange={e => setEmail(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Contraseña">
            <input type="password" className="field" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} disabled={loading} />
          </Field>
          <button type="submit" className="btn-glass mt-3 w-full justify-center" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}