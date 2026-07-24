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
import Portal from './pages/Portal'

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
            </Route>
            <Route path="/portal" element={<Portal />} />
          </Routes>
        </BrowserRouter>
      </FxProvider>
    </ToastProvider>
  )
}
