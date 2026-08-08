import type { Config } from 'tailwindcss'

// Tokens del prototipo (prototype.html :root) — no inventar colores nuevos.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        crema: '#FAF7F2',
        tinta: { DEFAULT: '#2E332E', suave: '#6B6F68' },
        salvia: { DEFAULT: '#7D9B76', osc: '#3F5741', bg: '#EEF3EC' },
        azul: { DEFAULT: '#6B8CAE', bg: '#EBF1F7' },
        terra: { DEFAULT: '#C68A4F', osc: '#8F5F2E', bg: '#F8EFE4' },
        neutro: { DEFAULT: '#A39E93', bg: '#F0EEE9' },
        linea: '#E8E2D8',
        ok: '#5F8D5F',
        mal: '#B85C48',
      },
      borderRadius: {
        card: '14px',
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
}
export default config
