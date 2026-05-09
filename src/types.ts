export interface CommitInfo {
  sha: string;
  shortSha: string;
  authorName: string;
  authorEmail: string;
  authorTime: number; // unix seconds
  summary: string;    // first line of message
  body: string;       // rest of message (may be empty)
}

export interface BlameLine {
  lineNumber: number; // 0-indexed
  commit: CommitInfo;
  isUncommitted: boolean;
}

export interface CommitRef {
  sha: string;
  prevPath: string; // file path at this commit (handles renames)
}

export interface NavState {
  commits: CommitRef[]; // newest → oldest
  index: number;        // -1 = HEAD/working copy; 0..n-1 = historical
}

export type HostType = 'github' | 'gitlab' | 'bitbucket';

export interface HostInfo {
  type: HostType;
  baseUrl: string;    // API base
  webBaseUrl: string; // browser base
  owner: string;
  repo: string;
}

export interface PrInfo {
  number: number;
  title: string;
  url: string;
}

export interface HostClient {
  resolveAvatar(email: string): Promise<string | undefined>;
  resolvePr(sha: string): Promise<PrInfo | undefined>;
  commitUrl(sha: string): string;
}
