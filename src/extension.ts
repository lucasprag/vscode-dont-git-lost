import * as vscode from 'vscode';
import { LicenseManager } from '@lucasprag/vscode-license';
import { GitEngine } from './git/gitEngine';
import { BlameCache } from './git/blameCache';
import { HistoryCache } from './git/historyCache';
import { ContentCache } from './git/contentCache';
import { RepoLocator } from './git/repoLocator';
import { LineBlame } from './blame/lineBlame';
import { DontGitLostHoverProvider } from './hover/hoverProvider';
import { Navigator } from './timeTravel/navigator';
import {
  HistoricalDocProvider,
  SCHEME,
  buildOverlayUri,
  buildDiffParentUri,
  buildDiffCurrentUri,
  readPayload,
} from './timeTravel/historicalDoc';
import { StatusBadge } from './timeTravel/statusBadge';
import { DiffDecorations } from './timeTravel/diffDecorations';
import { parseUnifiedDiff } from './timeTravel/diffParser';
import type { CommitInfo } from './types';
import { AuthBroker } from './auth/authBroker';
import { readConfig } from './config';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const licenseManager = new LicenseManager(context, {
    organizationId: '94b4a580-a66a-458c-9cfa-48c8d019f7e5',
    benefitId: '4b64ee60-743c-41da-8909-3d6866525705',
    extensionName: "Don't Git Lost",
    checkoutUrl: 'https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_9SCtvLsLugheFUK5RoD1xeExX3d9RH21Pwx2Z0hFjEL/redirect',
    commandPrefix: 'dontgitlost.license',
    keyPrefix: 'LUCASPRAG-',
    sandbox: false,
    forcePopup: false,
  });
  await licenseManager.initialize();

  const gitEngine = new GitEngine();
  const repoLocator = new RepoLocator();
  await repoLocator.ensureReady();

  const blameCache = new BlameCache(async (path) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return [];
    const match = repoLocator.locate(editor.document.uri);
    if (!match || match.relPath !== path) return [];
    return gitEngine.blame(match.repoRoot, match.relPath);
  });

  const historyCache = new HistoryCache(async (path) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return [];
    const match = repoLocator.locate(editor.document.uri);
    if (!match || match.relPath !== path) return [];
    return gitEngine.logFollow(match.repoRoot, match.relPath);
  });

  const contentCache = new ContentCache((repoRoot, sha, relPath) => gitEngine.show(repoRoot, sha, relPath));
  const auth = new AuthBroker();

  const navigator = new Navigator(async (filePath) => {
    const fileUri = vscode.Uri.file(filePath);
    const match = repoLocator.locate(fileUri);
    if (!match || !match.headSha) return [];
    return historyCache.get(match.relPath, match.headSha);
  });

  const commitMeta = new Map<string, CommitInfo>();
  const recordCommitMeta = (info: CommitInfo) => commitMeta.set(info.sha, info);

  const statusBadge = new StatusBadge(navigator, (sha) => {
    const m = commitMeta.get(sha);
    return m ? { authorName: m.authorName, authorTime: m.authorTime } : undefined;
  });

  const provider = new HistoricalDocProvider(contentCache);
  const diffDecorations = new DiffDecorations();

  const setForwardContext = (canGoForward: boolean) => vscode.commands.executeCommand('setContext', 'dontgitlost:canGoForward', canGoForward);
  const setHasHistoryContext = (hasHistory: boolean) => vscode.commands.executeCommand('setContext', 'dontgitlost:hasGitHistory', hasHistory);

  const updateContextKeys = () => {
    const cfg = readConfig();
    const editor = vscode.window.activeTextEditor;
    if (!editor || !cfg.timeTravelEnabled) {
      setForwardContext(false);
      setHasHistoryContext(false);
      return;
    }
    const payload = readPayload(editor.document.uri);
    setForwardContext(!!payload);
    if (editor.document.uri.scheme === 'file') {
      const match = repoLocator.locate(editor.document.uri);
      setHasHistoryContext(!!match);
    } else if (payload) {
      setHasHistoryContext(true);
    } else {
      setHasHistoryContext(false);
    }
  };

  // Resolve which file path "owns" the navigation state for the active editor.
  const navKeyForActive = (): string | undefined => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return undefined;
    if (editor.document.uri.scheme === 'file') return editor.document.uri.fsPath.replace(/\\/g, '/');
    const payload = readPayload(editor.document.uri);
    if (payload) return `${payload.repoRoot.replace(/\\/g, '/')}/${payload.relPath}`;
    return undefined;
  };

  /** Find an existing tab whose URI matches the predicate. */
  const findTab = (predicate: (tab: vscode.Tab) => boolean): vscode.Tab | undefined => {
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (predicate(tab)) return tab;
      }
    }
    return undefined;
  };

  /** Extract any dont-git-lost: URIs from a tab (overlay or both diff sides). */
  const timeTravelUrisOf = (tab: vscode.Tab): vscode.Uri[] => {
    const uris: vscode.Uri[] = [];
    if (tab.input instanceof vscode.TabInputText && tab.input.uri.scheme === SCHEME) {
      uris.push(tab.input.uri);
    } else if (tab.input instanceof vscode.TabInputTextDiff) {
      if (tab.input.original.scheme === SCHEME) uris.push(tab.input.original);
      if (tab.input.modified.scheme === SCHEME) uris.push(tab.input.modified);
    }
    return uris;
  };

  const findOverlayTab = (overlayUri: vscode.Uri): vscode.Tab | undefined =>
    findTab((tab) =>
      tab.input instanceof vscode.TabInputText &&
      tab.input.uri.toString() === overlayUri.toString());

  const findDiffTab = (leftUri: vscode.Uri, rightUri: vscode.Uri): vscode.Tab | undefined =>
    findTab((tab) =>
      tab.input instanceof vscode.TabInputTextDiff &&
      tab.input.original.toString() === leftUri.toString() &&
      tab.input.modified.toString() === rightUri.toString());

  const openTarget = async (
    direction: 'back' | 'forward' | 'returnToHead',
    target: { sha: string; prevPath: string } | 'head' | 'noop',
    navKey: string,
    mode: 'overlay' | 'diff-editor' = 'overlay',
  ) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    if (target === 'noop') return;

    if (target === 'head') {
      const payload = readPayload(editor.document.uri);
      if (!payload) return;
      const fileUri = vscode.Uri.file(`${payload.repoRoot.replace(/\\/g, '/')}/${payload.relPath}`);
      await vscode.window.showTextDocument(fileUri, {
        viewColumn: editor.viewColumn ?? vscode.ViewColumn.Active,
        preview: false,
      });
      // Close any time-travel tabs for this file.
      const overlayUri = buildOverlayUri(payload.repoRoot, payload.relPath);
      const leftUri = buildDiffParentUri(payload.repoRoot, payload.relPath);
      const rightUri = buildDiffCurrentUri(payload.repoRoot, payload.relPath);
      const overlayTab = findOverlayTab(overlayUri);
      const diffTab = findDiffTab(leftUri, rightUri);
      if (overlayTab) await vscode.window.tabGroups.close(overlayTab);
      if (diffTab) await vscode.window.tabGroups.close(diffTab);
      return;
    }

    let repoRoot: string;
    let relPath: string;
    if (editor.document.uri.scheme === 'file') {
      const match = repoLocator.locate(editor.document.uri);
      if (!match) return;
      repoRoot = match.repoRoot;
      relPath = match.relPath;
    } else {
      const payload = readPayload(editor.document.uri);
      if (!payload) return;
      repoRoot = payload.repoRoot;
      relPath = payload.relPath;
    }

    // Pre-fetch the historical content; if the file didn't exist at this commit
    // (or any other git error), rewind the navigator state and surface a notification.
    try {
      await contentCache.get(repoRoot, target.sha, target.prevPath);
    } catch {
      if (direction === 'back') await navigator.forward(navKey);
      else if (direction === 'forward') await navigator.back(navKey);
      vscode.window.setStatusBarMessage(`Don't Git Lost: file not present at ${target.sha.slice(0, 7)}`, 3000);
      return;
    }

    // best-effort metadata for status badge
    try {
      const blameLines = await blameCache.get(relPath, target.sha).catch(() => []);
      if (blameLines[0]) recordCommitMeta(blameLines[0].commit);
    } catch { /* ignore */ }

    const dirty = editor.document.isDirty;
    const fallbackColumn = dirty ? vscode.ViewColumn.Beside : (editor.viewColumn ?? vscode.ViewColumn.Active);

    if (mode === 'diff-editor') {
      await openDiffEditor(repoRoot, relPath, target, navKey, fallbackColumn);
    } else {
      await openOverlay(repoRoot, relPath, target, fallbackColumn);
    }
  };

  /** Open or refresh the overlay tab for (repoRoot, relPath) at the given commit. */
  const openOverlay = async (
    repoRoot: string,
    relPath: string,
    target: { sha: string; prevPath: string },
    fallbackColumn: vscode.ViewColumn,
  ) => {
    const overlayUri = buildOverlayUri(repoRoot, relPath);
    // setOverlay updates state and fires onDidChange so any open editor refreshes.
    provider.setOverlay({
      repoRoot,
      relPath,
      sha: target.sha,
      prevPath: target.prevPath,
    });

    // If the tab already exists, focus it (don't open a new one). Otherwise open.
    const existing = findOverlayTab(overlayUri);
    const viewColumn = existing?.group.viewColumn ?? fallbackColumn;
    const doc = await vscode.workspace.openTextDocument(overlayUri);
    await vscode.window.showTextDocument(doc, { viewColumn, preview: false });

    // Compute and apply diff overlay decorations vs parent.
    const parent = await gitEngine.parentSha(repoRoot, target.sha);
    if (parent) {
      const diffText = await gitEngine.diffUnified(repoRoot, parent, target.sha, target.prevPath);
      diffDecorations.setHunks(overlayUri, parseUnifiedDiff(diffText));
    } else {
      diffDecorations.setHunks(overlayUri, {
        added: doc.lineCount > 0 ? [{ start: 1, end: doc.lineCount }] : [],
        deletedAbove: [],
      });
    }
  };

  /** Open or refresh the diff-editor tab for (repoRoot, relPath) at the given commit. */
  const openDiffEditor = async (
    repoRoot: string,
    relPath: string,
    target: { sha: string; prevPath: string },
    navKey: string,
    fallbackColumn: vscode.ViewColumn,
  ) => {
    const parentSha = await gitEngine.parentSha(repoRoot, target.sha);
    if (!parentSha) {
      // Root commit: nothing to diff; fall back to overlay mode.
      await openOverlay(repoRoot, relPath, target, fallbackColumn);
      return;
    }

    const parentRef = navigator.parentRef(navKey);
    const parentPath = parentRef?.prevPath ?? target.prevPath;

    const { left, right } = provider.setDiff({
      repoRoot,
      relPath,
      currentSha: target.sha,
      currentPath: target.prevPath,
      parentSha,
      parentPath,
    });

    diffDecorations.clear(left);
    diffDecorations.clear(right);

    // Tab title is set once (when the diff input is first created) and VS Code
    // ignores subsequent title changes when re-invoking vscode.diff with the
    // same URIs. So we keep it static — the dynamic sha info lives in the
    // bottom-right status badge.
    const filename = relPath.split('/').pop() ?? relPath;
    const title = `${filename} (diff)`;

    const existing = findDiffTab(left, right);
    if (existing) {
      // Tab already open — focus it. The provider's onDidChange has already
      // fired, so VS Code will re-fetch and re-render the diff content.
      await vscode.commands.executeCommand('vscode.diff', left, right, title, {
        viewColumn: existing.group.viewColumn,
        preview: false,
      });
      return;
    }

    await vscode.commands.executeCommand('vscode.diff', left, right, title, {
      viewColumn: fallbackColumn,
      preview: false,
    });
  };

  context.subscriptions.push(
    new LineBlame(blameCache, repoLocator),
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider),
    vscode.languages.registerHoverProvider({ scheme: 'file' }, new DontGitLostHoverProvider(gitEngine, blameCache, repoLocator, auth)),
    vscode.commands.registerCommand('dontgitlost.signInGithub', async () => {
      await auth.getGithubToken(false);
    }),
    statusBadge,
    diffDecorations,

    vscode.commands.registerCommand('dontgitlost.timeTravel.back', async () => {
      const key = navKeyForActive();
      if (!key) return;
      const target = await navigator.back(key);
      await openTarget('back', target, key, 'overlay');
      updateContextKeys();
      statusBadge.refresh();
    }),
    vscode.commands.registerCommand('dontgitlost.timeTravel.forward', async () => {
      const key = navKeyForActive();
      if (!key) return;
      const target = await navigator.forward(key);
      await openTarget('forward', target, key, 'overlay');
      updateContextKeys();
      statusBadge.refresh();
    }),
    vscode.commands.registerCommand('dontgitlost.timeTravel.backWithDiff', async () => {
      const key = navKeyForActive();
      if (!key) return;
      const target = await navigator.back(key);
      await openTarget('back', target, key, 'diff-editor');
      updateContextKeys();
      statusBadge.refresh();
    }),
    vscode.commands.registerCommand('dontgitlost.timeTravel.forwardWithDiff', async () => {
      const key = navKeyForActive();
      if (!key) return;
      const target = await navigator.forward(key);
      await openTarget('forward', target, key, 'diff-editor');
      updateContextKeys();
      statusBadge.refresh();
    }),
    vscode.commands.registerCommand('dontgitlost.timeTravel.returnToHead', async () => {
      const key = navKeyForActive();
      if (!key) return;
      navigator.returnToHead(key);
      await openTarget('returnToHead', 'head', key, 'overlay');
      updateContextKeys();
      statusBadge.refresh();
    }),

    vscode.commands.registerCommand('dontgitlost.copySha', async (sha: string) => {
      await vscode.env.clipboard.writeText(sha);
      vscode.window.setStatusBarMessage(`Don't Git Lost: copied ${sha.slice(0, 7)}`, 2000);
    }),
    vscode.commands.registerCommand('dontgitlost.openUrl', async (url: string) => {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),

    vscode.window.onDidChangeActiveTextEditor(() => updateContextKeys()),
    repoLocator.onDidChangeRepositories(() => updateContextKeys()),

    // When a time-travel tab closes, forget where the user was so the next
    // ←/→/‹/› starts from HEAD instead of resuming the previous walk.
    vscode.window.tabGroups.onDidChangeTabs((event) => {
      for (const tab of event.closed) {
        const uris = timeTravelUrisOf(tab);
        for (const uri of uris) {
          const payload = readPayload(uri);
          if (payload) {
            const navKey = `${payload.repoRoot.replace(/\\/g, '/')}/${payload.relPath}`;
            navigator.returnToHead(navKey);
          }
          provider.clearByUri(uri);
          diffDecorations.clear(uri);
        }
      }
    }),
  );

  updateContextKeys();
}

export function deactivate(): void {}
