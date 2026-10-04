/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  // Tema personalizado estilo GameBoy
  theme: {
    extend: {
      // Colores estilo GameBoy / Cyberpunk
      colors: {
        // Colores principales
        primary: {
          DEFAULT: '#00BFFF', // Azul GameBoy
          dark: '#0080FF',
          light: '#80D4FF',
        },
        secondary: {
          DEFAULT: '#FF69B4', // Rosa
          dark: '#FF1493',
          light: '#FFB6C1',
        },
        accent: {
          DEFAULT: '#00FF7F', // Verde
          dark: '#00CC66',
          light: '#99FFCC',
        },
        
        // Colores de fondo
        background: {
          DEFAULT: '#0A0A0A', // Negro oscuro
          dark: '#050505',
          light: '#1A1A1A',
        },
        surface: {
          DEFAULT: '#1A1A1A', // Superficie
          dark: '#101010',
          light: '#2A2A2A',
        },
        border: {
          DEFAULT: '#2A2A2A', // Borde
          dark: '#1A1A1A',
          light: '#3A3A3A',
        },
        
        // Colores de estado
        status: {
          idle: '#666666',
          working: '#4CAF50',
          thinking: '#2196F3',
          progress: '#FFC107',
          blocked: '#F44336',
          completed: '#4CAF50',
          failed: '#9C27B0',
          paused: '#FF9800',
        },
        
        // Colores de personajes
        luna: {
          primary: '#FF69B4',
          secondary: '#FFFFFF',
          background: '#000000',
        },
        max: {
          primary: '#00BFFF',
          secondary: '#FFFF00',
          background: '#000000',
        },
        pixel: {
          primary: '#32CD32',
          secondary: '#8A2BE2',
          background: '#000000',
        },
        data: {
          primary: '#00FFFF',
          secondary: '#FF0000',
          background: '#000000',
        },
        scout: {
          primary: '#FFD700',
          secondary: '#8B4513',
          background: '#000000',
        },
        layout: {
          primary: '#FFA500',
          secondary: '#1E90FF',
          background: '#000000',
        },
        boss: {
          primary: '#FFD700',
          secondary: '#800080',
          background: '#000000',
        },
        nex: {
          primary: '#00FF7F',
          secondary: '#C0C0C0',
          background: '#000000',
        },
      },
      
      // Tipografía
      fontFamily: {
        pixel: ['"Press Start 2P"', '"Courier New"', 'monospace'],
        orbitron: ['"Orbitron"', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      
      // Tamaños
      fontSize: {
        '2xs': ['8px', { lineHeight: '12px' }],
        xs: ['10px', { lineHeight: '14px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['32px', { lineHeight: '40px' }],
      },
      
      // Espaciado
      spacing: {
        '0.5': '2px',
        '1.5': '6px',
        '2.5': '10px',
        '3.5': '14px',
        '4.5': '18px',
      },
      
      // Bordes
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      
      // Sombras
      boxShadow: {
        'gameboy': '2px 2px 0 0 rgba(0, 0, 0, 0.5)',
        'gameboy-lg': '4px 4px 0 0 rgba(0, 0, 0, 0.5)',
        'crt': '0 0 20px rgba(0, 0, 0, 0.8)',
        'glow-cyan': '0 0 12px rgba(0, 255, 255, 0.5)',
        'glow-pink': '0 0 12px rgba(255, 105, 180, 0.5)',
        'glow-green': '0 0 12px rgba(0, 255, 127, 0.5)',
      },
      
      // Animaciones
      animation: {
        'pixel-float': 'pixel-float 3s ease-in-out infinite',
        'gameboy-flicker': 'gameboy-flicker 2s ease-in-out infinite',
        'scanlines': 'scanlines 0.1s linear infinite',
        'crt-on': 'crt-on 0.5s ease-out',
        'pixel-pulse': 'pixel-pulse 2s ease-in-out infinite',
        'agent-working': 'agent-working 0.5s ease-in-out infinite',
        'agent-thinking': 'agent-thinking 3s ease-in-out infinite',
        'agent-blocked': 'agent-blocked 0.5s ease-in-out infinite',
      },
      
      keyframes: {
        'pixel-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'gameboy-flicker': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '92%': { opacity: '1', filter: 'brightness(1)' },
          '93%': { opacity: '0.98', filter: 'brightness(0.98)' },
          '94%': { opacity: '1', filter: 'brightness(1)' },
          '95%': { opacity: '0.99', filter: 'brightness(0.99)' },
          '96%': { opacity: '1', filter: 'brightness(1)' },
        },
        'scanlines': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 4px' },
        },
        'crt-on': {
          '0%': { opacity: '0', transform: 'scale(0.95)', filter: 'brightness(0)' },
          '50%': { opacity: '0.5', transform: 'scale(1.02)', filter: 'brightness(1.2)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'brightness(1)' },
        },
        'pixel-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
        'agent-working': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        'agent-thinking': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'agent-blocked': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      
      // Efectos de imagen
      imageRendering: {
        pixelated: 'pixelated',
        crisp: 'crisp-edges',
      },
      
      // Tamaños específicos para pixel art
      width: {
        'pixel-16': '16px',
        'pixel-32': '32px',
        'pixel-40': '40px',
        'pixel-48': '48px',
        'pixel-64': '64px',
      },
      height: {
        'pixel-16': '16px',
        'pixel-32': '32px',
        'pixel-40': '40px',
        'pixel-48': '48px',
        'pixel-64': '64px',
      },
      
      // Aspect ratios
      aspectRatio: {
        'pixel': '1 / 2',
        'square': '1 / 1',
        'wide': '2 / 1',
      },
    },
  },
  
  // Plugins
  plugins: [],
}
