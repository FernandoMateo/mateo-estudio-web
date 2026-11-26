import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AuroraBackground from '../components/AuroraBackground'
import SharedLogo from '../components/Logo'
import { Stepper, StepPanel, Field } from '../components/ui'

/* ───────────────────────────────────────────────────────────────
   Evaluación de negocio — diagnóstico de tareas tediosas y problemas
   para proponer soluciones de sistemas. Al terminar, arma un mensaje
   y lo abre en WhatsApp hacia el número del estudio.
   Página pública (/evaluacion): se puede compartir con el cliente o
   completarla junto a él en una reunión. Guarda un borrador local.
   ─────────────────────────────────────────────────────────────── */

const WHATSAPP_NUMBER = '5493512128116' // +54 9 351 212-8116
const DRAFT_KEY = 'mateo-evaluacion-borrador-v1'

const STEPS = ['Negocio', 'Operación', 'Tareas', 'Problemas', 'Notas', 'Enviar']

const RUBROS = ['Comercio / Retail', 'Gastronomía', 'Salud / Estética', 'Servicios profesionales', 'Construcción / Inmobiliaria', 'Educación', 'Industria / Fábrica', 'Logística / Distribución', 'Otro']
const EMPLEADOS = ['Solo yo', '2 a 5', '6 a 15', '16 a 50', 'Más de 50']
const HERRAMIENTAS = ['Papel / cuaderno', 'Excel / Google Sheets', 'WhatsApp', 'Email', 'Sistema de gestión', 'Sistema propio', 'Mercado Pago / POS', 'Redes sociales', 'Nada en particular']
const AREAS = ['Ventas', 'Stock / Inventario', 'Turnos / Agenda', 'Facturación', 'Cobranzas', 'Atención al cliente', 'Pedidos / Envíos', 'Proveedores / Compras', 'Personal / Sueldos', 'Marketing', 'Reportes / Números']
const DOLORES = [
  'Pierdo tiempo cargando datos a mano', 'Respondo las mismas consultas una y otra vez', 'No sé cuánto gano realmente',
  'Se me pierden pedidos o mensajes', 'Errores en stock o precios', 'Me cuesta cobrar a tiempo',
  'Todo depende de mí', 'La información está desparramada', 'Los clientes no vuelven', 'No tengo reportes claros',
]
const FRECUENCIAS = ['Varias veces al día', 'Diaria', 'Semanal', 'Mensual']
const URGENCIAS = [
  { v: 'Ya mismo', d: 'Me está costando plata hoy' },
  { v: 'Este mes', d: 'Quiero arrancar pronto' },
  { v: 'Próximos meses', d: 'Lo estoy evaluando' },
  { v: 'Solo explorando', d: 'Quiero ver opciones' },
]
const PRESUPUESTOS = ['A definir', 'Bajo', 'Medio', 'Alto']

const newTask = () => ({ id: Math.random().toString(36).slice(2), desc: '', area: '', freq: '', hours: '', impact: 3 })
const emptyForm = {
  business: '', rubro: '', contact: '', role: '', phone: '', email: '', city: '', employees: '',
  tools: [], areas: [], toolsOther: '',
  tasks: [newTask()],
  pains: [], mainProblem: '', dream: '', urgency: '', budget: '',
  notes: [], generalNotes: '',
}

function loadDraft() {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d ? { ...emptyForm, ...d } : emptyForm } catch { return emptyForm }
}

function LocalLogo({ size = 56 }) {
  return (
    <div className="relative flex items-center justify-center rounded-2xl flex-shrink-0" style={{ width: size, height: size, background: 'linear-gradient(135deg, rgba(139,92,246,.25), rgba(244,114,240,.15))', border: '1px solid rgba(167,139,250,.4)' }}>
      <SharedLogo size={size * 0.82} />
    </div>
  )
}

