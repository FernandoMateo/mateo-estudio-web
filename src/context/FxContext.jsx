import { createContext, useContext, useEffect, useState } from 'react'

const FxCtx = createContext({ rates: null, loading: true })
export const useFx = () => useContext(FxCtx)

// Tasa usada para "congelar" montos en USD -> ARS: el dólar cripto (USDT),
// que es la referencia real de conversión que se usa en Argentina.
export function usdToArs(rates) {
  return rates?.usdtArs || rates?.oficialArs || null
}

// Convierte cualquier monto de "currency" (ARS/USD/MXN) a su equivalente en ARS.
// El USD y el MXN se puentean por el dólar cripto/oficial disponible.
export function toArs(amount, currency, rates) {
  const n = Number(amount) || 0
  if (!currency || currency === 'ARS') return n
  const usdArs = usdToArs(rates)
  if (currency === 'USD') return usdArs ? n * usdArs : n
  if (currency === 'MXN') {
    const usdMxn = rates?.usdMxn
    if (usdMxn && usdArs) return (n / usdMxn) * usdArs
    return n
  }
  return n
}

// Convierte entre dos monedas cualquiera, puenteando por ARS.
export function convertAmount(amount, from, to, rates) {
  if (from === to) return Number(amount) || 0
  const ars = toArs(amount, from, rates)
  if (to === 'ARS') return ars
  const usdArs = usdToArs(rates)
  if (to === 'USD') return usdArs ? ars / usdArs : ars
  if (to === 'MXN') {
    const usdMxn = rates?.usdMxn
    if (usdMxn && usdArs) return (ars / usdArs) * usdMxn
    return ars
  }
  return ars
}

export function FxProvider({ children }) {
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function load() {
      let usdtArs = null, usdcArs = null, oficialArs = null, usdMxn = null, live = false, source = ''

      // 1) Fuente primaria: dolarapi.com (Argentina, sin key, ARS nativo)
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares')
        const data = await res.json()
        if (Array.isArray(data) && data.length) {
          const oficial = data.find(d => d.casa === 'oficial')
          const cripto = data.find(d => d.casa === 'cripto')
          const tarjeta = data.find(d => d.casa === 'tarjeta')
          usdtArs = cripto?.venta || null
          oficialArs = oficial?.venta || tarjeta?.venta || null
          if (usdtArs || oficialArs) { live = true; source = 'dolarapi.com' }
        }
      } catch {}

      // 2) USDC + dólar/peso mexicano vía CoinGecko + open.er-api.com (siempre se intenta, complementa lo anterior)
      try {
        const [cg, er] = await Promise.all([
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin&vs_currencies=usd,ars').then(r => r.json()),
          fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()),
        ])
        usdMxn = er?.rates?.MXN || null
        if (!usdtArs) { usdtArs = cg?.tether?.ars || null; if (usdtArs) { live = true; source = 'CoinGecko' } }
        if (!oficialArs) oficialArs = er?.rates?.ARS || usdtArs
        const usdcUsd = cg?.['usd-coin']?.usd
        usdcArs = (usdtArs && usdcUsd) ? usdtArs * usdcUsd : usdtArs
      } catch {}

      if (!usdtArs && !oficialArs) {
        // 3) Último recurso: valores de referencia offline
        usdtArs = 1195; usdcArs = 1195; oficialArs = 1045; usdMxn = usdMxn || 18.5; live = false; source = 'referencia'
      }
      if (alive) setRates({ usdtArs, usdcArs, oficialArs, usdMxn, live, source: source || 'referencia' })
    }

    load().finally(() => { if (alive) setLoading(false) })
    const id = setInterval(load, 5 * 60 * 1000) // refresca cada 5 min
    return () => { alive = false; clearInterval(id) }
  }, [])

  return <FxCtx.Provider value={{ rates, loading }}>{children}</FxCtx.Provider>
}
