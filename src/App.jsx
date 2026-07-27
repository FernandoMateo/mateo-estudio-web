import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { FxProvider } from './context/FxContext'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Proyectos from './pages/Proyectos'
import Tareas from './pages/Tareas'
import Finanzas from './pages/Finanzas'
import Servicios from './pages/Servicios'
import Cotizador from './pages/Cotizador'
import Usuarios from './pages/Usuarios'
<<<<<<< HEAD
import Notificaciones from './pages/Notificaciones'
=======
>>>>>>> a9ede5ebefbd2796431aabcaa98c10b04e86995d
import Portal from './pages/Portal'
import Alta from './pages/Alta'

export default function App() {
  return (
    <ToastProvider>
      <FxProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="proyectos" element={<Proyectos />} />
              <Route path="tareas" element={<Tareas />} />
              <Route path="finanzas" element={<Finanzas />} />
              <Route path="servicios" element={<Servicios />} />
              <Route path="cotizador" element={<Cotizador />} />
              <Route path="usuarios" element={<Usuarios />} />
<<<<<<< HEAD
              <Route path="notificaciones" element={<Notificaciones />} />
=======
>>>>>>> a9ede5ebefbd2796431aabcaa98c10b04e86995d
            </Route>
            <Route path="/portal" element={<Portal />} />
            <Route path="/alta/:id" element={<Alta />} />
          </Routes>
        </BrowserRouter>
      </FxProvider>
    </ToastProvider>
  )
}
