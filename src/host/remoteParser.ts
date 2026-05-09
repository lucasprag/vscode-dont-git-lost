export interface ParsedRemote {
  hostDomain: string;
  owner: string;
  repo: string;
}

export function parseRemote(url: string): ParsedRemote | undefined {
  const trimmed = url.trim().replace(/\.git$/, '');
  // ssh: git@host:owner/repo OR git@host:group/sub/repo (no :// in ssh)
  if (trimmed.includes('@') && !trimmed.includes('://')) {
    const ssh = trimmed.match(/^[^@]+@([^:]+):(.+?)\/([^/]+)$/);
    if (ssh) {
      return { hostDomain: ssh[1], owner: ssh[2], repo: ssh[3] };
    }
  }
  // https: https://host/owner/repo OR https://host/group/sub/repo
  try {
    const u = new URL(trimmed);
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return undefined;
    const repo = segments[segments.length - 1];
    const owner = segments.slice(0, -1).join('/');
    return { hostDomain: u.host, owner, repo };
  } catch {
    return undefined;
  }
}
