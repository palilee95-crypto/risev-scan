/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Rule of Three: white surface, black, amber accent (+ purple).
        ink: '#000000',
        surface: '#FFFFFF',
        amber: '#FFCC00',
        purple: '#5C3BCC',
        muted: '#6B7280',
        line: '#E5E7EB',
        ok: '#0F9D58',
        warn: '#F59E0B',
        bad: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
