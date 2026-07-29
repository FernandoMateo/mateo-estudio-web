import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { list, createRec, fmtByCurrency } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { PHASE_ORDER, PHASES } from '../lib/constants'
import ProjectFiles from './ProjectFiles'
import TaskComments from './TaskComments'

const STATUS_GLOW = { en_progreso: '#8B5CF6', propuesta: '#60A5FA', pausado: '#FBBF24', completado: '#34D399', cancelado: '#FB7185' }

function ProgressRing({ pct, glow, size = 118 }) {
  const r = size / 2 - 9, C = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={glow} strokeWidth="7" strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', filter: `drop-shadow(0 0 6px ${glow})` }}
          initial={{ strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${(pct / 100) * C} ${C}` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-extrabold">{pct}%</span>
      </div>
    </div>
  )
}

/**
 * canManage: true para admin/equipo — habilita subir archivos, ver presupuesto y crear tareas nuevas.
 * clientName: nombre del cliente a mostrar (el admin ve varios clientes distintos).
 * onEdit: si se pasa, muestra un botón "Editar" que dispara esta función (abre el formulario completo).
 */
export default function ProjectWorkspace({ project, onClose, canManage = false, clientName, onEdit }) {
  const toast = useToast()
  const TABS = canManage ? [['resumen', 'Resumen'], ['archivos', 'Archivos'], ['tareas', 'Tareas']] : [['resumen', 'Resumen'], ['archivos', 'Archivos'], ['tareas', 'Tareas']]
  const [tab, setTab] = useState('resumen')
  const [tasks, setTasks] = useState([])
  const [expandedTask, setExpandedTask] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const glow = STATUS_GLOW[project?.status] || '#8B5CF6'

  const loadTasks = () => project && list('tasks', '&filter=' + encodeURIComponent(`project="${project.id}"`) + '&sort=-created').then(setTasks).catch(() => setTasks([]))

  useEffect(() => {
    if (!project) return
    setTab('resumen'); setExpandedTask(null); setNewTaskTitle('')
    loadTasks()
  }, [project?.id])

  async function addTask() {
    if (!newTaskTitle.trim() || !project) return
    setAddingTask(true)
    try {
      await createRec('tasks', { title: newTaskTitle.trim(), project: project.id, client: project.client || '', status: 'pendiente', priority: 'media' })
      setNewTaskTitle(''); toast('✦ Tarea agregada'); loadTasks()
    } catch { toast('No se pudo crear la tarea.', true) } finally { setAddingTask(false) }
  }

  if (!project) return null

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] bg-ink overflow-y-auto">
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute w-[70vw] h-[70vw] rounded-full blur-[130px] opacity-40" style={{ top: '-25%', left: '-20%', background: `radial-gradient(circle, ${glow}, transparent 65%)` }} />
          </div>

          <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
            className="max-w-[720px] mx-auto px-4 sm:px-6 pt-6 pb-16">
            <div className="flex items-center justify-between mb-5 gap-3">
              <button onClick={onClose} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/50 hover:text-white transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                Volver
              </button>
              {canManage && onEdit && (
                <button onClick={() => onEdit(project)} className="btn-ghost !py-1.5 !px-3 text-[12px]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                  Editar
                </button>
              )}
            </div>

            <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap mb-2">
              <ProgressRing pct={Math.max(0, Math.min(100, Number(project.progress) || 0))} glow={glow} />
              <div className="flex-1 min-w-0 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: glow, background: `${glow}18`, border: `1px solid ${glow}40` }}>
                  {(project.status || 'propuesta').replace('_', ' ')}
                </span>
                <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight mt-2 leading-tight break-words">{project.name}</h1>
                {clientName && <p className="text-[12.5px] text-white/40 mt-1">{clientName}</p>}
                <div className="flex gap-4 mt-2 text-[11.5px] text-white/40 flex-wrap">
                  {project.start_date && <span>Inicio: <b className="text-white/70">{project.start_date.slice(0, 10)}</b></span>}
                  {project.due_date && <span>Entrega: <b className="text-white/70">{project.due_date.slice(0, 10)}</b></span>}
                  {canManage && project.budget != null && project.budget > 0 && (
                    <span>Presupuesto: <b className="text-white/70">{fmtByCurrency(project.budget, project.budget_currency)}</b></span>
                  )}
                </div>
              </div>
            </div>

            <nav className="flex gap-1.5 mt-7 mb-6 sticky top-0 py-2 -mx-1 px-1 z-10" style={{ background: 'linear-gradient(180deg, rgba(5,5,8,.95), rgba(5,5,8,.75) 80%, transparent)', backdropFilter: 'blur(6px)' }}>
              {TABS.map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`relative text-[12.5px] font-bold px-4 py-2 rounded-full transition-colors ${tab === key ? 'text-white' : 'text-white/45 hover:text-white/75'}`}>
                  {tab === key && (
                    <motion.span layoutId={canManage ? 'admin-workspace-tab' : 'workspace-tab'} transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                      className="absolute inset-0 -z-10 rounded-full" style={{ background: `linear-gradient(135deg, ${glow}cc, ${glow}66)`, boxShadow: `0 0 18px ${glow}55` }} />
                  )}
                  {label}{key === 'tareas' && tasks.length > 0 && <span className="ml-1.5 opacity-70">({tasks.length})</span>}
                </button>
              ))}
            </nav>

            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              {tab === 'resumen' && (
                <div>
                  {project.description && <p className="text-[13.5px] text-white/55 leading-relaxed mb-6">{project.description}</p>}
                  <div className="text-[10.5px] uppercase font-bold tracking-[.1em] text-white/35 mb-3">Fase actual</div>
                  <div className="relative flex justify-between mx-1.5 mb-2">
                    <div className="absolute top-[14px] left-[24px] right-[24px] h-[2px] bg-white/[.07] rounded overflow-hidden">
                      <motion.div className="h-full rounded" style={{ background: `linear-gradient(90deg, ${glow}66, ${glow})`, boxShadow: `0 0 12px ${glow}` }}
                        initial={{ width: 0 }} animate={{ width: `${(PHASE_ORDER.indexOf(project.phase) / (PHASE_ORDER.length - 1)) * 100}%` }} transition={{ duration: 1 }} />
                    </div>
                    {PHASE_ORDER.map((ph, i) => {
                      const idx = PHASE_ORDER.indexOf(project.phase)
                      const done = idx > i, active = idx === i
                      return (
                        <div key={ph} className="relative z-10 flex flex-col items-center gap-1.5 w-9 sm:w-16">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0"
                            style={active ? { background: glow, borderColor: glow, boxShadow: `0 0 14px ${glow}` } : done ? { borderColor: `${glow}80`, color: glow, background: `${glow}20` } : { borderColor: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.3)' }}>
                            {done ? '✓' : i + 1}
                          </div>
                          <span className="hidden sm:block text-[9px] uppercase font-bold tracking-wider text-center text-white/40">{PHASES[ph]}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {tab === 'archivos' && <ProjectFiles projectId={project.id} canManage={canManage} projectName={project.name} />}

              {tab === 'tareas' && (
                <div>
                  {canManage && (
                    <div className="flex gap-2 mb-4">
                      <input className="field flex-1" placeholder="Nueva tarea para este proyecto…" value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
                      <button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()} className="btn-glass !px-3.5 disabled:opacity-40">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </div>
                  )}
                  {!tasks.length ? (
                    <p className="text-[12.5px] text-white/35">Todavía no hay tareas ligadas a este proyecto.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {tasks.map(t => (
                        <div key={t.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.08)' }}>
                          <button onClick={() => setExpandedTask(id => id === t.id ? null : t.id)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-white/[.03] transition-colors">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'completada' ? 'bg-mint' : 'bg-violet-light'}`} />
                            <span className={`flex-1 min-w-0 text-[13px] truncate ${t.status === 'completada' ? 'line-through text-white/40' : ''}`}>{t.title}</span>
                            <svg className={`w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform ${expandedTask === t.id ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
                          </button>
                          {expandedTask === t.id && (
                            <div className="px-3.5 pb-3.5 pt-1">
                              {t.description && <p className="text-[12px] text-white/45 mb-3">{t.description}</p>}
                              <TaskComments taskId={t.id} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
    </motion.div>
  )
}
