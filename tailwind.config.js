/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#070b0d',
        panel: '#0c1419',
        'panel-hover': '#111e26',
        'border-subtle': '#162229',
        'border-active': '#00e5c4',
        'text-primary': '#dff2ed',
        'text-dim': '#6aada5',
        'text-accent': '#00e5c4',
        'cyan-glow': '#00e5c4',
        'cyan-mid': '#00b89e',
        'cyan-dim': '#007a6a',
        'amber-glow': '#f59e0b',
        'amber-mid': '#d97706',
        'rose-glow': '#e040fb',
        'rose-mid': '#c026d3',
        timelike: '#00e5c4',
        spacelike: '#e040fb',
        'grid-line': '#0f1f28',
      },
      fontFamily: {
        display: ['Chakra Petch', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        body: ['system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 8px 2px rgba(0,229,196,0.35)',
        'glow-cyan-strong': '0 0 16px 4px rgba(0,229,196,0.5)',
        'glow-amber': '0 0 8px 2px rgba(245,158,11,0.4)',
        'glow-rose': '0 0 8px 2px rgba(224,64,251,0.4)',
        'panel-inset': 'inset 0 1px 0 rgba(0,229,196,0.08)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'flicker': 'flicker 4s linear infinite',
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'float': 'float 2.8s ease-in-out infinite',
        'fade-in': 'fadeIn 1s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.92' },
          '94%': { opacity: '1' },
          '96%': { opacity: '0.95' },
          '97%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(5px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
