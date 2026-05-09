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
  return vscode.Uri.from({
    scheme: SCHEME,
    path: `/${encodeURIComponent(payload.relPath)}`,
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
