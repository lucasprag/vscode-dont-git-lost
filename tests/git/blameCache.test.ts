import { describe, it, expect, vi } from 'vitest';
import { BlameCache } from '../../src/git/blameCache';
import type { BlameLine } from '../../src/types';

const fakeLine = (n: number): BlameLine => ({
  lineNumber: n,
  commit: {
    sha: 'abc'.padEnd(40, '0'),
    shortSha: 'abc0000',
    authorName: 'A',
    authorEmail: 'a@b.c',
    authorTime: 0,
    summary: '',
    body: '',
  },
  isUncommitted: false,
});

describe('BlameCache', () => {
  it('caches by (path, head); a second call does not re-fetch', async () => {
    const fetch = vi.fn().mockResolvedValue([fakeLine(0)]);
    const cache = new BlameCache(fetch);
    await cache.get('/a.txt', 'sha1');
    await cache.get('/a.txt', 'sha1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('invalidate(path) clears entries for that path', async () => {
    const fetch = vi.fn().mockResolvedValue([fakeLine(0)]);
    const cache = new BlameCache(fetch);
    await cache.get('/a.txt', 'sha1');
    cache.invalidate('/a.txt');
    await cache.get('/a.txt', 'sha1');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('different head shas are different cache keys', async () => {
    const fetch = vi.fn().mockResolvedValue([fakeLine(0)]);
    const cache = new BlameCache(fetch);
    await cache.get('/a.txt', 'sha1');
    await cache.get('/a.txt', 'sha2');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
