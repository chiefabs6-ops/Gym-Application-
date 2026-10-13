import type { ExerciseCategory, Equipment, MuscleGroup } from './domain';
import type { TrackingType } from './tracking';

/**
 * Canonical exercise library. Fixed UUIDs so the server seed and the on-device
 * seed agree without a network round-trip. Never change an existing id.
 */
export interface DefaultExercise {
  id: string;
  name: string;
  primary_muscle: MuscleGroup;
  equipment: Equipment;
  category: ExerciseCategory;
  tracking_type: TrackingType;
}

const gid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

/** Logging type per canonical exercise; everything not listed is weight × reps. */
const TRACKING: Record<number, TrackingType> = {
  4: 'reps_only', // Push Up
  8: 'weighted_bodyweight', // Pull Up
  22: 'duration', // Plank
  23: 'reps_only', // Hanging Leg Raise
  24: 'distance_duration', // Running
  25: 'distance_duration', // Cycling
  26: 'distance_duration', // Rowing (Machine)
  39: 'reps_only', // Band Pull-Apart
  44: 'weighted_bodyweight', // Dip
  45: 'duration', // Battle Rope
};

const BASE: readonly Omit<DefaultExercise, 'tracking_type'>[] = [
  { id: gid(1), name: 'Bench Press (Barbell)', primary_muscle: 'chest', equipment: 'barbell', category: 'strength' },
  { id: gid(2), name: 'Incline Bench Press (Dumbbell)', primary_muscle: 'chest', equipment: 'dumbbell', category: 'strength' },
  { id: gid(3), name: 'Chest Fly (Cable)', primary_muscle: 'chest', equipment: 'cable', category: 'strength' },
  { id: gid(4), name: 'Push Up', primary_muscle: 'chest', equipment: 'bodyweight', category: 'bodyweight' },
  { id: gid(5), name: 'Deadlift (Barbell)', primary_muscle: 'back', equipment: 'barbell', category: 'strength' },
  { id: gid(6), name: 'Bent Over Row (Barbell)', primary_muscle: 'back', equipment: 'barbell', category: 'strength' },
  { id: gid(7), name: 'Lat Pulldown (Cable)', primary_muscle: 'back', equipment: 'cable', category: 'strength' },
  { id: gid(8), name: 'Pull Up', primary_muscle: 'back', equipment: 'bodyweight', category: 'bodyweight' },
  { id: gid(9), name: 'Overhead Press (Barbell)', primary_muscle: 'shoulders', equipment: 'barbell', category: 'strength' },
  { id: gid(10), name: 'Lateral Raise (Dumbbell)', primary_muscle: 'shoulders', equipment: 'dumbbell', category: 'strength' },
  { id: gid(11), name: 'Bicep Curl (Dumbbell)', primary_muscle: 'biceps', equipment: 'dumbbell', category: 'strength' },
  { id: gid(12), name: 'Hammer Curl (Dumbbell)', primary_muscle: 'biceps', equipment: 'dumbbell', category: 'strength' },
  { id: gid(13), name: 'Triceps Pushdown (Straight Bar)', primary_muscle: 'triceps', equipment: 'cable', category: 'strength' },
  { id: gid(14), name: 'Skull Crusher (EZ Bar)', primary_muscle: 'triceps', equipment: 'barbell', category: 'strength' },
  { id: gid(15), name: 'Squat (Barbell)', primary_muscle: 'quads', equipment: 'barbell', category: 'strength' },
  { id: gid(16), name: 'Leg Press (Machine)', primary_muscle: 'quads', equipment: 'machine', category: 'strength' },
  { id: gid(17), name: 'Leg Extension (Machine)', primary_muscle: 'quads', equipment: 'machine', category: 'strength' },
  { id: gid(18), name: 'Romanian Deadlift (Barbell)', primary_muscle: 'hamstrings', equipment: 'barbell', category: 'strength' },
  { id: gid(19), name: 'Lying Leg Curl (Machine)', primary_muscle: 'hamstrings', equipment: 'machine', category: 'strength' },
  { id: gid(20), name: 'Hip Thrust (Barbell)', primary_muscle: 'glutes', equipment: 'barbell', category: 'strength' },
  { id: gid(21), name: 'Standing Calf Raise (Machine)', primary_muscle: 'calves', equipment: 'machine', category: 'strength' },
  { id: gid(22), name: 'Plank', primary_muscle: 'core', equipment: 'bodyweight', category: 'duration' },
  { id: gid(23), name: 'Hanging Leg Raise', primary_muscle: 'core', equipment: 'bodyweight', category: 'bodyweight' },
  { id: gid(24), name: 'Running', primary_muscle: 'cardio', equipment: 'none', category: 'cardio' },
  { id: gid(25), name: 'Cycling', primary_muscle: 'cardio', equipment: 'none', category: 'cardio' },
  { id: gid(26), name: 'Rowing (Machine)', primary_muscle: 'cardio', equipment: 'machine', category: 'cardio' },
  // Added 2026-10-08 (user request): more upper-body staples.
  { id: gid(27), name: 'Seated Row (Cable)', primary_muscle: 'back', equipment: 'cable', category: 'strength' },
  { id: gid(28), name: 'Bicep Curl (Cable)', primary_muscle: 'biceps', equipment: 'cable', category: 'strength' },
  { id: gid(29), name: 'Hammer Curl (Cable Rope)', primary_muscle: 'biceps', equipment: 'cable', category: 'strength' },
  { id: gid(30), name: 'Zottman Curl (Dumbbell)', primary_muscle: 'forearms', equipment: 'dumbbell', category: 'strength' },
  { id: gid(31), name: 'Wrist Curl (Dumbbell)', primary_muscle: 'forearms', equipment: 'dumbbell', category: 'strength' },
  { id: gid(32), name: 'Reverse Wrist Curl (Dumbbell)', primary_muscle: 'forearms', equipment: 'dumbbell', category: 'strength' },
  { id: gid(33), name: 'Wrist Rotation (Dumbbell)', primary_muscle: 'forearms', equipment: 'dumbbell', category: 'strength' },
  { id: gid(34), name: 'Incline Bench Press (Barbell)', primary_muscle: 'chest', equipment: 'barbell', category: 'strength' },
  { id: gid(35), name: 'Chest Fly (Dumbbell)', primary_muscle: 'chest', equipment: 'dumbbell', category: 'strength' },
  { id: gid(36), name: 'Incline Chest Fly (Dumbbell)', primary_muscle: 'chest', equipment: 'dumbbell', category: 'strength' },
  { id: gid(37), name: 'Pec Deck (Machine)', primary_muscle: 'chest', equipment: 'machine', category: 'strength' },
  { id: gid(38), name: 'Lateral Raise (Cable)', primary_muscle: 'shoulders', equipment: 'cable', category: 'strength' },
  { id: gid(39), name: 'Band Pull-Apart', primary_muscle: 'shoulders', equipment: 'band', category: 'strength' },
  { id: gid(40), name: 'Rear Delt Fly (Dumbbell)', primary_muscle: 'shoulders', equipment: 'dumbbell', category: 'strength' },
  { id: gid(41), name: 'Shoulder Press (Dumbbell)', primary_muscle: 'shoulders', equipment: 'dumbbell', category: 'strength' },
  { id: gid(42), name: 'Shoulder Press (Machine)', primary_muscle: 'shoulders', equipment: 'machine', category: 'strength' },
  { id: gid(43), name: 'Triceps Pushdown (Rope)', primary_muscle: 'triceps', equipment: 'cable', category: 'strength' },
  { id: gid(44), name: 'Dip', primary_muscle: 'triceps', equipment: 'bodyweight', category: 'bodyweight' },
  // Added 2026-10-09 (user request): conditioning, logged as timed sets (interval timer).
  { id: gid(45), name: 'Battle Rope', primary_muscle: 'full_body', equipment: 'other', category: 'duration' },
  { id: gid(46), name: 'Decline Chest Press (Cable)', primary_muscle: 'chest', equipment: 'cable', category: 'strength' },
];

export const DEFAULT_EXERCISES: readonly DefaultExercise[] = BASE.map((e) => ({
  ...e,
  tracking_type: TRACKING[Number(e.id.slice(-12))] ?? 'weight_reps',
}));