function Chips({ options, value, onChange, multi = true }) {
  const sel = multi ? value : [value]
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = sel.includes(o)
        return (
          <motion.button key={o} type="button" whileTap={{ scale: 0.95 }}
            onClick={() => multi ? onChange(on ? value.filter(x => x !== o) : [...value, o]) : onChange(on ? '' : o)}
            className={`px-3 py-[7px] rounded-full text-[12.5px] font-semibold border transition-all
              ${on ? 'text-white border-violet-light/70 bg-violet/[.28] shadow-[0_0_14px_rgba(139,92,246,.35)]'
                   : 'text-white/55 border-white/[.09] bg-white/[.03] hover:text-white hover:border-white/20'}`}>
            {on && multi ? '✓ ' : ''}{o}
          </motion.button>
        )
      })}
    </div>
  )
}

function SectionTitle({ title, hint }) {
  return (
    <div className="mb-4">
      <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      {hint && <p className="text-[12.5px] text-white/45 mt-1 leading-relaxed">{hint}</p>}
    </div>
  )
}

const fmtTime = ts => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/* ── Arma el texto final para WhatsApp ── */
function buildMessage(f) {
  const L = []
  const section = (title, items) => {
    const rows = items.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `• *${k}:* ${String(v).trim()}`)
    if (rows.length) L.push('', title, ...rows)
  }
  L.push('🟣 *EVALUACIÓN DE NEGOCIO — MATEO ESTUDIO*')
  L.push(`📅 ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`)
  section('🏢 *DATOS DEL NEGOCIO*', [['Negocio', f.business], ['Rubro', f.rubro], ['Contacto', f.contact], ['Cargo', f.role],
    ['Teléfono', f.phone], ['Email', f.email], ['Ciudad', f.city], ['Equipo', f.employees]])
  section('⚙️ *OPERACIÓN ACTUAL*', [['Herramientas que usa', [...f.tools, f.toolsOther].filter(Boolean).join(', ')], ['Áreas a mejorar', f.areas.join(', ')]])
  const tasks = f.tasks.filter(t => t.desc.trim())
  if (tasks.length) {
    L.push('', `⏳ *TAREAS TEDIOSAS (${tasks.length})*`)
    tasks.forEach((t, i) => {
      L.push(`${i + 1}. ${t.desc.trim()}`)
      const meta = [t.area && `Área: ${t.area}`, t.freq && `Frecuencia: ${t.freq}`, t.hours && `${t.hours} h/semana`, `Impacto: ${'🔥'.repeat(t.impact)} (${t.impact}/5)`].filter(Boolean)
      L.push(`   ${meta.join(' · ')}`)
    })
    const totalH = tasks.reduce((s, t) => s + (parseFloat(String(t.hours).replace(',', '.')) || 0), 0)
    if (totalH) L.push(`⏱️ *Total estimado: ${totalH} h/semana (~${Math.round(totalH * 4.3)} h/mes)*`)
  }
  section('🎯 *PROBLEMAS Y OBJETIVOS*', [['Dolores', f.pains.join(', ')], ['Problema principal', f.mainProblem], ['Resultado soñado', f.dream],
    ['Urgencia', f.urgency], ['Presupuesto', f.budget]])
  if (f.notes.length || f.generalNotes.trim()) {
    L.push('', '📝 *NOTAS*')
    f.notes.forEach(n => L.push(`• [${fmtTime(n.ts)}] ${n.text}`))
    if (f.generalNotes.trim()) L.push(f.generalNotes.trim())
  }
  L.push('', '— Enviado desde el formulario de evaluación de Mateo Estudio ✦')
  return L.join('\n')
}

