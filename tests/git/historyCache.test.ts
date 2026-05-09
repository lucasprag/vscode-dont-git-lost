import { describe, it, expect, vi } from 'vitest';
import { HistoryCache } from '../../src/git/historyCache';

describe('HistoryCache', () => {
  it('caches by (path, head)', async () => {
    const fetch = vi.fn().mockResolvedValue([{ sha: 'a'.repeat(40), prevPath: '/a' }]);
    const cache = new HistoryCache(fetch);
    await cache.get('/a', 'h1');
    await cache.get('/a', 'h1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
