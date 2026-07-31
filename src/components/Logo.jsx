/** Logo de la marca — un solo lugar. Para cambiarlo, reemplazá /public/logo.png y volvé a compilar.
 *  La marca de tiempo en la URL evita que el navegador muestre una versión vieja guardada en caché. */
export default function Logo({ size = 40, className = '' }) {
  return (
    <img src={`/logo.png?v=${typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 1}`} alt="Logo" style={{ width: size, height: size }} className={`object-contain flex-shrink-0 ${className}`} />
  )
}
