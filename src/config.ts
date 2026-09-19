import * as vscode from 'vscode';
import { HoverTrigger } from './hover/hoverTrigger';

export interface SelfHostedEntry {
  type: 'github' | 'gitlab' | 'bitbucket';
  baseUrl: string;
  webBaseUrl?: string;
}

export interface DontGitLostConfig {
  blameEnabled: boolean;
  blameFormat: string;
  blameMessageMaxLength: number;
  hoverTrigger: HoverTrigger;
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
    hoverTrigger: c.get<HoverTrigger>('hover.trigger', 'annotation'),
    timeTravelEnabled: c.get<boolean>('timeTravel.enabled', true),
    gitlabToken: c.get<string>('host.gitlabToken', ''),
    bitbucketToken: c.get<string>('host.bitbucketToken', ''),
    selfHosted: c.get<Record<string, SelfHostedEntry>>('host.selfHosted', {}),
  };
}
