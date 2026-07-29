const SHELL_CACHE = 'mateo-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Las llamadas a la API de PocketBase NUNCA se cachean: los datos del negocio
  // (clientes, proyectos, cotizaciones, etc.) siempre tienen que venir frescos de la red.
  if (url.pathname.startsWith('/api/')) return

  // Solo intervenimos pedidos GET del mismo origen (el "cascarón" de la app: JS, CSS, imágenes, íconos).
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fresh = fetch(event.request)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then(cache => cache.put(event.request, copy))
          }
          return res
        })
        .catch(() => cached) // sin conexión: mostramos lo último guardado, si existe
      return cached || fresh
    })
  )
})
