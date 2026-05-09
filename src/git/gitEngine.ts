import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BlameLine, CommitInfo } from '../types';

const execFileAsync = promisify(execFile);

export interface GitExecResult {
  stdout: string;
  stderr: string;
}

interface PartialCommit {
  sha?: string;
  authorName?: string;
  authorEmail?: string;
  authorTime?: number;
  summary?: string;
}

export const ZERO_SHA = '0000000000000000000000000000000000000000';

export class GitEngine {
  async exec(cwd: string, args: string[], opts: { maxBuffer?: number } = {}): Promise<GitExecResult> {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: opts.maxBuffer ?? 50 * 1024 * 1024,
    });
    return { stdout, stderr };
  }

  async revParseHead(cwd: string): Promise<string> {
    const { stdout } = await this.exec(cwd, ['rev-parse', 'HEAD']);
    return stdout.trim();
  }

  async blame(repoRoot: string, relPath: string, ref?: string): Promise<BlameLine[]> {
    const args = ['blame', '--porcelain', '--root', '--incremental'];
    if (ref) args.push(ref);
    args.push('--', relPath);
    const { stdout } = await this.exec(repoRoot, args);
    return parsePorcelain(stdout);
  }
}

export function parsePorcelain(out: string): BlameLine[] {
  const commits = new Map<string, PartialCommit>();
  const result: BlameLine[] = [];

  const lines = out.split('\n');
  let i = 0;
  while (i < lines.length) {
    const headerMatch = lines[i].match(/^([0-9a-f]{40}) (\d+) (\d+)(?: (\d+))?$/);
    if (!headerMatch) { i++; continue; }

    const sha = headerMatch[1];
    const finalLine = parseInt(headerMatch[3], 10) - 1; // 0-indexed
    const numLines = parseInt(headerMatch[4] ?? '1', 10);

    let commit = commits.get(sha);
    if (!commit) {
      commit = { sha };
      commits.set(sha, commit);
    }

    // Read header lines until we reach a header for the next chunk or EOF.
    i++;
    while (i < lines.length && !/^[0-9a-f]{40} \d+ \d+/.test(lines[i])) {
      const line = lines[i];
      if (line.startsWith('author ')) commit.authorName = line.slice(7);
      else if (line.startsWith('author-mail ')) {
        const email = line.slice(12);
        commit.authorEmail = email.replace(/^<|>$/g, '');
      } else if (line.startsWith('author-time ')) {
        commit.authorTime = parseInt(line.slice(12), 10);
      } else if (line.startsWith('summary ')) {
        commit.summary = line.slice(8);
      }
      i++;
    }

    for (let n = 0; n < numLines; n++) {
      result.push({
        lineNumber: finalLine + n,
        commit: toCommitInfo(commit),
        isUncommitted: sha === ZERO_SHA,
      });
    }
  }

  result.sort((a, b) => a.lineNumber - b.lineNumber);
  return result;
}

function toCommitInfo(p: PartialCommit): CommitInfo {
  const sha = p.sha ?? ZERO_SHA;
  return {
    sha,
    shortSha: sha.slice(0, 7),
    authorName: p.authorName ?? '',
    authorEmail: p.authorEmail ?? '',
    authorTime: p.authorTime ?? 0,
    summary: p.summary ?? '',
    body: '',
  };
}
