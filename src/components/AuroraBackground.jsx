export default function AuroraBackground({ intense }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div
        className="absolute w-[60vw] h-[60vw] rounded-full blur-[120px] animate-aurora"
        style={{ top: '-15%', left: '-10%', background: 'radial-gradient(circle, rgba(139,92,246,.35), transparent 65%)' }}
      />
      <div
        className="absolute w-[50vw] h-[50vw] rounded-full blur-[130px] animate-aurora-2"
        style={{ bottom: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124,58,237,.28), transparent 65%)' }}
      />
      {intense && (
        <div
          className="absolute w-[40vw] h-[40vw] rounded-full blur-[110px] animate-aurora"
          style={{ top: '30%', left: '55%', background: 'radial-gradient(circle, rgba(244,114,240,.16), transparent 65%)', animationDelay: '4s' }}
        />
      )}
      <div className="absolute inset-0 opacity-[.045] mix-blend-overlay grain-overlay" />
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 90%)' }} />
    </div>
  )
}
