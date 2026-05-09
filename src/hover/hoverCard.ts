import type { CommitInfo, PrInfo } from '../types';
import { formatAgo } from '../blame/annotation';

export type HostMissing = 'github-auth' | 'gitlab-token' | 'bitbucket-token';

export interface HoverInput {
  commit: CommitInfo;
  avatarUrl: string | undefined;
  commitUrl: string | undefined;
  pr: PrInfo | undefined;
  hostMissing: HostMissing | undefined;
  nowMs: number;
}

export function buildHoverMarkdown(input: HoverInput): string {
  const { commit, avatarUrl, commitUrl, pr, hostMissing, nowMs } = input;
  const parts: string[] = [];

  if (avatarUrl) {
    parts.push(`![avatar](${avatarUrl}|width=32)  **${escape(commit.authorName)}**  \n${escape(commit.authorEmail)}`);
  } else {
    parts.push(`**${escape(commit.authorName)}**  \n${escape(commit.authorEmail)}`);
  }

  parts.push(`**${escape(commit.summary)}**`);
  if (commit.body.trim()) {
    const body = commit.body.trim().split('\n').map((l) => `> ${escape(l)}`).join('\n');
    parts.push(body);
  }

  const date = new Date(commit.authorTime * 1000).toUTCString();
  parts.push(`\`${commit.shortSha}\` • ${date} (${formatAgo(commit.authorTime, nowMs)})`);

  const buttons: string[] = [];
  buttons.push(`[$(clippy) Copy SHA](command:gitlost.copySha?${encodeArg(commit.sha)})`);
  if (commitUrl) {
    buttons.push(`[$(link-external) Open commit](command:gitlost.openUrl?${encodeArg(commitUrl)})`);
  }
  if (pr) {
    buttons.push(`[$(git-pull-request) PR #${pr.number}](command:gitlost.openUrl?${encodeArg(pr.url)})`);
  }
  parts.push(buttons.join(' &nbsp; '));

  if (hostMissing === 'github-auth') {
    parts.push(`\n[$(sign-in) Sign in to GitHub](command:gitlost.signInGithub)`);
  } else if (hostMissing === 'gitlab-token') {
    parts.push(`\n[$(gear) Configure GitLab token](command:workbench.action.openSettings?${encodeArg('gitlost.host.gitlabToken')})`);
  } else if (hostMissing === 'bitbucket-token') {
    parts.push(`\n[$(gear) Configure Bitbucket token](command:workbench.action.openSettings?${encodeArg('gitlost.host.bitbucketToken')})`);
  }

  return parts.join('\n\n');
}

function encodeArg(value: string): string {
  return encodeURIComponent(JSON.stringify(value));
}

function escape(s: string): string {
  return s.replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'));
}
