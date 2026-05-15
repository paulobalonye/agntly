import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#07090d',
          1: '#0d1117',
          2: '#131920',
          3: '#1a2332',
        },
        border: {
          DEFAULT: '#1e2d3d',
          2: '#243447',
        },
        t: {
          0: '#e8edf2',
          1: '#8fa8c0',
          2: '#4d6478',
          3: '#2a3d52',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          2: 'rgb(var(--color-accent-2) / <alpha-value>)',
        },
        blue: '#4d9ef5',
        amber: '#f5a623',
        red: '#e05252',
        purple: '#9b7cf8',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Figtree', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s ease both',
        'scroll-left': 'scroll-left 22s linear infinite',
        'drift-1': 'drift 12s ease-in-out infinite alternate',
        'drift-2': 'drift 16s ease-in-out infinite alternate-reverse',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.7)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scroll-left': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        drift: {
          from: { transform: 'translate(0, 0)' },
          to: { transform: 'translate(40px, 30px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
