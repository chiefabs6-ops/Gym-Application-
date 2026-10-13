import { describe, expect, it } from 'vitest';
import {
  afterSetCompleted,
  isLinkedWithNext,
  linkWithNext,
  normalizeGroups,
  supersetLabels,
  supersetMembers,
  unlinkFromNext,
} from '../supersets';

let n = 0;
const id = () => `g${++n}`;

describe('supersets', () => {
  it('labels contiguous groups A1/A2, B1/B2 and ignores singletons and gaps', () => {
    expect(supersetLabels(['x', 'x', null, 'y', 'y', 'y'])).toEqual(['A1', 'A2', null, 'B1', 'B2', 'B3']);
    expect(supersetLabels(['x', null, 'x'])).toEqual([null, null, null]); // not contiguous
    expect(normalizeGroups(['x', 'x', null, 'x', 'x'])).toEqual(['x', 'x', null, null, null]);
    expect(supersetLabels(['solo', null])).toEqual([null, null]);
  });

  it('finds the members of a superset', () => {
    const g = [null, 'x', 'x', 'x', null];
    expect(supersetMembers(g, 2)).toEqual([1, 2, 3]);
    expect(supersetMembers(g, 0)).toEqual([0]);
    expect(isLinkedWithNext(g, 1)).toBe(true);
    expect(isLinkedWithNext(g, 3)).toBe(false);
  });

  it('links with the next exercise, growing or merging supersets', () => {
    n = 0;
    expect(linkWithNext([null, null, null], 0, id)).toEqual(['g1', 'g1', null]);
    expect(linkWithNext(['a', 'a', null], 1, id)).toEqual(['a', 'a', 'a']); // circuit of 3
    expect(linkWithNext(['a', 'a', 'b', 'b'], 1, id)).toEqual(['a', 'a', 'a', 'a']); // merge
    expect(linkWithNext([null, 'b', 'b'], 0, id)).toEqual(['b', 'b', 'b']);
    expect(linkWithNext([null], 0, id)).toEqual([null]); // nothing after it
  });

  it('unlinks, splitting or dissolving supersets', () => {
    n = 0;
    expect(unlinkFromNext(['a', 'a'], 0, id)).toEqual([null, null]);
    expect(unlinkFromNext(['a', 'a', 'a', 'a'], 1, id)).toEqual(['a', 'a', 'g2', 'g2']);
    expect(unlinkFromNext(['a', 'a', 'a'], 1, id)).toEqual(['a', 'a', null]);
    expect(unlinkFromNext([null, 'a', 'a'], 0, id)).toEqual([null, 'a', 'a']); // wasn't linked
  });
});

describe('after a set is ticked', () => {
  const g = ['a', 'a', 'a', null];
  it('moves through the round without rest, then rests and starts the next round', () => {
    expect(afterSetCompleted(g, 0, () => true)).toEqual({ skipRest: true, nextIndex: 1 });
    expect(afterSetCompleted(g, 1, () => true)).toEqual({ skipRest: true, nextIndex: 2 });
    expect(afterSetCompleted(g, 2, () => true)).toEqual({ skipRest: false, nextIndex: 0 });
  });
  it('skips members that are finished and rests when no one later has sets left', () => {
    expect(afterSetCompleted(g, 0, (i) => i === 2)).toEqual({ skipRest: true, nextIndex: 2 });
    expect(afterSetCompleted(g, 0, (i) => i === 0)).toEqual({ skipRest: false, nextIndex: null }); // only A1 left
    expect(afterSetCompleted(g, 2, () => false)).toEqual({ skipRest: false, nextIndex: null }); // all done
  });
  it('outside a superset just rests', () => {
    expect(afterSetCompleted(g, 3, () => true)).toEqual({ skipRest: false, nextIndex: null });
  });
});
