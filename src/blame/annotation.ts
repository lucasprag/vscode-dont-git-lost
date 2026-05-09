import type { CommitInfo } from '../types';

export function formatAgo(authorTimeSec: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor(nowMs / 1000) - authorTimeSec);
  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const units: Array<[number, string]> = [
    [60, 'minute'],
    [60 * 60, 'hour'],
    [60 * 60 * 24, 'day'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 365, 'year'],
  ];

  let chosen: [number, string] = units[0];
  for (const u of units) {
    if (diffSec >= u[0]) chosen = u;
  }
  const value = Math.floor(diffSec / chosen[0]);
  const word = value === 1 ? chosen[1] : `${chosen[1]}s`;
  return `${value} ${word} ago`;
}

export interface AnnotationContext {
  pr?: { number: number };
}

export function formatAnnotation(
  commit: CommitInfo,
  template: string,
  messageMaxLength: number,
  nowMs: number,
  ctx: AnnotationContext = {}
): string {
  const date = new Date(commit.authorTime * 1000).toISOString().slice(0, 10);
  const tokens: Record<string, string> = {
    author: commit.authorName,
    ago: formatAgo(commit.authorTime, nowMs),
    date,
    sha: commit.shortSha,
    message: truncate(commit.summary, messageMaxLength),
    pr: ctx.pr ? `#${ctx.pr.number}` : '',
  };
  return template.replace(/\$\{(author|ago|date|sha|message|pr)\}/g, (_, k) => tokens[k] ?? '');
}

function truncate(s: string, max: number): string {
  if (max <= 0 || s.length <= max) return s;
  if (max === 1) return '…';
  return s.slice(0, max - 1) + '…';
}
