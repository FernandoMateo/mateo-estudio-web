import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, removeRec, fileUrl, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'

function iconFor(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return '🖼️'
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  if (['zip', 'rar'].includes(ext)) return '🗜️'
  return '📎'
}

/** canDelete: si false, solo lectura (para cuando el admin mira los documentos de un cliente). */
export default function ClientDocuments({ clientId, canDelete = true }) {
  const toast = useToast()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  const load = () => list('client_documents', '&filter=' + encodeURIComponent(`client="${clientId}"`) + '&sort=-created')
    .then(setDocs).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [clientId])

  async function handlePick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('client', clientId)
      fd.append('name', name.trim() || f.name)
      fd.append('file', f)
      await createRec('client_documents', fd, true)
      logActivity({ action: 'crear', entity: 'documento', entity_name: name.trim() || f.name })
      setName(''); toast('✦ Documento subido'); load()
    } catch { toast('No se pudo subir el documento.', true) }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = '' }
  }

  async function del(d) {
    if (!confirm(`¿Eliminar "${d.name}"?`)) return
    try { await removeRec('client_documents', d.id); toast('Documento eliminado ✓'); load() }
    catch { toast('No se pudo eliminar.', true) }
  }

  return (
    <div>
      {canDelete && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input className="field flex-1" placeholder="Nombre del documento (opcional)" value={name} onChange={e => setName(e.target.value)} />
          <button onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-glass justify-center whitespace-nowrap disabled:opacity-50">
            {uploading ? 'Subiendo…' : 'Subir documento'}
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={handlePick} />
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-white/35">Cargando…</p>
      ) : !docs.length ? (
        <p className="text-[12px] text-white/35">Todavía no hay documentos cargados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <span className="text-[18px] flex-shrink-0">{iconFor(d.file)}</span>
              <div className="flex-1 min-w-0 text-[12.5px] font-medium truncate">{d.name}</div>
              <a href={fileUrl('client_documents', d.id, d.file)} target="_blank" rel="noopener" title="Descargar"
                className="p-1.5 text-white/40 hover:text-violet-light transition-colors flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
              </a>
              {canDelete && (
                <button onClick={() => del(d)} title="Eliminar" className="p-1.5 text-white/25 hover:text-coral transition-colors flex-shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
