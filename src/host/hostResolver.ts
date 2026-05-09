import { parseRemote } from './remoteParser';
import type { HostInfo, HostType } from '../types';
import type { SelfHostedEntry } from '../config';

export function resolveHost(remoteUrl: string, selfHosted: Record<string, SelfHostedEntry>): HostInfo | undefined {
  const parsed = parseRemote(remoteUrl);
  if (!parsed) return undefined;

  const sh = selfHosted[parsed.hostDomain];
  if (sh) {
    return {
      type: sh.type,
      baseUrl: sh.baseUrl,
      webBaseUrl: sh.webBaseUrl ?? `https://${parsed.hostDomain}`,
      owner: parsed.owner,
      repo: parsed.repo,
    };
  }

  let type: HostType | undefined;
  let baseUrl = '';
  let webBaseUrl = `https://${parsed.hostDomain}`;
  if (parsed.hostDomain === 'github.com') {
    type = 'github'; baseUrl = 'https://api.github.com';
  } else if (parsed.hostDomain === 'gitlab.com') {
    type = 'gitlab'; baseUrl = 'https://gitlab.com/api/v4';
  } else if (parsed.hostDomain === 'bitbucket.org') {
    type = 'bitbucket'; baseUrl = 'https://api.bitbucket.org/2.0';
  }
  if (!type) return undefined;
  return { type, baseUrl, webBaseUrl, owner: parsed.owner, repo: parsed.repo };
}
