/** Logo de la marca — un solo lugar. Para cambiarlo, reemplazá /public/logo.png y volvé a compilar. */
export default function Logo({ size = 40, className = '' }) {
  return (
    <img src="/logo.png" alt="Logo" style={{ width: size, height: size }} className={`object-contain flex-shrink-0 ${className}`} />
  )
}
