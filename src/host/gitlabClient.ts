import type { HostClient, HostInfo, PrInfo } from '../types';
import type { AuthBroker } from '../auth/authBroker';

export class GitlabClient implements HostClient {
  private avatarCache = new Map<string, string | undefined>();
  private prCache = new Map<string, PrInfo | undefined>();

  constructor(private host: HostInfo, private auth: AuthBroker) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json' };
    const token = this.auth.getGitlabToken();
    if (token) h['PRIVATE-TOKEN'] = token;
    return h;
  }

  private projectId(): string {
    return encodeURIComponent(`${this.host.owner}/${this.host.repo}`);
  }

  async resolveAvatar(email: string): Promise<string | undefined> {
    if (this.avatarCache.has(email)) return this.avatarCache.get(email);
    try {
      const url = `${this.host.baseUrl}/users?search=${encodeURIComponent(email)}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) throw new Error(`${res.status}`);
      const users = await res.json() as Array<{ avatar_url?: string }>;
      const avatar = users[0]?.avatar_url;
      this.avatarCache.set(email, avatar);
      return avatar;
    } catch {
      this.avatarCache.set(email, undefined);
      return undefined;
    }
  }

  async resolvePr(sha: string): Promise<PrInfo | undefined> {
    if (this.prCache.has(sha)) return this.prCache.get(sha);
    try {
      const url = `${this.host.baseUrl}/projects/${this.projectId()}/repository/commits/${sha}/merge_requests`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) throw new Error(`${res.status}`);
      const mrs = await res.json() as Array<{ iid: number; title: string; web_url: string }>;
      const mr = mrs[0];
      const info = mr ? { number: mr.iid, title: mr.title, url: mr.web_url } : undefined;
      this.prCache.set(sha, info);
      return info;
    } catch {
      this.prCache.set(sha, undefined);
      return undefined;
    }
  }

  commitUrl(sha: string): string {
    return `${this.host.webBaseUrl}/${this.host.owner}/${this.host.repo}/-/commit/${sha}`;
  }
}
