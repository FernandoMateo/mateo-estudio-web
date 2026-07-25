import { Navigate, useLocation } from 'react-router-dom'
import { getAuth } from '../lib/api'

export default function ProtectedRoute({ children, allowedRoles }) {
  const authData = getAuth()
  const location = useLocation()

  if (!authData?.token || !authData?.record) {
    // 1. Si el usuario no está logueado, se va al login.
    return <Navigate to="/" state={{ from: location }} replace />
  }

  const userRole = authData.record.role

  // 2. Si la ruta requiere roles específicos, los validamos.
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Si el usuario no tiene el rol permitido, lo redirigimos
    // a la sección que le corresponde.
    if (userRole === 'cliente') {
      return <Navigate to="/portal" replace />
    }
    if (userRole === 'admin' || userRole === 'equipo') {
      return <Navigate to="/app" replace />
    }
    // Como fallback, si su rol no coincide con nada, al login.
    return <Navigate to="/" replace />
  }

  // 3. Si todo está en orden, mostramos la página.
  return children
}