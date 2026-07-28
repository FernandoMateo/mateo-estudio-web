import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, removeRec, fileUrl, logActivity } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { Select } from './ui'

const CATEGORY_META = {
  brief: { label: 'Brief', color: '#60A5FA' },
  contrato: { label: 'Contrato', color: '#FBBF24' },
  entregable: { label: 'Entregable', color: '#34D399' },
  otro: { label: 'Otro', color: '#A78BFA' },
}
const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, v]) => ({ value, label: v.label }))

function iconFor(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return '🖼️'
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
  if (['zip', 'rar'].includes(ext)) return '🗜️'
  return '📎'
}

/** canManage=true (admin/equipo): puede subir y borrar. false (cliente): solo ve y descarga. */
export default function ProjectFiles({ projectId, canManage, projectName }) {
  const toast = useToast()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('otro')
  const inputRef = useRef(null)

  const load = () => list('project_files', '&filter=' + encodeURIComponent(`project="${projectId}"`) + '&sort=-created')
    .then(setFiles).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [projectId])

  async function handlePick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('project', projectId)
      fd.append('name', name.trim() || f.name)
      fd.append('category', category)
      fd.append('file', f)
      await createRec('project_files', fd, true)
      logActivity({ action: 'crear', entity: 'archivo', entity_name: name.trim() || f.name, summary: projectName ? `en el proyecto "${projectName}"` : '' })
      setName(''); toast('✦ Archivo subido'); load()
    } catch { toast('No se pudo subir el archivo.', true) }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = '' }
  }

  async function del(f) {
    if (!confirm(`¿Eliminar "${f.name}"?`)) return
    try { await removeRec('project_files', f.id); toast('Archivo eliminado ✓'); load() }
    catch { toast('No se pudo eliminar.', true) }
  }

  return (
    <div>
      {canManage && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input className="field flex-1" placeholder="Nombre del archivo (opcional)" value={name} onChange={e => setName(e.target.value)} />
          <div className="w-full sm:w-[130px]"><Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} /></div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-glass justify-center whitespace-nowrap disabled:opacity-50">
            {uploading ? 'Subiendo…' : 'Subir archivo'}
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={handlePick} />
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-white/35">Cargando…</p>
      ) : !files.length ? (
        <p className="text-[12px] text-white/35">{canManage ? 'Todavía no subiste ningún archivo para este proyecto.' : 'Tu equipo de Mateo Estudio todavía no subió archivos acá.'}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((f, i) => {
            const meta = CATEGORY_META[f.category] || CATEGORY_META.otro
            return (
              <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                <span className="text-[18px] flex-shrink-0">{iconFor(f.file)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{f.name}</div>
                  <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <a href={fileUrl('project_files', f.id, f.file)} target="_blank" rel="noopener" title="Descargar"
                  className="p-1.5 text-white/40 hover:text-violet-light transition-colors flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
                </a>
                {canManage && (
                  <button onClick={() => del(f)} title="Eliminar" className="p-1.5 text-white/25 hover:text-coral transition-colors flex-shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
