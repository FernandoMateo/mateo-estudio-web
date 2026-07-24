export const COUNTRIES = [
  ['MX','México'],['US','Estados Unidos'],['ES','España'],['AR','Argentina'],['CO','Colombia'],
  ['CL','Chile'],['PE','Perú'],['EC','Ecuador'],['VE','Venezuela'],['BO','Bolivia'],
  ['PY','Paraguay'],['UY','Uruguay'],['BR','Brasil'],['PA','Panamá'],['CR','Costa Rica'],
  ['GT','Guatemala'],['HN','Honduras'],['SV','El Salvador'],['NI','Nicaragua'],['DO','Rep. Dominicana'],
  ['PR','Puerto Rico'],['CA','Canadá'],['XX','Otro'],
]
export const flagOf = code => {
  if (!code || code === 'XX') return '🌐'
  try { return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0))) }
  catch { return '🌐' }
}
export const PHASES = { descubrimiento:'Descubrimiento', diseno:'Diseño', desarrollo:'Desarrollo', revision:'Revisión', entrega:'Entrega' }
export const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
export const PILL = {
  activo:'text-mint bg-mint/10 border border-mint/30',
  completado:'text-mint bg-mint/10 border border-mint/30',
  completada:'text-mint bg-mint/10 border border-mint/30',
  baja:'text-mint bg-mint/10 border border-mint/30',
  pagado:'text-mint bg-mint/10 border border-mint/30',
  prospecto:'text-amber bg-amber/10 border border-amber/30',
  pausado:'text-amber bg-amber/10 border border-amber/30',
  propuesta:'text-amber bg-amber/10 border border-amber/30',
  alta:'text-amber bg-amber/10 border border-amber/30',
  pendiente:'text-white/40 bg-white/5 border border-white/10',
  inactivo:'text-white/40 bg-white/5 border border-white/10',
  en_progreso:'text-violet-light bg-violet/10 border border-violet/35',
  media:'text-violet-light bg-violet/10 border border-violet/35',
  cancelado:'text-coral bg-coral/10 border border-coral/30',
  urgente:'text-coral bg-coral/10 border border-coral/30',
  vencido:'text-coral bg-coral/10 border border-coral/30',
}
