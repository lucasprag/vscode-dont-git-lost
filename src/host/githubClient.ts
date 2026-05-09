import { Octokit } from '@octokit/rest';
import type { HostClient, HostInfo, PrInfo } from '../types';
import type { AuthBroker } from '../auth/authBroker';

export class GithubClient implements HostClient {
  private avatarCache = new Map<string, string | undefined>();
  private prCache = new Map<string, PrInfo | undefined>();

  constructor(private host: HostInfo, private auth: AuthBroker) {}

  private async octokit(): Promise<Octokit> {
    const token = await this.auth.getGithubToken(true);
    return new Octokit({ auth: token, baseUrl: this.host.baseUrl });
  }

  async resolveAvatar(email: string): Promise<string | undefined> {
    if (this.avatarCache.has(email)) return this.avatarCache.get(email);
    try {
      const octokit = await this.octokit();
      const res = await octokit.search.users({ q: `${email} in:email` });
      const user = res.data.items[0];
      const url = user?.avatar_url;
      this.avatarCache.set(email, url);
      return url;
    } catch {
      this.avatarCache.set(email, undefined);
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
