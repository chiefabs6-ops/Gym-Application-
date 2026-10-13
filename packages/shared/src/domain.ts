export const SET_TYPES = ['warmup', 'working', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
  'cardio',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebell',
  'band',
  'bodyweight',
  'other',
  'none',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_CATEGORIES = ['strength', 'bodyweight', 'cardio', 'duration'] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/** All weights are stored in kg. Convert only at the UI boundary. */
export const KG_PER_LB = 0.45359237;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
