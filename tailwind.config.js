import forms from '@tailwindcss/forms'

// One palette for the editor and the settings pages.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './pages/**/*.html', './src/**/*.ts'],
  theme: {
    extend: {
      colors: {
        vf: {
          // Surfaces, darkest first
          bg: '#131315',
          chrome: '#161618',
          rail: '#18181b',
          panel: '#1a1a1d',
          card: '#1b1b1e',
          field: '#1d1d20',
          raised: '#232327',
          key: '#2a2a2f',
          chip: '#2e2e34',
          // Borders, subtlest first
          line: '#232327',
          edge: '#26262b',
          rim: '#2a2a2f',
          stroke: '#33333a',
          stroke2: '#38383e',
          // Text, brightest first
          bright: '#f2f0ed',
          ink: '#e8e6e3',
          soft: '#c9c8cc',
          mute: '#a9a8ac',
          dim: '#8d8c90',
          low: '#7d7c81',
          faint: '#6c6b70',
          ghost: '#4f4e54',
          // Accents
          amber: '#e9a54b',
          green: '#5fcf8e',
          red: '#ef5b5b',
        },
      },
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono Variable', 'Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [forms],
}
