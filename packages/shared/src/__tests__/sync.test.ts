import { describe, expect, it } from 'vitest';
import { resolveWrite } from '../sync';

const row = (updated_at: number, deleted_at: number | null = null) => ({ updated_at, deleted_at });

describe('resolveWrite', () => {
  it('inserts unknown rows, including tombstones', () => {
    expect(resolveWrite({ strategy: 'lww', op: 'create', existing: null, incoming: row(1) })).toBe('insert');
    expect(resolveWrite({ strategy: 'lww', op: 'delete', existing: null, incoming: row(1, 1) })).toBe('insert');
  });

  it('applies LWW on updated_at, accepting equal timestamps for idempotent replays', () => {
    expect(resolveWrite({ strategy: 'lww', op: 'update', existing: row(10), incoming: row(20) })).toBe('update');
    expect(resolveWrite({ strategy: 'lww', op: 'update', existing: row(10), incoming: row(10) })).toBe('update');
    expect(resolveWrite({ strategy: 'lww', op: 'update', existing: row(20), incoming: row(10) })).toBe('skip_stale');
  });

  it('never lets a create overwrite an append-only row', () => {
    expect(resolveWrite({ strategy: 'append_only', op: 'create', existing: row(1), incoming: row(99) })).toBe(
      'skip_exists',
    );
    expect(resolveWrite({ strategy: 'append_only', op: 'update', existing: row(1), incoming: row(99) })).toBe(
      'update',
    );
  });

  it('never resurrects tombstones', () => {
    expect(resolveWrite({ strategy: 'lww', op: 'update', existing: row(5, 5), incoming: row(99) })).toBe(
      'skip_deleted',
    );
  });
});
