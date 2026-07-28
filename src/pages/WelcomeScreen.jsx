import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getAuth } from '../lib/api';
import AuroraBackground from '../components/AuroraBackground';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, userRole } = location.state || {}; // Obtener datos del usuario del estado de navegación

  useEffect(() => {
    // Fallback si userName o userRole no se pasan a través del estado (ej. acceso directo)
    if (!userName || !userRole) {
      const auth = getAuth();
      if (auth?.record) {
        // Si existen datos de autenticación, usarlos para redirigir
        const name = auth.record.name || auth.record.email.split('@')[0];
        const role = auth.record.role;
        // Redirigir inmediatamente si ya está autenticado y no hay estado de bienvenida específico
        navigate(role === 'cliente' ? '/portal' : '/app', { replace: true });
        return;
      } else {
        // Si no hay datos de autenticación, redirigir al login
        navigate('/', { replace: true });
        return;
      }
    }

    // Después de una breve animación, redirigir al portal apropiado
    const timer = setTimeout(() => {
      navigate(userRole === 'cliente' ? '/portal' : '/app', { replace: true });
    }, 2500); // Duración de la animación + un poco extra

    return () => clearTimeout(timer);
  }, [userName, userRole, navigate]);

  const displayUserName = userName || 'bienvenido';

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-ink">
      <AuroraBackground intense />

      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="relative z-10 text-center px-6">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="text-[38px] sm:text-[52px] font-extrabold tracking-tight text-gradient">
          ¡Hola, {displayUserName}!
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.6 }} className="text-[16px] text-white/50 mt-3">
          Preparando tu espacio…
        </motion.p>
      </motion.div>
    </div>
  );
}