import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../exercises';
import { FORM_GUIDES, getFormGuide } from '../formGuides';

describe('form guides', () => {
  it('covers every canonical exercise', () => {
    const missing = DEFAULT_EXERCISES.filter((e) => !FORM_GUIDES[e.id]).map((e) => e.name);
    expect(missing).toEqual([]);
  });

  it('has at least one step for each guide', () => {
    for (const guide of Object.values(FORM_GUIDES)) expect(guide.steps.length).toBeGreaterThan(0);
  });

  it('returns null for exercises without a guide', () => {
    expect(getFormGuide('00000000-0000-4000-8000-999999999999')).toBeNull();
  });
});
