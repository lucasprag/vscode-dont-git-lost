import * as vscode from 'vscode';
import type { ContentCache } from '../git/contentCache';

export const SCHEME = 'git-lost';

/**
 * URIs are stable per (mode, repoRoot, relPath) — no sha in the URI. This
 * way the same tab persists across navigation in the same mode; only the
 * provider's state changes when the user steps to another commit, and the
 * provider fires onDidChange to make VS Code re-fetch the new content.
 *
 * Three URI shapes are supported, distinguished by the path prefix:
 *   /overlay/<repoRootEsc>/<relPath>      — single-editor view with diff overlay
 *   /diff-parent/<repoRootEsc>/<relPath>  — left side of the diff editor
 *   /diff-current/<repoRootEsc>/<relPath> — right side of the diff editor
 *
 * The diff-parent and diff-current URIs share a (repoRoot, relPath) so they
 * pair up naturally: clicking ‹/› on the same file always reuses the same
 * diff-editor tab, and clicking ←/→ reuses the same overlay tab.
 */

export type Mode = 'overlay' | 'diff';

export interface OverlayState {
  repoRoot: string;
  relPath: string;
  sha: string;
  prevPath: string; // path at this commit (handles renames)
}

export interface DiffState {
  repoRoot: string;
  relPath: string;       // current (right side) path; also used for tab title
  currentSha: string;
  currentPath: string;   // path at the current commit (handles renames)
  parentSha: string;
  parentPath: string;    // path at the parent commit (handles renames)
}

const overlayStates = new Map<string, OverlayState>();
const diffStates = new Map<string, DiffState>();

function escapeRepoRoot(repoRoot: string): string {
  // Encode "/" so the repo path is collapsible to a single URI segment.
  return encodeURIComponent(repoRoot);
}

function overlayKey(repoRoot: string, relPath: string): string {
  return `${escapeRepoRoot(repoRoot)}|${relPath}`;
}

function diffKey(repoRoot: string, relPath: string): string {
  return `${escapeRepoRoot(repoRoot)}|${relPath}`;
}

export function buildOverlayUri(repoRoot: string, relPath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: SCHEME,
    path: `/overlay/${escapeRepoRoot(repoRoot)}/${relPath}`,
  });
}

export function buildDiffParentUri(repoRoot: string, relPath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: SCHEME,
    path: `/diff-parent/${escapeRepoRoot(repoRoot)}/${relPath}`,
  });
}

export function buildDiffCurrentUri(repoRoot: string, relPath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: SCHEME,
    path: `/diff-current/${escapeRepoRoot(repoRoot)}/${relPath}`,
  });
}

export function readOverlayState(uri: vscode.Uri): OverlayState | undefined {
  if (uri.scheme !== SCHEME || !uri.path.startsWith('/overlay/')) return undefined;
  const rest = uri.path.slice('/overlay/'.length);
  const idx = rest.indexOf('/');
  if (idx < 0) return undefined;
  const repoRootEsc = rest.slice(0, idx);
  const relPath = rest.slice(idx + 1);
  return overlayStates.get(`${repoRootEsc}|${relPath}`);
}

export function readDiffState(uri: vscode.Uri): { side: 'parent' | 'current'; state: DiffState } | undefined {
  if (uri.scheme !== SCHEME) return undefined;
  let side: 'parent' | 'current';
  let prefix: string;
  if (uri.path.startsWith('/diff-parent/')) { side = 'parent'; prefix = '/diff-parent/'; }
  else if (uri.path.startsWith('/diff-current/')) { side = 'current'; prefix = '/diff-current/'; }
  else return undefined;
  const rest = uri.path.slice(prefix.length);
  const idx = rest.indexOf('/');
  if (idx < 0) return undefined;
  const repoRootEsc = rest.slice(0, idx);
  const relPath = rest.slice(idx + 1);
  const state = diffStates.get(`${repoRootEsc}|${relPath}`);
  if (!state) return undefined;
  return { side, state };
}

/**
 * Backward-compat: any code that needs to know "is this URI a time-travel URI?"
 * and extract repoRoot+relPath. Used by the status badge and context-key logic.
 */
export interface SlotPayload {
  mode: Mode;
  repoRoot: string;
  relPath: string;
  sha: string;        // current sha being shown (overlay sha, or diff's current sha)
  prevPath: string;   // path at that sha (for overlay or diff-current)
}

export function readPayload(uri: vscode.Uri): SlotPayload | undefined {
  const overlay = readOverlayState(uri);
  if (overlay) {
    return {
      mode: 'overlay',
      repoRoot: overlay.repoRoot,
      relPath: overlay.relPath,
      sha: overlay.sha,
      prevPath: overlay.prevPath,
    };
  }
  const diff = readDiffState(uri);
  if (diff) {
    const { side, state } = diff;
    return {
      mode: 'diff',
      repoRoot: state.repoRoot,
      relPath: state.relPath,
      sha: side === 'parent' ? state.parentSha : state.currentSha,
      prevPath: side === 'parent' ? state.parentPath : state.currentPath,
    };
  }
  return undefined;
}

export class HistoricalDocProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private contentCache: ContentCache) {}

  /** Update overlay state for a file; fires onDidChange so the editor refreshes. */
  setOverlay(state: OverlayState): vscode.Uri {
    overlayStates.set(overlayKey(state.repoRoot, state.relPath), state);
    const uri = buildOverlayUri(state.repoRoot, state.relPath);
    this._onDidChange.fire(uri);
    return uri;
  }

  /** Update diff state for a file; fires onDidChange for both sides. */
  setDiff(state: DiffState): { left: vscode.Uri; right: vscode.Uri } {
    diffStates.set(diffKey(state.repoRoot, state.relPath), state);
    const left = buildDiffParentUri(state.repoRoot, state.relPath);
    const right = buildDiffCurrentUri(state.repoRoot, state.relPath);
    this._onDidChange.fire(left);
    this._onDidChange.fire(right);
    return { left, right };
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const overlay = readOverlayState(uri);
    if (overlay) {
      try {
        return await this.contentCache.get(overlay.repoRoot, overlay.sha, overlay.prevPath);
      } catch {
        return '';
      }
    }
    const diff = readDiffState(uri);
    if (diff) {
      const { side, state } = diff;
      const sha = side === 'parent' ? state.parentSha : state.currentSha;
      const path = side === 'parent' ? state.parentPath : state.currentPath;
      try {
        return await this.contentCache.get(state.repoRoot, sha, path);
      } catch {
        return '';
      }
    }
    return '';
  }
}
