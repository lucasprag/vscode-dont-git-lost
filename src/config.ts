import * as vscode from 'vscode';

export interface SelfHostedEntry {
  type: 'github' | 'gitlab' | 'bitbucket';
  baseUrl: string;
  webBaseUrl?: string;
}

export interface GitLostConfig {
  blameEnabled: boolean;
  blameFormat: string;
  blameMessageMaxLength: number;
  timeTravelEnabled: boolean;
  gitlabToken: string;
  bitbucketToken: string;
  selfHosted: Record<string, SelfHostedEntry>;
}

export function readConfig(): GitLostConfig {
  const c = vscode.workspace.getConfiguration('gitlost');
  return {
    blameEnabled: c.get<boolean>('blame.enabled', true),
    blameFormat: c.get<string>('blame.format', '${author}, ${ago} • ${message}'),
    blameMessageMaxLength: c.get<number>('blame.messageMaxLength', 80),
    timeTravelEnabled: c.get<boolean>('timeTravel.enabled', true),
    gitlabToken: c.get<string>('host.gitlabToken', ''),
    bitbucketToken: c.get<string>('host.bitbucketToken', ''),
    selfHosted: c.get<Record<string, SelfHostedEntry>>('host.selfHosted', {}),
  };
}
