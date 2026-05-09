import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitExecResult {
  stdout: string;
  stderr: string;
}

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
}
