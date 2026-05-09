import type { HostClient, HostInfo } from '../types';
import { GithubClient } from './githubClient';
import type { AuthBroker } from '../auth/authBroker';

export function createHostClient(host: HostInfo, auth: AuthBroker): HostClient | undefined {
  switch (host.type) {
    case 'github': return new GithubClient(host, auth);
    case 'gitlab': return undefined;     // implemented in Task 23
    case 'bitbucket': return undefined;  // implemented in Task 23
  }
}
