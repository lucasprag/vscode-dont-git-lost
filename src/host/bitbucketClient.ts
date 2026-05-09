import type { HostClient, HostInfo, PrInfo } from '../types';
import type { AuthBroker } from '../auth/authBroker';

export class BitbucketClient implements HostClient {
  private prCache = new Map<string, PrInfo | undefined>();

  constructor(private host: HostInfo, private auth: AuthBroker) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json' };
    const token = this.auth.getBitbucketToken();
    if (token) {
      // Bitbucket app passwords use Basic with username:apppassword.
      // We accept the token in the form "username:apppassword".
      h['Authorization'] = `Basic ${Buffer.from(token).toString('base64')}`;
    }
    return h;
  }

  async resolveAvatar(_email: string, _sha: string): Promise<string | undefined> {
    // Bitbucket Cloud doesn't expose a public "user by email" endpoint without admin scope.
    // Skip avatar lookup; return undefined so the hover card falls back to no avatar.
    return undefined;
  }

  async resolvePr(sha: string): Promise<PrInfo | undefined> {
    if (this.prCache.has(sha)) return this.prCache.get(sha);
    try {
      const url = `${this.host.baseUrl}/repositories/${this.host.owner}/${this.host.repo}/commit/${sha}/pullrequests`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { values?: Array<{ id: number; title: string; links: { html: { href: string } } }> };
      const pr = data.values?.[0];
      const info = pr ? { number: pr.id, title: pr.title, url: pr.links.html.href } : undefined;
      this.prCache.set(sha, info);
      return info;
    } catch {
      this.prCache.set(sha, undefined);
      return undefined;
    }
  }

  commitUrl(sha: string): string {
    return `${this.host.webBaseUrl}/${this.host.owner}/${this.host.repo}/commits/${sha}`;
  }
}
