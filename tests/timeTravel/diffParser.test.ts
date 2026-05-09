import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../../src/timeTravel/diffParser';

describe('parseUnifiedDiff', () => {
  it('parses pure additions', () => {
    const diff = [
      'diff --git a/foo b/foo',
      'index abc..def 100644',
      '--- a/foo',
      '+++ b/foo',
      '@@ -5,0 +6,2 @@',
      '+new line 1',
      '+new line 2',
    ].join('\n');
    const r = parseUnifiedDiff(diff);
    expect(r.added).toEqual([{ start: 6, end: 7 }]);
    expect(r.deletedAbove).toEqual([]);
  });

  it('parses pure deletions, marker is on the line below the deletion', () => {
    const diff = [
      '@@ -3,2 +2,0 @@',
      '-removed A',
      '-removed B',
    ].join('\n');
    const r = parseUnifiedDiff(diff);
    expect(r.added).toEqual([]);
    // newStart=2 means deletion happened after new line 2. Marker on line 3.
    expect(r.deletedAbove).toEqual([3]);
  });

  it('handles deletion at the very start of file (newStart=0)', () => {
    const diff = [
      '@@ -1 +0,0 @@',
      '-first line removed',
    ].join('\n');
    const r = parseUnifiedDiff(diff);
    expect(r.deletedAbove).toEqual([1]);
  });

  it('parses modifications (both add and del in same hunk) as added range', () => {
    const diff = [
      '@@ -2 +2 @@',
      '-old',
      '+new',
    ].join('\n');
    const r = parseUnifiedDiff(diff);
    expect(r.added).toEqual([{ start: 2, end: 2 }]);
    expect(r.deletedAbove).toEqual([]);
  });

  it('parses multiple hunks of mixed kinds', () => {
    const diff = [
      '@@ -1 +1 @@',
      '-old A',
      '+new A',
      '@@ -10,2 +10,0 @@',
      '-deleted X',
      '-deleted Y',
      '@@ -20,0 +18,3 @@',
      '+added 1',
      '+added 2',
      '+added 3',
    ].join('\n');
    const r = parseUnifiedDiff(diff);
    expect(r.added).toEqual([
      { start: 1, end: 1 },
      { start: 18, end: 20 },
    ]);
    expect(r.deletedAbove).toEqual([11]);
  });

  it('treats hunk header without explicit count as count=1', () => {
    const diff = '@@ -3 +3 @@\n-x\n+y';
    const r = parseUnifiedDiff(diff);
    expect(r.added).toEqual([{ start: 3, end: 3 }]);
  });

  it('returns empty result for an empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual({ added: [], deletedAbove: [] });
  });

  it('ignores diff metadata lines', () => {
    const diff = [
      'diff --git a/foo b/foo',
      'similarity index 80%',
      'index abc..def 100644',
      '--- a/foo',
      '+++ b/foo',
    ].join('\n');
    const r = parseUnifiedDiff(diff);
    expect(r).toEqual({ added: [], deletedAbove: [] });
  });
});
