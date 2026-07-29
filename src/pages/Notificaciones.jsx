import { useNavigate } from 'react-router-dom'
import NotificationsList from '../components/NotificationsList'

export default function Notificaciones() {
  const nav = useNavigate()

  function handleNavigate(n) {
    if (n.task) nav('/app/tareas')
    else if (n.project) nav('/app/proyectos')
    else if (n.type === 'pago') nav('/app/cotizador')
    else if (n.client) nav('/app/clientes')
  }

  return (
    <div>
      <h2 className="text-[19px] font-extrabold tracking-tight mb-5">Notificaciones</h2>
      <NotificationsList onNavigate={handleNavigate} />
    </div>
  )
}
