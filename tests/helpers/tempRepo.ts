import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);

export interface TempRepo {
  root: string;
  cleanup: () => Promise<void>;
  commit: (path: string, content: string, message: string, opts?: { author?: string; email?: string; date?: string }) => Promise<string>;
  rename: (from: string, to: string, message: string) => Promise<string>;
  headSha: () => Promise<string>;
}

export async function makeTempRepo(): Promise<TempRepo> {
  const root = await mkdtemp(join(tmpdir(), 'dont-git-lost-test-'));
  await exec('git', ['init', '--initial-branch=main'], { cwd: root });
  await exec('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Test'], { cwd: root });
  await exec('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });

  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
    async commit(path, content, message, opts) {
      await writeFile(join(root, path), content);
      await exec('git', ['add', path], { cwd: root });
      const env: NodeJS.ProcessEnv = { ...process.env };
      if (opts?.author) env.GIT_AUTHOR_NAME = opts.author;
      if (opts?.email) env.GIT_AUTHOR_EMAIL = opts.email;
      if (opts?.date) {
        env.GIT_AUTHOR_DATE = opts.date;
        env.GIT_COMMITTER_DATE = opts.date;
      }
      await exec('git', ['commit', '-m', message], { cwd: root, env });
      const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
      return stdout.trim();
    },
    async rename(from, to, message) {
      await exec('git', ['mv', from, to], { cwd: root });
      await exec('git', ['commit', '-m', message], { cwd: root });
      const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
      return stdout.trim();
    },
    async headSha() {
      const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
      return stdout.trim();
    },
  };
}
