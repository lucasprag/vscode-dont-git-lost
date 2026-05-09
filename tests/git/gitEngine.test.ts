import { describe, it, expect, afterEach } from 'vitest';
import { GitEngine } from '../../src/git/gitEngine';
import { makeTempRepo, type TempRepo } from '../helpers/tempRepo';

let repo: TempRepo | undefined;

afterEach(async () => {
  if (repo) {
    await repo.cleanup();
    repo = undefined;
  }
});

describe('GitEngine.revParseHead', () => {
  it('returns the current HEAD sha', async () => {
    repo = await makeTempRepo();
    const sha = await repo.commit('a.txt', 'hello', 'first');
    const engine = new GitEngine();
    const head = await engine.revParseHead(repo.root);
    expect(head).toBe(sha);
  });
});
