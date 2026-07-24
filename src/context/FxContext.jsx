import { createContext, useContext, useEffect, useState } from 'react'

const FxCtx = createContext({ rates: null, loading: true })
export const useFx = () => useContext(FxCtx)

// Tasa usada para "congelar" montos en USD -> ARS: el dólar cripto (USDT),
// que es la referencia real de conversión que se usa en Argentina.
export function usdToArs(rates) {
  return rates?.usdtArs || rates?.oficialArs || null
}

export function FxProvider({ children }) {
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function load() {
      // 1) Fuente primaria: dolarapi.com (Argentina, sin key, ARS nativo)
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares')
        const data = await res.json()
        if (Array.isArray(data) && data.length) {
          const oficial = data.find(d => d.casa === 'oficial')
          const cripto = data.find(d => d.casa === 'cripto')
          const tarjeta = data.find(d => d.casa === 'tarjeta')
          const usdtArs = cripto?.venta || null
          const oficialArs = oficial?.venta || tarjeta?.venta || null
          if (usdtArs || oficialArs) {
            // Complementamos con USDC vía CoinGecko (dolarapi no discrimina USDC)
            let usdcArs = usdtArs
            try {
              const cg = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd').then(r => r.json())
              const usdcUsd = cg?.['usd-coin']?.usd
              if (usdcUsd && usdtArs) usdcArs = usdtArs * usdcUsd
            } catch {}
            if (alive) setRates({ usdtArs, usdcArs, oficialArs, live: true, source: 'dolarapi.com' })
            return
          }
        }
        throw new Error('sin datos dolarapi')
      } catch {
        // 2) Fallback: CoinGecko directo en ARS
        try {
          const cg = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin&vs_currencies=ars').then(r => r.json())
          const usdtArs = cg?.tether?.ars, usdcArs = cg?.['usd-coin']?.ars
          if (usdtArs || usdcArs) {
            if (alive) setRates({ usdtArs, usdcArs, oficialArs: usdtArs, live: true, source: 'CoinGecko' })
            return
          }
          throw new Error('sin datos coingecko')
        } catch {
          // 3) Último recurso: valores de referencia offline
          if (alive) setRates({ usdtArs: 1195, usdcArs: 1195, oficialArs: 1045, live: false, source: 'referencia' })
        }
      }
    }

    load().finally(() => { if (alive) setLoading(false) })
    const id = setInterval(load, 5 * 60 * 1000) // refresca cada 5 min
    return () => { alive = false; clearInterval(id) }
  }, [])

  return <FxCtx.Provider value={{ rates, loading }}>{children}</FxCtx.Provider>
}
