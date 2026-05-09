import type { HostClient, HostInfo } from '../types';
import { GithubClient } from './githubClient';
import { GitlabClient } from './gitlabClient';
import { BitbucketClient } from './bitbucketClient';
import type { AuthBroker } from '../auth/authBroker';

export function createHostClient(host: HostInfo, auth: AuthBroker): HostClient | undefined {
  switch (host.type) {
    case 'github': return new GithubClient(host, auth);
    case 'gitlab': return new GitlabClient(host, auth);
    case 'bitbucket': return new BitbucketClient(host, auth);
  }
}
