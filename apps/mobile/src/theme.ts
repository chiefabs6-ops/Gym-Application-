/** Mirror of tailwind.config.js tokens for props that can't take a className (icons, style objects). */
export const colors = {
  bg: '#121214',
  surface: '#1E1E22',
  elevated: '#28282E',
  border: '#2E2E35',
  accent: '#10B981',
  accentSoft: '#10B98126',
  action: '#0066FF',
  ink: '#F4F4F5',
  muted: '#A1A1AA',
  subtle: '#71717A',
  faint: '#52525B',
  pr: '#F59E0B',
  superset: '#60A5FA',
  danger: '#F87171',
  warmup: '#FBBF24',
  drop: '#A78BFA',
  failure: '#F87171',
  protein: '#60A5FA',
  carbs: '#FBBF24',
  fat: '#A78BFA',
} as const;

/** Soft drop shadow for floating cards (Android elevation + iOS shadow). */
export const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;
