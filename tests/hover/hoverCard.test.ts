import { describe, it, expect } from 'vitest';
import { buildHoverMarkdown } from '../../src/hover/hoverCard';
import type { CommitInfo } from '../../src/types';

const commit: CommitInfo = {
  sha: 'a'.repeat(40),
  shortSha: 'aaaaaaa',
  authorName: 'Alex Willemsma',
  authorEmail: 'alex@example.com',
  authorTime: 1417000000,
  summary: 'First working version of cleaned-up production logs.',
  body: 'Multi-line body here.\nSecond line.',
};

describe('buildHoverMarkdown', () => {
  it('includes author, summary, body, sha, and copy/open commands', () => {
    const md = buildHoverMarkdown({
      commit,
      avatarUrl: undefined,
      commitUrl: undefined,
      pr: undefined,
      hostMissing: undefined,
      nowMs: 1778500800000,
    });
    expect(md).toContain('Alex Willemsma');
    expect(md).toContain('First working version of cleaned-up production logs.');
    expect(md).toContain('Multi-line body here.');
    expect(md).toContain('aaaaaaa');
    expect(md).toContain('command:gitlost.copySha');
  });

  it('includes a PR button when pr is provided', () => {
    const md = buildHoverMarkdown({
      commit,
      avatarUrl: undefined,
      commitUrl: 'https://example.com/commit/aaa',
      pr: { number: 239, title: 'Fix logs', url: 'https://example.com/pr/239' },
      hostMissing: undefined,
      nowMs: 1778500800000,
    });
    expect(md).toContain('PR #239');
    expect(md).toContain('https://example.com/pr/239');
  });

  it('shows the GitHub sign-in prompt when hostMissing=github-auth', () => {
    const md = buildHoverMarkdown({
      commit,
      avatarUrl: undefined,
      commitUrl: undefined,
      pr: undefined,
      hostMissing: 'github-auth',
      nowMs: 1778500800000,
    });
    expect(md).toContain('Sign in to GitHub');
    expect(md).toContain('command:gitlost.signInGithub');
  });

  it('shows the GitLab token prompt when hostMissing=gitlab-token', () => {
    const md = buildHoverMarkdown({
      commit,
      avatarUrl: undefined,
      commitUrl: undefined,
      pr: undefined,
      hostMissing: 'gitlab-token',
      nowMs: 1778500800000,
    });
    expect(md).toContain('Configure GitLab token');
    expect(md).toContain('command:workbench.action.openSettings');
  });
});