export default function Evaluacion() {
  const nav = useNavigate()
  const [form, setForm] = useState(loadDraft)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch { /* sin almacenamiento */ } }, [form])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setTask = (id, k, v) => setForm(f => ({ ...f, tasks: f.tasks.map(t => t.id === id ? { ...t, [k]: v } : t) }))
  const addTask = () => setForm(f => ({ ...f, tasks: [...f.tasks, newTask()] }))
  const removeTask = id => setForm(f => ({ ...f, tasks: f.tasks.length > 1 ? f.tasks.filter(t => t.id !== id) : [newTask()] }))

  function addNote(text) {
    const t = (text ?? quickNote).trim()
    if (!t) return
    setForm(f => ({ ...f, notes: [...f.notes, { id: Date.now(), ts: Date.now(), text: t, step: STEPS[step] }] }))
    setQuickNote('')
  }
  const removeNote = id => setForm(f => ({ ...f, notes: f.notes.filter(n => n.id !== id) }))

  const message = useMemo(() => buildMessage(form), [form])
  const totalHours = form.tasks.reduce((s, t) => s + (parseFloat(String(t.hours).replace(',', '.')) || 0), 0)

  function go(delta) {
    if (delta > 0) {
      if (step === 0 && !form.business.trim()) { setError('Contanos el nombre del negocio para arrancar 🙌'); return }
      if (step === 0 && !form.contact.trim()) { setError('¿Con quién estamos hablando? Completá el nombre de contacto.'); return }
    }
    setError(''); setDir(delta)
    setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + delta)))
  }

  function sendWhatsApp() {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener')
    setSent(true)
  }

  async function copyMessage() {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignorar */ }
  }

  function resetAll() {
    if (!window.confirm('¿Empezar una evaluación nueva? Se borran los datos cargados.')) return
    setForm({ ...emptyForm, tasks: [newTask()] }); setStep(0); setSent(false); setError('')
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-ink">
      <AuroraBackground intense />

      <main className="relative z-10 w-[min(720px,100%)] mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-28">
        {/* Encabezado */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-7">
          <LocalLogo size={48} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[.14em] text-violet-light">Mateo Estudio · Diagnóstico</div>
            <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight leading-tight">
              Evaluemos tu <span className="text-gradient">negocio</span>
            </h1>
          </div>
          <button onClick={resetAll} className="btn-ghost !px-3 !py-2 text-[12px]" title="Nueva evaluación">↺ Nueva</button>
        </motion.header>

        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="rounded-[20px] px-5 sm:px-7 py-7"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015))', border: '1px solid rgba(167,139,250,.18)', backdropFilter: 'blur(22px)', boxShadow: '0 24px 70px rgba(0,0,0,.6), 0 0 60px rgba(139,92,246,.08)' }}>

          <Stepper steps={STEPS} current={step} />

          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-3.5 py-2.5 rounded-lg bg-coral/[.08] border border-coral/30 text-[12.5px] text-[#FCA5A5]">{error}</motion.div>
          )}

          <div className="min-h-[300px]">
            <StepPanel stepKey={step} direction={dir}>
              {/* 1 · Negocio */}
              {step === 0 && (
                <>
                  <SectionTitle title="Conozcamos el negocio" hint="Datos básicos para entender a quién le vamos a simplificar la vida." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Field label="Nombre del negocio *" full><input className="field" value={form.business} onChange={e => set('business', e.target.value)} placeholder="Ej. Ferretería El Tornillo" /></Field>
                    <Field label="Persona de contacto *"><input className="field" value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="Nombre y apellido" /></Field>
                    <Field label="Cargo"><input className="field" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Dueño, gerente…" /></Field>
                    <Field label="WhatsApp / Teléfono"><input className="field" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+54 9 351…" /></Field>
                    <Field label="Email"><input className="field" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@negocio.com" /></Field>
                    <Field label="Ciudad"><input className="field" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Córdoba" /></Field>
                    <Field label="¿Cuántas personas trabajan?">
                      <select className="field" value={form.employees} onChange={e => set('employees', e.target.value)}>
                        <option value="">—</option>{EMPLEADOS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Rubro" full><Chips multi={false} options={RUBROS} value={form.rubro} onChange={v => set('rubro', v)} /></Field>
                  </div>
                </>
              )}

              {/* 2 · Operación */}
              {step === 1 && (
                <div className="flex flex-col gap-6">
                  <div>
                    <SectionTitle title="¿Cómo trabajan hoy?" hint="Marcá todo lo que usan para gestionar el día a día." />
                    <Chips options={HERRAMIENTAS} value={form.tools} onChange={v => set('tools', v)} />
                    <input className="field mt-3" value={form.toolsOther} onChange={e => set('toolsOther', e.target.value)} placeholder="Otra herramienta o sistema (opcional)" />
                  </div>
                  <div>
                    <SectionTitle title="¿Qué áreas les gustaría mejorar?" hint="Donde sienten que se les va el tiempo o la plata." />
                    <Chips options={AREAS} value={form.areas} onChange={v => set('areas', v)} />
                  </div>
                </div>
              )}

              {/* 3 · Tareas tediosas */}
              {step === 2 && (
                <>
                  <SectionTitle title="Tareas tediosas y repetitivas" hint="Contanos esas tareas que nadie quiere hacer: copiar datos, mandar los mismos mensajes, armar planillas… ¡Cada una es una oportunidad de automatizar! 🤖" />
                  <div className="flex flex-col gap-3.5">
                    <AnimatePresence initial={false}>
                      {form.tasks.map((t, i) => (
                        <motion.div key={t.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                          className="rounded-2xl p-4 border border-white/[.08] bg-white/[.025]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[12px] font-bold text-violet-light">Tarea #{i + 1}</span>
                            <button type="button" onClick={() => removeTask(t.id)} className="text-[12px] text-white/35 hover:text-coral transition-colors">Quitar ✕</button>
                          </div>
                          <textarea className="field min-h-[70px] resize-y" value={t.desc} onChange={e => setTask(t.id, 'desc', e.target.value)}
                            placeholder="Ej. Todos los días paso a mano los pedidos de WhatsApp a una planilla" />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                            <div>
                              <label className="field-label">Área</label>
                              <select className="field" value={t.area} onChange={e => setTask(t.id, 'area', e.target.value)}>
                                <option value="">—</option>{AREAS.map(o => <option key={o}>{o}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="field-label">Frecuencia</label>
                              <select className="field" value={t.freq} onChange={e => setTask(t.id, 'freq', e.target.value)}>
                                <option value="">—</option>{FRECUENCIAS.map(o => <option key={o}>{o}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="field-label">Horas por semana</label>
                              <input className="field" inputMode="decimal" value={t.hours} onChange={e => setTask(t.id, 'hours', e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Ej. 5" />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="field-label">¿Cuánto les afecta?</label>
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} type="button" onClick={() => setTask(t.id, 'impact', n)}
                                  className={`flex-1 py-2 rounded-lg text-[13px] border transition-all ${n <= t.impact ? 'bg-violet/[.25] border-violet-light/60' : 'bg-white/[.02] border-white/[.08] opacity-50'}`}>
                                  🔥
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-between text-[10.5px] text-white/35 mt-1"><span>Molesta un poco</span><span>Nos frena todo</span></div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <button type="button" onClick={addTask} className="btn-ghost justify-center border-dashed !border-violet-light/40 !text-violet-light">+ Agregar otra tarea</button>
                    {totalHours > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl px-4 py-3 bg-mint/[.07] border border-mint/30 text-[13px]">
                        ⏱️ Se van <b className="text-mint">{totalHours} h por semana</b> (~{Math.round(totalHours * 4.3)} h al mes) en estas tareas. ¡Ese tiempo se puede recuperar!
                      </motion.div>
                    )}
                  </div>
                </>
              )}

              {/* 4 · Problemas */}
              {step === 3 && (
                <div className="flex flex-col gap-6">
                  <div>
                    <SectionTitle title="¿Qué les duele hoy?" hint="Marcá los problemas que se identifiquen con el negocio." />
                    <Chips options={DOLORES} value={form.pains} onChange={v => set('pains', v)} />
                  </div>
                  <div className="grid grid-cols-1 gap-3.5">
                    <Field label="El problema número uno" full>
                      <textarea className="field min-h-[80px] resize-y" value={form.mainProblem} onChange={e => set('mainProblem', e.target.value)} placeholder="Si pudieras resolver UNA sola cosa mañana, ¿cuál sería?" />
                    </Field>
                    <Field label="¿Cómo sería el negocio ideal?" full>
                      <textarea className="field min-h-[80px] resize-y" value={form.dream} onChange={e => set('dream', e.target.value)} placeholder="Ej. Que los pedidos lleguen ordenados, el stock se actualice solo y ver mis números desde el celular" />
                    </Field>
                  </div>
                  <div>
                    <label className="field-label">¿Qué tan urgente es?</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {URGENCIAS.map(u => (
                        <button key={u.v} type="button" onClick={() => set('urgency', form.urgency === u.v ? '' : u.v)}
                          className={`text-left rounded-xl px-3 py-2.5 border transition-all ${form.urgency === u.v ? 'bg-violet/[.25] border-violet-light/70 shadow-[0_0_14px_rgba(139,92,246,.3)]' : 'bg-white/[.025] border-white/[.08] hover:border-white/20'}`}>
                          <div className="text-[13px] font-bold">{u.v}</div>
                          <div className="text-[11px] text-white/40 mt-0.5">{u.d}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Presupuesto estimado</label>
                    <Chips multi={false} options={PRESUPUESTOS} value={form.budget} onChange={v => set('budget', v)} />
                  </div>
                </div>
              )}

              {/* 5 · Notas */}
              {step === 4 && (
                <>
                  <SectionTitle title="Notas" hint="Anotá todo lo que surja en la charla: ideas, observaciones, datos sueltos. También podés sumar notas en cualquier paso con el botón 📝 flotante." />
                  <div className="flex gap-2">
                    <input className="field" value={quickNote} onChange={e => setQuickNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Escribí una nota y presioná Enter" />
                    <button type="button" onClick={() => addNote()} className="btn-glass flex-shrink-0">Agregar</button>
                  </div>
                  <NotesList notes={form.notes} onRemove={removeNote} />
                  <div className="mt-5">
                    <Field label="Notas generales / observaciones" full>
                      <textarea className="field min-h-[130px] resize-y" value={form.generalNotes} onChange={e => set('generalNotes', e.target.value)} placeholder="Impresiones de la reunión, próximos pasos, cosas a investigar…" />
                    </Field>
                  </div>
                </>
              )}

              {/* 6 · Resumen y envío */}
              {step === 5 && (
                <>
                  <SectionTitle title="¡Listo para enviar! 🚀" hint="Revisá el resumen. Al tocar el botón se abre WhatsApp con todo el mensaje armado para Mateo Estudio." />
                  <div className="grid grid-cols-3 gap-2.5 mb-4">
                    <Stat n={form.tasks.filter(t => t.desc.trim()).length} l="tareas" />
                    <Stat n={totalHours ? `${totalHours}h` : '—'} l="por semana" />
                    <Stat n={form.notes.length + (form.generalNotes.trim() ? 1 : 0)} l="notas" />
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed font-sans rounded-2xl p-4 max-h-[380px] overflow-y-auto bg-black/30 border border-white/[.08] text-white/80">{message}</pre>
                  <div className="flex flex-col sm:flex-row gap-2.5 mt-4">
                    <motion.button whileTap={{ scale: 0.97 }} onClick={sendWhatsApp}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[14px] font-bold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', boxShadow: '0 0 24px rgba(37,211,102,.35)' }}>
                      <WaIcon /> Enviar por WhatsApp
                    </motion.button>
                    <button onClick={copyMessage} className="btn-ghost justify-center">{copied ? '✓ Copiado' : 'Copiar texto'}</button>
                  </div>
                  {sent && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl px-4 py-3 bg-mint/[.07] border border-mint/30 text-[13px]">
                      🎉 ¡Genial! Si WhatsApp no se abrió, usá “Copiar texto” y pegalo en el chat. <button onClick={resetAll} className="underline text-mint ml-1">Empezar otra evaluación</button>
                    </motion.div>
                  )}
                </>
              )}
            </StepPanel>
          </div>

          <div className="flex justify-between gap-2.5 mt-7">
            <button className="btn-ghost" style={{ visibility: step === 0 ? 'hidden' : 'visible' }} onClick={() => go(-1)}>← Atrás</button>
            {step < STEPS.length - 1 && (
              <motion.button whileTap={{ scale: 0.97 }} className="btn-glass" onClick={() => go(1)}>
                {step === STEPS.length - 2 ? 'Ver resumen ✦' : 'Siguiente →'}
              </motion.button>
            )}
          </div>
        </motion.section>

        <p className="text-center text-[11px] text-white/30 mt-6">
          Los datos se guardan en este dispositivo hasta que los envíes. · <button onClick={() => nav('/')} className="underline hover:text-white/60">Mateo Estudio</button>
        </p>
      </main>

      {/* Botón flotante de notas rápidas */}
      <motion.button whileTap={{ scale: 0.92 }} onClick={() => setNotesOpen(true)}
        className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center text-[22px] border border-violet-light/60"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,.85), rgba(244,114,240,.6))', boxShadow: '0 0 26px rgba(139,92,246,.6)' }}
        title="Nota rápida" aria-label="Agregar nota rápida">
        📝
        {form.notes.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-neon-pink text-[11px] font-bold flex items-center justify-center text-ink">{form.notes.length}</span>
        )}
      </motion.button>

      <AnimatePresence>
        {notesOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={() => setNotesOpen(false)}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} onClick={e => e.stopPropagation()}
              className="w-[min(520px,100%)] rounded-[20px] p-5 bg-panel border border-violet-light/25 shadow-neon-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-bold">📝 Nota rápida <span className="text-white/35 font-normal text-[12px]">· paso “{STEPS[step]}”</span></h3>
                <button onClick={() => setNotesOpen(false)} className="text-white/40 hover:text-white text-[18px] leading-none">✕</button>
              </div>
              <textarea autoFocus className="field min-h-[90px] resize-y" value={quickNote} onChange={e => setQuickNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote() }} placeholder="Lo que no te querés olvidar…" />
              <div className="flex justify-end mt-3"><button onClick={() => addNote()} className="btn-glass">Guardar nota</button></div>
              <NotesList notes={form.notes} onRemove={removeNote} compact />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NotesList({ notes, onRemove, compact }) {
  if (!notes.length) return compact ? null : <p className="text-[12.5px] text-white/30 mt-4 text-center">Todavía no hay notas.</p>
  return (
    <ul className={`flex flex-col gap-2 mt-4 ${compact ? 'max-h-[220px] overflow-y-auto' : ''}`}>
      <AnimatePresence initial={false}>
        {[...notes].reverse().map(n => (
          <motion.li key={n.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            className="flex gap-3 items-start rounded-xl px-3.5 py-2.5 bg-white/[.03] border border-white/[.07]">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] break-words">{n.text}</div>
              <div className="text-[10.5px] text-white/35 mt-0.5">{fmtTime(n.ts)}{n.step ? ` · ${n.step}` : ''}</div>
            </div>
            <button onClick={() => onRemove(n.id)} className="text-white/30 hover:text-coral text-[13px]" aria-label="Borrar nota">✕</button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

const Stat = ({ n, l }) => (
  <div className="rounded-xl px-3 py-3 text-center bg-violet/[.1] border border-violet/30">
    <div className="text-[20px] font-extrabold text-gradient">{n}</div>
    <div className="text-[10.5px] uppercase tracking-wider text-white/45 font-bold">{l}</div>
  </div>
)

const WaIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm0-21.6A11.8 11.8 0 0 0 1.9 17.9L.2 24l6.3-1.6A11.8 11.8 0 1 0 12 .2z"/></svg>
)
