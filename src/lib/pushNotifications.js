import { list, getAuth } from './api'

/** Avisos del sistema operativo, mientras la app/PWA esté abierta (aunque sea en otra pestaña).
 *  Importante ser honestos: esto NO es "push" real — no llega si el navegador está totalmente
 *  cerrado. Para eso haría falta un servidor de push aparte (claves VAPID), que no tenemos.
 *  Con la app abierta de fondo, sí llega como una notificación real del sistema. */

export function notifSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifPermission() {
  return notifSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotifPermission() {
  if (!notifSupported()) return 'unsupported'
  try { return await Notification.requestPermission() } catch { return 'denied' }
}

export async function showBrowserNotification(title, body, data = {}) {
  if (!notifSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg?.showNotification) {
      reg.showNotification(title, { body, icon: '/img/logo.png', badge: '/img/logo.png', data, tag: data.notifId || undefined })
    } else {
      new Notification(title, { body, icon: '/img/logo.png' })
    }
  } catch { /* si falla, no rompe nada más */ }
}

const LAST_KEY = 'mateo_last_notif_check'

/** Revisa periódicamente si hay notificaciones nuevas para este usuario y, si hay permiso
 *  concedido, las muestra como avisos del sistema. Se llama una vez y se limpia con el cleanup. */
export function startNotificationPolling(intervalMs = 45000) {
  let stopped = false
  let lastCheck = localStorage.getItem(LAST_KEY) || new Date(Date.now() - 60000).toISOString()

  async function tick() {
    if (stopped) return
    const me = getAuth()?.record
    if (!me) return
    if (Notification.permission === 'granted') {
      try {
        const fresh = await list('notifications', '&filter=' + encodeURIComponent(`user="${me.id}" && created > "${lastCheck}"`) + '&sort=-created')
        for (const n of fresh) {
          await showBrowserNotification(n.title, n.message || '', { notifId: n.id })
        }
      } catch { /* silencioso */ }
    }
    lastCheck = new Date().toISOString()
    localStorage.setItem(LAST_KEY, lastCheck)
  }

  tick()
  const id = setInterval(tick, intervalMs)
  return () => { stopped = true; clearInterval(id) }
}
