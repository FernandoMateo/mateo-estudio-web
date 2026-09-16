import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  throw new Error('Faltan PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD en el .env del agente.')
}

export const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

let authing = null

/** Autentica como superusuario. Se reintenta sola si el token vence (PocketBase los emite por ~ días). */
export async function ensureAuth() {
  if (pb.authStore.isValid) return
  if (authing) return authing
  authing = pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
    .finally(() => { authing = null })
  await authing
  console.log('[pocketbase] autenticado como', PB_ADMIN_EMAIL)
}

/** Envuelve cualquier llamada a la SDK re-autenticando una vez si hace falta. */
export async function withAuth(fn) {
  await ensureAuth()
  try {
    return await fn(pb)
  } catch (err) {
    if (err?.status === 401) {
      pb.authStore.clear()
      await ensureAuth()
      return await fn(pb)
    }
    throw err
  }
}
