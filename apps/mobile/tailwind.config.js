/**
 * Design tokens. Mirrored for non-className props (icon colors, styles) in src/theme.ts.
 * Keep both files in sync.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Deep charcoal app background, soft dark cards, elevated inputs.
        surface: { DEFAULT: '#121214', raised: '#1E1E22', elevated: '#28282E', border: '#2E2E35' },
        accent: { DEFAULT: '#10B981', soft: '#10B98126', muted: '#064E3B' },
        action: '#0066FF',
        ink: { DEFAULT: '#F4F4F5', muted: '#A1A1AA', subtle: '#71717A', faint: '#52525B' },
        pr: '#F59E0B',
        // Supersets / circuits (labels A1, A2, links).
        superset: '#60A5FA',
        settype: { warmup: '#FBBF24', drop: '#A78BFA', failure: '#F87171' },
      },
      borderRadius: { card: '16px' },
    },
  },
  plugins: [],
};
