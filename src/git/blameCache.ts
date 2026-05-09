import { LRUCache } from 'lru-cache';
import type { BlameLine } from '../types';

export type BlameFetcher = (path: string, headSha: string) => Promise<BlameLine[]>;

export class BlameCache {
  private cache = new LRUCache<string, BlameLine[]>({ max: 50 });

  constructor(private fetcher: BlameFetcher) {}

  async get(path: string, headSha: string): Promise<BlameLine[]> {
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

  clear(): void {
    this.cache.clear();
  }
}
