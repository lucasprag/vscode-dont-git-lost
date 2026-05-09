import { describe, it, expect } from 'vitest';
import { Navigator } from '../../src/timeTravel/navigator';
import type { CommitRef } from '../../src/types';

const refs: CommitRef[] = [
  { sha: 'a'.repeat(40), prevPath: 'a.txt' },
  { sha: 'b'.repeat(40), prevPath: 'a.txt' },
  { sha: 'c'.repeat(40), prevPath: 'a.txt' },
];

describe('Navigator', () => {
  it('back from HEAD lands on the newest historical commit', async () => {
    const nav = new Navigator(async () => refs);
    const target = await nav.back('/repo/a.txt');
    expect(target).toEqual(refs[0]);
    expect(nav.getIndex('/repo/a.txt')).toBe(0);
  });

  it('successive back walks older', async () => {
    const nav = new Navigator(async () => refs);
    await nav.back('/repo/a.txt');
    const t = await nav.back('/repo/a.txt');
    expect(t).toEqual(refs[1]);
  });

  it('forward returns to HEAD when at index 0', async () => {
    const nav = new Navigator(async () => refs);
    await nav.back('/repo/a.txt');
    const t = await nav.forward('/repo/a.txt');
    expect(t).toBe('head');
    expect(nav.getIndex('/repo/a.txt')).toBe(-1);
  });

  it('back at oldest commit returns "noop"', async () => {
    const nav = new Navigator(async () => refs);
    await nav.back('/repo/a.txt');
    await nav.back('/repo/a.txt');
    await nav.back('/repo/a.txt');
    const t = await nav.back('/repo/a.txt');
    expect(t).toBe('noop');
  });

  it('returnToHead resets index to -1', async () => {
    const nav = new Navigator(async () => refs);
    await nav.back('/repo/a.txt');
    await nav.back('/repo/a.txt');
    nav.returnToHead('/repo/a.txt');
    expect(nav.getIndex('/repo/a.txt')).toBe(-1);
  });

  it('setIndex rehydrates state when reopening a historical URI', async () => {
    const nav = new Navigator(async () => refs);
    await nav.ensureLoaded('/repo/a.txt');
    nav.setIndex('/repo/a.txt', 1);
    expect(nav.current('/repo/a.txt')).toEqual(refs[1]);
  });
});
