/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helvetica Neue', 'system-ui', 'sans-serif'],
        display: ['Helvetica Neue', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'gunmetal': {
          50: '#f7f7f8',
          100: '#eeeef1',
          200: '#d5d6dc',
          300: '#b3b5be',
          400: '#888b98',
          500: '#6b6e7b',
          600: '#555863',
          700: '#444650',
          800: '#2a2b30',
          900: '#1f1f23',
          950: '#0a0a0c',
        },
        'neon': {
          yellow: '#facc15',
          orange: '#fb923c',
          pink: '#ec4899',
          turquoise: '#2dd4bf',
          amber: '#f59e0b',
          raspberry: '#FF1493'
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(135deg, #0a0a0c 0%, #1f1f23 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(42, 43, 48, 0.3) 0%, rgba(31, 31, 35, 0.2) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(31, 31, 35, 0.5) 0%, rgba(10, 10, 12, 0.3) 100%)',
        'glass-gradient-light': 'linear-gradient(135deg, rgba(42, 43, 48, 0.2) 0%, rgba(31, 31, 35, 0.1) 100%)',
      },
      boxShadow: {
        'neon': '0 0 20px var(--tw-shadow-color)',
        'inner-light': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.05)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'spin-slow': 'spin 10s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { filter: 'brightness(100%) drop-shadow(0 0 0 currentColor)' },
          '100%': { filter: 'brightness(150%) drop-shadow(0 0 10px currentColor)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': {
            opacity: '0.8',
            filter: 'drop-shadow(0 0 0 currentColor)',
          },
          '50%': {
            opacity: '0.6',
            filter: 'drop-shadow(0 0 5px currentColor)',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    'text-neon-turquoise',
    'text-neon-yellow',
    'text-neon-orange',
    'text-neon-pink',
    'text-neon-raspberry',
    'bg-neon-turquoise',
    'bg-neon-yellow',
    'bg-neon-orange',
    'bg-neon-pink',
    'bg-neon-raspberry',
    'hover:bg-neon-turquoise',
    'hover:bg-neon-yellow',
    'hover:bg-neon-orange',
    'hover:bg-neon-pink',
    'hover:bg-neon-raspberry',
    'animate-fade-in',
    'animate-fade-out',
    'animate-slide-up',
    'animate-slide-down',
    'animate-pulse-slow'
  ]
};