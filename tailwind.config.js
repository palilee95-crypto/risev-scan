/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light surface, near-black ink, vivid yellow accent — matches the
        // RISEV SCAN mockups.
        ink: '#0A0A0A',
        surface: '#FFFFFF',
        canvas: '#FFFFFF',
        amber: '#FFD400',
        'amber-deep': '#F5C400',
        muted: '#6B7280',
        faint: '#9CA3AF',
        line: '#E5E7EB',
        chip: '#F3F4F6',
        ok: '#16A34A',
        'ok-soft': '#DCFCE7',
        bad: '#DC2626',
        'bad-soft': '#FEE2E2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        pill: '999px',
      },
      boxShadow: {
        tab: '0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)',
        sheet: '0 -8px 30px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
