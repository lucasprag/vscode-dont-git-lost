import { describe, it, expect } from 'vitest';
import { parseRemote } from '../../src/host/remoteParser';

describe('parseRemote', () => {
  it('parses GitHub https', () => {
    expect(parseRemote('https://github.com/foo/bar.git')).toEqual({
      hostDomain: 'github.com', owner: 'foo', repo: 'bar',
    });
  });
  it('parses GitHub ssh', () => {
    expect(parseRemote('git@github.com:foo/bar.git')).toEqual({
      hostDomain: 'github.com', owner: 'foo', repo: 'bar',
    });
  });
  it('parses GitLab nested groups', () => {
    expect(parseRemote('https://gitlab.com/group/sub/project.git')).toEqual({
      hostDomain: 'gitlab.com', owner: 'group/sub', repo: 'project',
    });
  });
  it('parses Bitbucket', () => {
    expect(parseRemote('https://bitbucket.org/team/repo.git')).toEqual({
      hostDomain: 'bitbucket.org', owner: 'team', repo: 'repo',
    });
  });
  it('returns undefined on unparseable', () => {
    expect(parseRemote('weird://nope')).toBeUndefined();
  });
});
