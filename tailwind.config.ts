import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--color-canvas) / <alpha-value>)',
          ink: 'rgb(var(--color-canvas-ink) / <alpha-value>)',
          'on-ink': 'rgb(var(--color-canvas-on-ink) / <alpha-value>)',
          muted: 'rgb(var(--color-canvas-muted) / <alpha-value>)',
          panel: 'rgb(var(--color-canvas-panel) / <alpha-value>)',
          line: 'rgb(var(--color-canvas-line) / <alpha-value>)',
          subtle: 'rgb(var(--color-canvas-subtle) / <alpha-value>)',
          surface: 'rgb(var(--color-surface) / <alpha-value>)'
        }
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        body: ['ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
