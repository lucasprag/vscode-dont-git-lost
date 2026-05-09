import { describe, it, expect } from 'vitest';
import { formatAnnotation, formatAgo } from '../../src/blame/annotation';
import { FROZEN_NOW_MS } from '../helpers/time';
import type { CommitInfo } from '../../src/types';

const commit = (over: Partial<CommitInfo> = {}): CommitInfo => ({
  sha: 'a'.repeat(40),
  shortSha: 'aaaaaaa',
  authorName: 'Alex Willemsma',
  authorEmail: 'alex@example.com',
  authorTime: 1417000000, // ~Nov 26, 2014
  summary: 'First working version of cleaned-up production logs.',
  body: '',
  ...over,
});

describe('formatAgo', () => {
  it('formats seconds', () => {
    expect(formatAgo(FROZEN_NOW_MS / 1000 - 5, FROZEN_NOW_MS)).toBe('just now');
  });
  it('formats minutes', () => {
    expect(formatAgo(FROZEN_NOW_MS / 1000 - 60 * 3, FROZEN_NOW_MS)).toBe('3 minutes ago');
  });
  it('formats years', () => {
    expect(formatAgo(FROZEN_NOW_MS / 1000 - 60 * 60 * 24 * 365 * 11, FROZEN_NOW_MS)).toBe('11 years ago');
  });
});

describe('formatAnnotation', () => {
  it('renders the default template', () => {
    const out = formatAnnotation(
      commit(),
      '${author}, ${ago} • ${message}',
      80,
      FROZEN_NOW_MS
    );
    expect(out).toBe('Alex Willemsma, 11 years ago • First working version of cleaned-up production logs.');
  });

  it('truncates the message at messageMaxLength', () => {
    const out = formatAnnotation(
      commit({ summary: 'a'.repeat(100) }),
      '${message}',
      10,
      FROZEN_NOW_MS
    );
    expect(out).toBe('aaaaaaaaa…');
    expect(out.length).toBe(10);
  });

  it('substitutes ${sha}, ${date}, and absent ${pr}', () => {
    const out = formatAnnotation(
      commit(),
      '[${sha}] ${date} pr=${pr}',
      80,
      FROZEN_NOW_MS
    );
    expect(out).toContain('aaaaaaa');
    expect(out).toContain('pr=');
  });
});
