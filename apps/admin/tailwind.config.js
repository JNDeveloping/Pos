/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#ecfdf3', 100: '#d1fae0', 500: '#16a34a', 600: '#15803d', 700: '#166534', 900: '#071a0e' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgb(15 23 42 / .04), 0 8px 24px rgb(15 23 42 / .06)' },
    },
  },
  plugins: [],
};
