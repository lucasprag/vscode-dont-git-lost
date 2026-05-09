import { LRUCache } from 'lru-cache';
import type { CommitRef } from '../types';

export type HistoryFetcher = (path: string, headSha: string) => Promise<CommitRef[]>;

export class HistoryCache {
  private cache = new LRUCache<string, CommitRef[]>({ max: 100 });
  constructor(private fetcher: HistoryFetcher) {}

  async get(path: string, headSha: string): Promise<CommitRef[]> {
    const key = `${headSha}:${path}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const fresh = await this.fetcher(path, headSha);
    this.cache.set(key, fresh);
    return fresh;
  }

  invalidate(path: string): void {
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${path}`)) this.cache.delete(key);
    }
  }
}
