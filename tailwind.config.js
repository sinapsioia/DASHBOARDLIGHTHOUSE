/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'lh-bg': '#0d0d0d',
        'lh-card': '#141414',
        'lh-border': '#2a2a2a',
        'lh-muted': '#6b7280',
        'lh-gold': '#C9A84C',
      },
    },
  },
  plugins: [],
}
