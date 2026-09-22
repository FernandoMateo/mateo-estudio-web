import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { list, createRec, updateRec, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { ModuleHead, EmptyState } from '../components/ui'

// Sugerencias rápidas: instrucciones típicas que Fer puede querer agregarle al agente
// con un solo click, sin tener que redactarlas desde cero.
const SUGGESTIONS = [
  'Sé más informal, tratá a todos de "vos" y usá algún emoji suelto.',
  'Nunca des precios exactos por Telegram — decí que consulten con Fer directamente.',
  'Si preguntan por un cliente que no encontrás, sugerí revisar cómo está escrito el nombre.',
  'Los viernes, al final de cualquier respuesta, recordá que el fin de semana no hay soporte.',
]

export default function IA() {
  const { me } = useOutletContext()
  const toast = useToast()
  const [recId, setRecId] = useState(null)
  const [value, setValue] = useState('')
  const [original, setOriginal] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    list('ai_settings', '&sort=-updated')
      .then(rows => {
        const row = rows[0]
        setRecId(row?.id || null)
        setValue(row?.extra_instructions || '')
        setOriginal(row?.extra_instructions || '')
        setUpdatedAt(row?.updated || null)
      })
      .catch(() => { /* la colección puede no existir todavía — no rompemos la pantalla */ })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const dirty = value !== original

  async function save() {
    setSaving(true)
    try {
      if (recId) await updateRec('ai_settings', recId, { extra_instructions: value })
      else {
        const rec = await createRec('ai_settings', { extra_instructions: value })
        setRecId(rec.id)
      }
      logActivity({ action: 'actualizar', entity: 'agente IA', entity_name: 'Instrucciones del agente' })
      setOriginal(value)
      setUpdatedAt(new Date().toISOString())
      toast('✦ El agente ya aprendió esto — se aplica en su próxima respuesta')
    } catch {
      toast('No se pudo guardar. Puede que la colección "ai_settings" todavía no exista en PocketBase.', true)
    } finally { setSaving(false) }
  }

  function addSuggestion(s) {
    setValue(v => (v.trim() ? v.trim() + '\n- ' + s : '- ' + s))
  }

  return (
    <div>
      <ModuleHead title="Herramienta IA" count="Entrená al agente" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div className="card !p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-[11px] flex-shrink-0 bg-violet/[.14] border border-violet-light/30 flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-violet-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="9" cy="11" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.4" fill="currentColor" stroke="none"/><path d="M8.5 15c1 .8 2 1.2 3.5 1.2s2.5-.4 3.5-1.2"/><path d="M12 4V2"/></svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold">Instrucciones adicionales para la IA del estudio</h3>
              <p className="text-[12px] text-white/40 mt-0.5">Escribí en texto libre lo que quieras que tenga en cuenta siempre — tono, cosas que nunca debe decir, avisos fijos, prioridades. Se usa tanto en el agente de Telegram como al redactar propuestas comerciales en el módulo Propuestas.</p>
            </div>
          </div>

          {loading ? (
            <div className="h-40 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,.035)' }} />
          ) : (
            <textarea
              className="field min-h-[220px] leading-relaxed"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={'Ej:\n- Sé más informal y usá algún emoji suelto.\n- Nunca compartas precios exactos, derivá a Fer.\n- Priorizá siempre las tareas marcadas como "urgente".'}
            />
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-[11px] text-white/30">
              {updatedAt ? `Última actualización: ${new Date(updatedAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Todavía no le agregaste instrucciones extra.'}
            </p>
            <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" disabled={saving || !dirty} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar y entrenar ✦'}
            </motion.button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card !p-4">
            <h4 className="text-[12px] font-bold text-white/50 uppercase tracking-wide mb-3">Sugerencias rápidas</h4>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => addSuggestion(s)}
                  className="text-left text-[11.5px] text-white/55 hover:text-white bg-white/[.03] hover:bg-violet/[.10] border border-white/[.07] hover:border-violet-light/30 rounded-lg px-3 py-2.5 transition-colors">
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <div className="card !p-4">
            <h4 className="text-[12px] font-bold text-white/50 uppercase tracking-wide mb-2.5">Cómo aprende el agente</h4>
            <ul className="flex flex-col gap-2.5 text-[11.5px] text-white/45">
              <li className="flex gap-2"><span className="text-mint">●</span> Ya conoce clientes, proyectos, tareas, facturas, cotizador, servicios y todos los módulos del sistema — solo, sin que se lo tengas que explicar.</li>
              <li className="flex gap-2"><span className="text-mint">●</span> Cuando agregás una colección o campo nuevo en el dashboard, lo detecta solo en un rato (o al toque con /actualizar en Telegram).</li>
              <li className="flex gap-2"><span className="text-amber">●</span> Lo que escribas acá arriba es lo único que hay que redactar a mano — el resto lo infiere solo.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
