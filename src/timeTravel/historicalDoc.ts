import * as vscode from 'vscode';
import type { ContentCache } from '../git/contentCache';

export const SCHEME = 'git-lost';

interface UriPayload {
  repoRoot: string;
  relPath: string;
  sha: string;
  prevPath: string;
}

const payloads = new Map<string, UriPayload>();

export function buildHistoricalUri(payload: UriPayload): vscode.Uri {
  const key = `${payload.repoRoot}|${payload.relPath}|${payload.sha}`;
  payloads.set(key, payload);
  // Path is forward-slash-separated and used by VS Code as the tab label
  // (basename of the path). We append the short sha as a directory-like
  // segment so multiple historical tabs of the same file don't collide
  // and the user can tell which commit each tab is showing.
  const shortSha = payload.sha.slice(0, 7);
  return vscode.Uri.from({
    scheme: SCHEME,
    path: `/${shortSha}/${payload.relPath}`,
    query: `key=${encodeURIComponent(key)}`,
  });
}

export function readPayload(uri: vscode.Uri): UriPayload | undefined {
  if (uri.scheme !== SCHEME) return undefined;
  const params = new URLSearchParams(uri.query);
  const key = params.get('key');
  if (!key) return undefined;
  return payloads.get(key);
}

export class HistoricalDocProvider implements vscode.TextDocumentContentProvider {
  constructor(private contentCache: ContentCache) {}
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const payload = readPayload(uri);
    if (!payload) return '';
    return this.contentCache.get(payload.repoRoot, payload.sha, payload.prevPath);
  }
}
