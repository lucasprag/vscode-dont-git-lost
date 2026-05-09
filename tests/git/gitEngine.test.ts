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

describe('GitEngine.blame', () => {
  it('returns one entry per line with author and commit info', async () => {
    repo = await makeTempRepo();
    await repo.commit(
      'a.txt',
      'first line\nsecond line\n',
      'add a.txt',
      { author: 'Alice', email: 'alice@example.com', date: '2025-01-01T00:00:00Z' }
    );
    const engine = new GitEngine();
    const lines = await engine.blame(repo.root, 'a.txt');
    expect(lines).toHaveLength(2);
    expect(lines[0].lineNumber).toBe(0);
    expect(lines[0].commit.authorName).toBe('Alice');
    expect(lines[0].commit.authorEmail).toBe('alice@example.com');
    expect(lines[0].commit.summary).toBe('add a.txt');
    expect(lines[0].commit.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(lines[0].isUncommitted).toBe(false);
  });

  it('marks uncommitted lines (sha all zeros)', async () => {
    repo = await makeTempRepo();
    await repo.commit('a.txt', 'committed line\n', 'commit it');
    // append an uncommitted line on disk
    const { writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    await writeFile(join(repo.root, 'a.txt'), 'committed line\nuncommitted line\n');
    const engine = new GitEngine();
    const lines = await engine.blame(repo.root, 'a.txt');
    expect(lines).toHaveLength(2);
    expect(lines[0].isUncommitted).toBe(false);
    expect(lines[1].isUncommitted).toBe(true);
  });
});
