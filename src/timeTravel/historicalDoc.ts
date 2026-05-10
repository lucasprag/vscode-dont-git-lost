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

// State maps are keyed by uri.toString() so we can freely decorate the URI
// path (e.g. with " (git history)") without having to parse-and-undo the
// decoration for lookup.
const overlayStates = new Map<string, OverlayState>();
const diffStates = new Map<string, { side: 'parent' | 'current'; state: DiffState }>();

function escapeRepoRoot(repoRoot: string): string {
  return encodeURIComponent(repoRoot);
}

/**
 * Insert a suffix into the relPath right BEFORE the file extension so the
 * decorated basename still ends in the original extension (preserves syntax
 * highlighting). For files without extensions, append at the end.
 */
function decorateRelPath(relPath: string, suffix: string): string {
  const lastSlash = relPath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? relPath.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? relPath.slice(lastSlash + 1) : relPath;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return `${dir}${filename} ${suffix}`;
  const name = filename.slice(0, lastDot);
  const ext = filename.slice(lastDot);
  return `${dir}${name} ${suffix}${ext}`;
}

export function buildOverlayUri(repoRoot: string, relPath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: SCHEME,
    path: `/overlay/${escapeRepoRoot(repoRoot)}/${decorateRelPath(relPath, '(git history)')}`,
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
  return overlayStates.get(uri.toString());
}

export function readDiffState(uri: vscode.Uri): { side: 'parent' | 'current'; state: DiffState } | undefined {
  if (uri.scheme !== SCHEME) return undefined;
  if (!uri.path.startsWith('/diff-parent/') && !uri.path.startsWith('/diff-current/')) return undefined;
  return diffStates.get(uri.toString());
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
    const uri = buildOverlayUri(state.repoRoot, state.relPath);
    overlayStates.set(uri.toString(), state);
    this._onDidChange.fire(uri);
    return uri;
  }

  /** Update diff state for a file; fires onDidChange for both sides. */
  setDiff(state: DiffState): { left: vscode.Uri; right: vscode.Uri } {
    const left = buildDiffParentUri(state.repoRoot, state.relPath);
    const right = buildDiffCurrentUri(state.repoRoot, state.relPath);
    diffStates.set(left.toString(), { side: 'parent', state });
    diffStates.set(right.toString(), { side: 'current', state });
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

  /** Forget any stored slot state for this URI (called when a tab closes). */
  clearByUri(uri: vscode.Uri): void {
    overlayStates.delete(uri.toString());
    diffStates.delete(uri.toString());
  }
}
