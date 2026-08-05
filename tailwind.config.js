/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050508',
        deep: '#030304',
        panel: '#0A0A10',
        violet: { DEFAULT: '#8B5CF6', light: '#A78BFA', dark: '#7C3AED', deep: '#5B21B6' },
        neon: { pink: '#F472F0', cyan: '#5EEAD4', blue: '#60A5FA' },
        mint: '#34D399',
        coral: '#FB7185',
        amber: '#FBBF24',
      },
      fontFamily: {
        display: ['"Clash Display"', '"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'SF Pro Display', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(139,92,246,.4), 0 0 20px rgba(139,92,246,.35), 0 0 60px rgba(139,92,246,.15)',
        'neon-sm': '0 0 12px rgba(139,92,246,.45)',
        'neon-lg': '0 0 0 1px rgba(139,92,246,.3), 0 8px 30px rgba(139,92,246,.25), 0 0 80px rgba(139,92,246,.12)',
        glass: '0 8px 32px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)',
      },
      backgroundImage: {
        'grid-fade': 'radial-gradient(circle at center, rgba(139,92,246,.06) 0%, transparent 70%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        'aurora': 'aurora 22s ease-in-out infinite',
        'aurora-2': 'aurora2 28s ease-in-out infinite',
        'float': 'float 7s ease-in-out infinite',
        'shimmer': 'shimmer 2.6s linear infinite',
        'pulse-neon': 'pulseNeon 2.4s ease-in-out infinite',
        'gradient-x': 'gradientX 6s ease infinite',
      },
      keyframes: {
        aurora: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)', opacity: '.55' },
          '33%': { transform: 'translate(6%,-8%) scale(1.12)', opacity: '.75' },
          '66%': { transform: 'translate(-5%,6%) scale(.95)', opacity: '.45' },
        },
        aurora2: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)', opacity: '.4' },
          '50%': { transform: 'translate(-8%,10%) scale(1.15)', opacity: '.6' },
        },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseNeon: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.4' } },
        gradientX: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
    },
  },
  plugins: [],
}
