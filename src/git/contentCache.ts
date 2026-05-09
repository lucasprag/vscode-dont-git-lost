import { LRUCache } from 'lru-cache';

export type ContentFetcher = (repoRoot: string, sha: string, relPath: string) => Promise<string>;

export class ContentCache {
  private cache = new LRUCache<string, string>({ max: 30 });
  constructor(private fetcher: ContentFetcher) {}

  async get(repoRoot: string, sha: string, relPath: string): Promise<string> {
    const key = `${repoRoot}\0${sha}\0${relPath}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const fresh = await this.fetcher(repoRoot, sha, relPath);
    this.cache.set(key, fresh);
    return fresh;
  }
}
