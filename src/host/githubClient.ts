import { Octokit } from '@octokit/rest';
import type { HostClient, HostInfo, PrInfo } from '../types';
import type { AuthBroker } from '../auth/authBroker';

export class GithubClient implements HostClient {
  private avatarCache = new Map<string, string | undefined>();
  private prCache = new Map<string, PrInfo | undefined>();
  private octokitInstance: Octokit | undefined;

  constructor(private host: HostInfo, private auth: AuthBroker) {}

  private async octokit(): Promise<Octokit> {
    if (this.octokitInstance) return this.octokitInstance;
    const token = await this.auth.getGithubToken(true);
    this.octokitInstance = new Octokit({ auth: token, baseUrl: this.host.baseUrl });
    return this.octokitInstance;
  }

  async resolveAvatar(_email: string, sha: string): Promise<string | undefined> {
    if (this.avatarCache.has(sha)) return this.avatarCache.get(sha);
    try {
      const octokit = await this.octokit();
      const res = await octokit.repos.getCommit({
        owner: this.host.owner,
        repo: this.host.repo,
        ref: sha,
      });
      const url = res.data.author?.avatar_url;
      this.avatarCache.set(sha, url);
      return url;
    } catch {
      this.avatarCache.set(sha, undefined);
      return undefined;
    }
  }

  async resolvePr(sha: string): Promise<PrInfo | undefined> {
    if (this.prCache.has(sha)) return this.prCache.get(sha);
    try {
      const octokit = await this.octokit();
      const res = await octokit.repos.listPullRequestsAssociatedWithCommit({
        owner: this.host.owner,
        repo: this.host.repo,
        commit_sha: sha,
      });
      const pr = res.data[0];
      const info = pr ? { number: pr.number, title: pr.title, url: pr.html_url } : undefined;
      this.prCache.set(sha, info);
      return info;
    } catch {
      this.prCache.set(sha, undefined);
      return undefined;
    }
  }

  commitUrl(sha: string): string {
    return `${this.host.webBaseUrl}/${this.host.owner}/${this.host.repo}/commit/${sha}`;
  }
}
