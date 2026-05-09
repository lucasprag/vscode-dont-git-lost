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

describe('GitEngine.logFollow', () => {
  it('returns commits that touched the file, newest first, following renames', async () => {
    repo = await makeTempRepo();
    const c1 = await repo.commit('a.txt', 'v1\n', 'add a.txt');
    const c2 = await repo.commit('a.txt', 'v2\n', 'edit a.txt');
    const c3 = await repo.rename('a.txt', 'b.txt', 'rename to b.txt');
    const c4 = await repo.commit('b.txt', 'v3\n', 'edit b.txt');

    const engine = new GitEngine();
    const refs = await engine.logFollow(repo.root, 'b.txt');
    const shas = refs.map((r) => r.sha);
    expect(shas).toEqual([c4, c3, c2, c1]);
    // path-at-commit reflects renames
    expect(refs[0].prevPath).toBe('b.txt');
    expect(refs[3].prevPath).toBe('a.txt');
  });
});

describe('GitEngine.show', () => {
  it('returns the file content at a specific sha', async () => {
    repo = await makeTempRepo();
    const c1 = await repo.commit('a.txt', 'first\n', 'first');
    await repo.commit('a.txt', 'second\n', 'second');
    const engine = new GitEngine();
    const content = await engine.show(repo.root, c1, 'a.txt');
    expect(content).toBe('first\n');
  });
});
