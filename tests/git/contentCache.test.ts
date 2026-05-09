import { describe, it, expect, vi } from 'vitest';
import { ContentCache } from '../../src/git/contentCache';

describe('ContentCache', () => {
  it('caches by (repoRoot, sha, relPath); never invalidates', async () => {
    const fetch = vi.fn().mockResolvedValue('content');
    const cache = new ContentCache(fetch);
    await cache.get('/repo', 'sha1', 'a.txt');
    await cache.get('/repo', 'sha1', 'a.txt');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
