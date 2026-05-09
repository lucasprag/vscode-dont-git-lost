import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BlameLine, CommitInfo, CommitRef } from '../types';

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

  async logFollow(repoRoot: string, relPath: string, ref = 'HEAD'): Promise<CommitRef[]> {
    const { stdout } = await this.exec(repoRoot, [
      'log',
      '--follow',
      '--name-status',
      '-z',
      '--format=%H%x00%P%x00',
      ref,
      '--',
      relPath,
    ]);
    return parseLogFollow(stdout);
  }

  async show(repoRoot: string, sha: string, relPath: string): Promise<string> {
    const { stdout } = await this.exec(repoRoot, ['show', `${sha}:${relPath}`]);
    return stdout;
  }

  async commitBody(repoRoot: string, sha: string): Promise<string> {
    const { stdout } = await this.exec(repoRoot, ['log', '-1', '--format=%b', sha]);
    return stdout.replace(/\n+$/, '');
  }
}

export function parseLogFollow(out: string): CommitRef[] {
  // Token layout (NUL-separated) per commit:
  //   <sha> \0 <parents> \0 "" \0 "\n<STATUS>" \0 <path(s)> \0 ...
  // For M/A:  sha, parents, "", "\nM", path  → next commit starts
  // For R:    sha, parents, "", "\nR100", oldPath, newPath → next commit starts
  // We track currentPath going backwards: renames update it to oldPath.
  const refs: CommitRef[] = [];
  const tokens = out.split('\0');
  let i = 0;

  while (i < tokens.length) {
    const shaToken = tokens[i];
    // SHA token is exactly 40 hex chars (the format emits it cleanly at start).
    if (!/^[0-9a-f]{40}$/.test(shaToken)) { i++; continue; }

    const sha = shaToken;
    // i+1 = parents (may be empty for root commit), i+2 = empty blank separator
    i += 3; // skip sha, parents, blank

    // i now points to the status token, which has a leading newline: "\nM", "\nR100", etc.
    if (i >= tokens.length) break;
    const statusToken = tokens[i].replace(/^\n/, '');

    if (statusToken.startsWith('R')) {
      // Rename: oldPath at i+1, newPath at i+2
      const newPath = tokens[i + 2] ?? '';
      // prevPath for this commit is newPath (the file's name *at* this commit)
      refs.push({ sha, prevPath: newPath });
      // Going further back in history, the file was called oldPath — but we
      // don't need to track that here; git --follow handles it in the log output.
      i += 3;
    } else if (/^[AMD]$/.test(statusToken)) {
      const path = tokens[i + 1] ?? '';
      refs.push({ sha, prevPath: path });
      i += 2;
    } else {
      i++;
    }
  }

  return refs;
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
