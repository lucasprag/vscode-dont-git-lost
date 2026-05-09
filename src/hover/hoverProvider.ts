import * as vscode from 'vscode';
import { buildHoverMarkdown, type HostMissing } from './hoverCard';
import type { BlameCache } from '../git/blameCache';
import type { RepoLocator } from '../git/repoLocator';
import type { GitEngine } from '../git/gitEngine';
import { resolveHost } from '../host/hostResolver';
import { createHostClient } from '../host/hostClientFactory';
import type { AuthBroker } from '../auth/authBroker';
import { readConfig } from '../config';

export class GitLostHoverProvider implements vscode.HoverProvider {
  constructor(
    private gitEngine: GitEngine,
    private blameCache: BlameCache,
    private repoLocator: RepoLocator,
    private auth: AuthBroker,
  ) {}

  async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    if (document.uri.scheme !== 'file') return undefined;
    const match = this.repoLocator.locate(document.uri);
    if (!match || !match.headSha) return undefined;

    const blame = await this.blameCache.get(match.relPath, match.headSha);
    const entry = blame.find((b) => b.lineNumber === position.line);
    if (!entry || entry.isUncommitted) return undefined;

    let commitBody = entry.commit.body;
    if (!commitBody) {
      try {
        commitBody = await this.gitEngine.commitBody(match.repoRoot, entry.commit.sha);
      } catch {
        commitBody = '';
      }
    }
    const commit = { ...entry.commit, body: commitBody };

    let avatarUrl: string | undefined;
    let commitUrl: string | undefined;
    let pr: { number: number; title: string; url: string } | undefined;
    let hostMissing: HostMissing | undefined;

    try {
      const remoteOut = await this.gitEngine.exec(match.repoRoot, ['remote', 'get-url', 'origin']);
      const host = resolveHost(remoteOut.stdout.trim(), readConfig().selfHosted);
      if (host) {
        const client = createHostClient(host, this.auth);
        if (client) {
          commitUrl = client.commitUrl(entry.commit.sha);
          [avatarUrl, pr] = await Promise.all([
            client.resolveAvatar(entry.commit.authorEmail, entry.commit.sha),
            client.resolvePr(entry.commit.sha),
          ]);
          if (host.type === 'github' && !(await this.auth.getGithubToken(true))) {
            hostMissing = 'github-auth';
          } else if (host.type === 'gitlab' && !this.auth.getGitlabToken()) {
            hostMissing = 'gitlab-token';
          } else if (host.type === 'bitbucket' && !this.auth.getBitbucketToken()) {
            hostMissing = 'bitbucket-token';
          }
        }
      }
    } catch { /* origin not set or not a github/gitlab/bitbucket repo; show commit-only card */ }

    const md = new vscode.MarkdownString(
      buildHoverMarkdown({
        commit,
        avatarUrl,
        commitUrl,
        pr,
        hostMissing,
        nowMs: Date.now(),
      }),
      true,
    );
    md.isTrusted = true;
    md.supportThemeIcons = true;
    md.supportHtml = true;
    const range = document.lineAt(position.line).range;
    return new vscode.Hover(md, range);
  }
}
