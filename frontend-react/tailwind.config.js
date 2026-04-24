/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#d6f5ef',
          DEFAULT: '#0f766e',
          strong: '#155e75',
        },
        accent: '#f97316',
        'accent-strong': '#ea580c',
        'surface-bg': '#f3f7f6',
        'surface': '#ffffff',
        'surface-soft': '#ecf4f2',
        'surface-strong': '#d9e7e4',
        'dark-bg': '#0b1120',
        'dark-surface': '#111827',
        'dark-soft': '#1f2937',
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'soft-enter': 'page-soft-enter 420ms ease both',
        'pulse-btn': 'pulse-btn 2s infinite',
      },
      keyframes: {
        'page-soft-enter': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-btn': {
          '0%, 100%': { boxShadow: '0 4px 16px rgba(15, 90, 166, 0.3)' },
          '50%': { boxShadow: '0 4px 24px rgba(15, 90, 166, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
