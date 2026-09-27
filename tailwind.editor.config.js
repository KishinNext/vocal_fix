import forms from '@tailwindcss/forms'

// Editor window (index.html + editor scripts): "studio" palette and system fonts.
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/main.ts', './src/editor.ts', './src/tone-tabs.ts'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#141416',
          surface: '#1b1b1e',
          card: '#222226',
          elevated: '#28282d',
          border: 'rgba(255, 255, 255, 0.08)',
          borderSubtle: 'rgba(255, 255, 255, 0.04)',
          muted: '#71717a',
          subtle: '#a1a1aa',
          body: '#d4d4d8',
          heading: '#fafafa',
          accent: '#e4e4e7',
          terracotta: '#d97706',
          sage: '#10b981',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'Segoe UI', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'sans-serif'],
        mono: ['SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [forms],
}
