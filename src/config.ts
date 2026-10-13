import * as vscode from 'vscode';

export interface SelfHostedEntry {
  type: 'github' | 'gitlab' | 'bitbucket';
  baseUrl: string;
  webBaseUrl?: string;
}

export type DateTimezone = 'commit' | 'current' | 'utc';

export interface DontGitLostConfig {
  blameEnabled: boolean;
  blameFormat: string;
  blameMessageMaxLength: number;
  dateFormat: string;
  dateTimezone: DateTimezone;
  timeTravelEnabled: boolean;
  gitlabToken: string;
  bitbucketToken: string;
  selfHosted: Record<string, SelfHostedEntry>;
}

export function readConfig(): DontGitLostConfig {
  const c = vscode.workspace.getConfiguration('dontgitlost');
  return {
    blameEnabled: c.get<boolean>('blame.enabled', true),
    blameFormat: c.get<string>('blame.format', '${author}, ${ago} • ${message}'),
    blameMessageMaxLength: c.get<number>('blame.messageMaxLength', 80),
    dateFormat: c.get<string>('date.format', 'ddd, DD MMM YYYY HH:mm:ss Z'),
    dateTimezone: c.get<DateTimezone>('date.timezone', 'commit'),
    timeTravelEnabled: c.get<boolean>('timeTravel.enabled', true),
    gitlabToken: c.get<string>('host.gitlabToken', ''),
    bitbucketToken: c.get<string>('host.bitbucketToken', ''),
    selfHosted: c.get<Record<string, SelfHostedEntry>>('host.selfHosted', {}),
  };
}
