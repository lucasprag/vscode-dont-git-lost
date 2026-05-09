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
  // Decorate the path so VS Code's tab label (the URI basename) reads like
  // "filename [abc1234].ext" — making it obvious this is a historical view
  // and which commit it belongs to. The original extension is preserved at
  // the end so syntax highlighting still works.
  const shortSha = payload.sha.slice(0, 7);
  return vscode.Uri.from({
    scheme: SCHEME,
    path: decoratePath(payload.relPath, shortSha),
    query: `key=${encodeURIComponent(key)}`,
  });
}

function decoratePath(relPath: string, shortSha: string): string {
  const lastSlash = relPath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? relPath.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? relPath.slice(lastSlash + 1) : relPath;
  const lastDot = filename.lastIndexOf('.');
  // lastDot <= 0 covers no-extension files and dotfiles (e.g. ".gitignore").
  if (lastDot <= 0) return `/${dir}${filename} [${shortSha}]`;
  const name = filename.slice(0, lastDot);
  const ext = filename.slice(lastDot);
  return `/${dir}${name} [${shortSha}]${ext}`;
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
