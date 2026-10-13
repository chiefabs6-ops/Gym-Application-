/**
 * Supersets / circuits. Exercises that share a `superset_group` value (any short string) and sit next to
 * each other in the workout or routine order form one superset. They're labelled by order of appearance:
 * A1, A2 (, A3 … for a circuit), then B1, B2, … Everything here works on the ordered list of group values,
 * so the same helpers serve routines (template JSON) and live workouts (session_exercises rows).
 */
export type GroupList = readonly (string | null)[];

/** Fresh short group id. Only needs to be unique within one workout / routine. */
export const newGroupId = () => Math.random().toString(36).slice(2, 10);

/**
 * Drops groups that aren't real supersets: a value used by a single exercise, or a value that reappears
 * after a gap (only the first contiguous run keeps it). Returns a cleaned copy.
 */
export function normalizeGroups(groups: GroupList): (string | null)[] {
  const out = [...groups];
  const seen = new Set<string>();
  let i = 0;
  while (i < out.length) {
    const g = out[i];
    if (!g) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < out.length && out[j + 1] === g) j++;
    if (seen.has(g) || j === i) for (let k = i; k <= j; k++) out[k] = null;
    seen.add(g);
    i = j + 1;
  }
  return out;
}

/** "A1", "A2", null, "B1", "B2" … for each position (null = not in a superset). */
export function supersetLabels(groups: GroupList): (string | null)[] {
  const clean = normalizeGroups(groups);
  const labels: (string | null)[] = [];
  let letter = -1;
  let n = 0;
  clean.forEach((g, i) => {
    if (!g) {
      labels.push(null);
      return;
    }
    if (i === 0 || clean[i - 1] !== g) {
      letter++;
      n = 0;
    }
    n++;
    labels.push(`${String.fromCharCode(65 + (letter % 26))}${n}`);
  });
  return labels;
}

/** Indices of the superset containing `index` (just [index] when it isn't in one). */
export function supersetMembers(groups: GroupList, index: number): number[] {
  const clean = normalizeGroups(groups);
  const g = clean[index];
  if (!g) return [index];
  let start = index;
  let end = index;
  while (start > 0 && clean[start - 1] === g) start--;
  while (end + 1 < clean.length && clean[end + 1] === g) end++;
  return Array.from({ length: end - start + 1 }, (_, k) => start + k);
}

/** Is `index` linked to the exercise after it? */
export const isLinkedWithNext = (groups: GroupList, index: number) => {
  const clean = normalizeGroups(groups);
  return !!clean[index] && clean[index] === clean[index + 1];
};

/** Links `index` with the next exercise (joining or merging their supersets). */
export function linkWithNext(groups: GroupList, index: number, makeId: () => string = newGroupId): (string | null)[] {
  const out = normalizeGroups(groups);
  if (index < 0 || index + 1 >= out.length) return out;
  const a = out[index];
  const b = out[index + 1];
  const target = a ?? b ?? makeId();
  out[index] = target;
  out[index + 1] = target;
  if (b && b !== target) for (let k = index + 1; k < out.length && (out[k] === b || k === index + 1); k++) out[k] = target;
  return normalizeGroups(out);
}

/** Splits the superset between `index` and the next exercise. */
export function unlinkFromNext(groups: GroupList, index: number, makeId: () => string = newGroupId): (string | null)[] {
  const out = normalizeGroups(groups);
  const g = out[index];
  if (!g || out[index + 1] !== g) return out;
  const fresh = makeId();
  for (let k = index + 1; k < out.length && out[k] === g; k++) out[k] = fresh;
  return normalizeGroups(out);
}

/**
 * What happens after a set of exercise `at` is ticked. Inside a superset: go straight to the next member that
 * still has sets this round (no rest yet); after the last one, rest and go back to the first member with sets
 * left. Outside a superset (or nothing left to move to): rest, stay. `hasOpenSets(i)` must already treat the
 * just-ticked set as done.
 */
export function afterSetCompleted(
  groups: GroupList,
  at: number,
  hasOpenSets: (index: number) => boolean,
): { skipRest: boolean; nextIndex: number | null } {
  const members = supersetMembers(groups, at);
  if (members.length < 2) return { skipRest: false, nextIndex: null };
  const pos = members.indexOf(at);
  const later = members.slice(pos + 1).find(hasOpenSets);
  if (later !== undefined) return { skipRest: true, nextIndex: later };
  const first = members.find(hasOpenSets);
  return { skipRest: false, nextIndex: first !== undefined && first !== at ? first : null };
}
