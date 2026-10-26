import { beforeEach, describe, expect, it } from 'vitest';
import {
  acceptRecalcPrompt,
  currentWeightKg,
  getTargetsForDate,
  logWeight,
  markPrompted,
  saveProfileAndGoal,
  setOverride,
  shouldPromptRecalc,
  weightHistory,
  weightTrend,
  updateWeight,
  deleteWeight,
} from '../src/db/repositories/body';
import { getSettings } from '../src/state/settingsStore';
import { freshApp } from './helpers';

const male = { birth_date: '1996-01-01', sex: 'male', height_cm: 180, activity: 'moderate' } as const;
const female = { birth_date: '1986-01-01', sex: 'female', height_cm: 160, activity: 'sedentary' } as const;
const loseHalf = { kind: 'lose', rate_kg_per_week: 0.5 } as const;
const TODAY = '2026-10-26';
const at = (key: string) => new Date(`${key}T12:00:00`);

beforeEach(async () => {
  await freshApp();
});

describe('body and targets', () => {
  it('works out targets from the profile, goal and weight', async () => {
    await logWeight(80, '2026-10-10', '2026-10-10');
    await saveProfileAndGoal(male, loseHalf, TODAY);
    expect(getTargetsForDate(TODAY)).toMatchObject({ protein_g: 160 });
  });

  it('uses the 7-day average weight, else the latest weigh-in', async () => {
    await logWeight(82, '2026-10-01', '2026-10-01');
    expect(await currentWeightKg(TODAY)).toBe(82); // nothing in the last 7 days → latest
    await logWeight(80, '2026-10-24', '2026-10-24');
    await logWeight(79, TODAY, TODAY);
    expect(await currentWeightKg(TODAY)).toBe(79.5);
    expect((await weightHistory()).map((w) => w.value)).toEqual([79, 80, 82]);
  });

  it('trend line is a 30-day rolling average per weigh-in', async () => {
    await logWeight(90, '2026-08-01', '2026-08-01');
    await logWeight(82, '2026-10-01', '2026-10-01');
    await logWeight(80, '2026-10-21', '2026-10-21');
    expect(await weightTrend()).toEqual([
      { local_date: '2026-08-01', value: 90 },
      { local_date: '2026-10-01', value: 82 }, // 2026-08-01 is more than 30 days earlier
      { local_date: '2026-10-21', value: 81 },
    ]);
  });

  it('new weight recalculates targets that were not hand-edited', async () => {
    await logWeight(80, '2026-10-10', '2026-10-10');
    await saveProfileAndGoal(male, loseHalf, '2026-10-10');
    await logWeight(78, TODAY, TODAY);
    expect(getTargetsForDate(TODAY)).toMatchObject({ protein_g: 156 });
  });

  it('keeps hand-edited targets when weight changes', async () => {
    await logWeight(80, '2026-10-10', '2026-10-10');
    await saveProfileAndGoal(male, loseHalf, '2026-10-10');
    expect(await setOverride('protein_g', 180, '2026-10-10')).toEqual({ ok: true });
    await logWeight(78, TODAY, TODAY);
    expect(getTargetsForDate(TODAY)).toMatchObject({ protein_g: 180 });
  });

  it('past days keep the targets they had', async () => {
    await logWeight(80, '2026-10-10', '2026-10-10');
    await saveProfileAndGoal(male, loseHalf, '2026-10-20');
    const before = getTargetsForDate('2026-10-20')!;
    await saveProfileAndGoal(male, { kind: 'maintain', rate_kg_per_week: 0 }, TODAY);
    expect(getTargetsForDate('2026-10-22')).toEqual(before);
    expect(getTargetsForDate(TODAY)!.kcal).toBe(before.kcal + 550);
    expect(getTargetsForDate('2026-10-01')).toBeNull();
  });

  it('asks monthly only when weight moved two weeks of goal rate and something was hand-edited', async () => {
    await logWeight(80, '2026-09-01', '2026-09-01');
    await saveProfileAndGoal(male, loseHalf, '2026-09-01');
    expect(await shouldPromptRecalc(at(TODAY))).toBe(false); // nothing hand-edited
    await setOverride('protein_g', 180, '2026-09-01');
    await logWeight(79.2, TODAY, TODAY);
    expect(await shouldPromptRecalc(at(TODAY))).toBe(false); // 0.8 kg < 2 × 0.5 kg
    await logWeight(78.8, '2026-10-27', '2026-10-27');
    expect(await shouldPromptRecalc(at('2026-10-27'))).toBe(true); // 7-day avg 79.0 → moved 1.0 kg
  });

  it('accepting the prompt recalculates every hand-edited target and waits 30 days before asking again', async () => {
    await logWeight(80, '2026-09-01', '2026-09-01');
    await saveProfileAndGoal(male, loseHalf, '2026-09-01');
    await setOverride('protein_g', 180, '2026-09-01');
    await setOverride('kcal', 2500, '2026-09-01');
    await logWeight(78, TODAY, TODAY);
    expect(await shouldPromptRecalc(at(TODAY))).toBe(true);
    await markPrompted(at(TODAY));
    expect(await shouldPromptRecalc(at('2026-11-20'))).toBe(false);
    await acceptRecalcPrompt(TODAY);
    expect(getSettings().nutrition!.overrides).toEqual({});
    expect(getTargetsForDate(TODAY)).toMatchObject({ protein_g: 156 });
  });

  it('never prompts on a maintain goal', async () => {
    await logWeight(80, '2026-09-01', '2026-09-01');
    await saveProfileAndGoal(male, { kind: 'maintain', rate_kg_per_week: 0 }, '2026-09-01');
    await setOverride('protein_g', 180, '2026-09-01');
    await logWeight(75, TODAY, TODAY);
    expect(await shouldPromptRecalc(at(TODAY))).toBe(false);
  });

  it('minimum still applies to a hand-edited calorie target', async () => {
    await logWeight(50, TODAY, TODAY);
    await saveProfileAndGoal(female, loseHalf, TODAY);
    await setOverride('kcal', 900, TODAY);
    expect(getTargetsForDate(TODAY)!.kcal).toBe(1200);
  });

  it('rejects hand-edited macros that add up to less than the minimum', async () => {
    await logWeight(80, TODAY, TODAY);
    await saveProfileAndGoal(male, loseHalf, TODAY);
    await setOverride('protein_g', 100, TODAY);
    await setOverride('carbs_g', 100, TODAY);
    expect(await setOverride('fat_g', 40, TODAY)).toEqual({ ok: false, kcal: 1160, min: 1500 });
    expect(getSettings().nutrition!.overrides.fat_g).toBeUndefined();
  });

  it('fixing or deleting a weigh-in updates the average and recalculates targets', async () => {
    await logWeight(80, '2026-10-10', '2026-10-10');
    await saveProfileAndGoal(male, loseHalf, '2026-10-10');
    await logWeight(58, TODAY, TODAY); // typo
    const [typo] = await weightHistory();
    await updateWeight(typo!.id, 78, TODAY);
    expect(await currentWeightKg(TODAY)).toBe(78);
    expect(getTargetsForDate(TODAY)).toMatchObject({ protein_g: 156 });
    await deleteWeight(typo!.id, TODAY);
    expect((await weightHistory()).map((w) => w.value)).toEqual([80]);
    expect(getTargetsForDate(TODAY)).toMatchObject({ protein_g: 160 });
  });
});
