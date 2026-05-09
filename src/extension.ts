import * as vscode from 'vscode';
import { GitEngine } from './git/gitEngine';
import { BlameCache } from './git/blameCache';
import { HistoryCache } from './git/historyCache';
import { ContentCache } from './git/contentCache';
import { RepoLocator } from './git/repoLocator';
import { LineBlame } from './blame/lineBlame';
import { GitLostHoverProvider } from './hover/hoverProvider';
import { Navigator } from './timeTravel/navigator';
import { HistoricalDocProvider, SCHEME, buildHistoricalUri, readPayload } from './timeTravel/historicalDoc';
import { StatusBadge } from './timeTravel/statusBadge';
import type { CommitInfo } from './types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
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

  // Navigator's fetcher uses the working-copy file path as its key.
  const navigator = new Navigator(async (filePath) => {
    const fileUri = vscode.Uri.file(filePath);
    const match = repoLocator.locate(fileUri);
    if (!match || !match.headSha) return [];
    return historyCache.get(match.relPath, match.headSha);
  });

  // Cache commit metadata for status badge tooltip.
  const commitMeta = new Map<string, CommitInfo>();
  const recordCommitMeta = (info: CommitInfo) => commitMeta.set(info.sha, info);

  const statusBadge = new StatusBadge(navigator, (sha) => {
    const m = commitMeta.get(sha);
    return m ? { authorName: m.authorName, authorTime: m.authorTime } : undefined;
  });

  const provider = new HistoricalDocProvider(contentCache);

  const setForwardContext = (canGoForward: boolean) => vscode.commands.executeCommand('setContext', 'gitlost:canGoForward', canGoForward);
  const setHasHistoryContext = (hasHistory: boolean) => vscode.commands.executeCommand('setContext', 'gitlost:hasGitHistory', hasHistory);

  const updateContextKeys = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
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
    if (editor.document.uri.scheme === 'file') return editor.document.uri.fsPath;
    const payload = readPayload(editor.document.uri);
    if (payload) return `${payload.repoRoot}/${payload.relPath}`;
    return undefined;
  };

  const openTarget = async (
    direction: 'back' | 'forward' | 'returnToHead',
    target: { sha: string; prevPath: string } | 'head' | 'noop',
    navKey: string,
  ) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    if (target === 'noop') return;

    if (target === 'head') {
      const payload = readPayload(editor.document.uri);
      if (!payload) return;
      const fileUri = vscode.Uri.file(`${payload.repoRoot}/${payload.relPath}`);
      await vscode.window.showTextDocument(fileUri, { viewColumn: editor.viewColumn ?? vscode.ViewColumn.Active, preview: false });
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
      // rewind: undo whatever the navigator just did
      if (direction === 'back') await navigator.forward(navKey);
      else if (direction === 'forward') await navigator.back(navKey);
      vscode.window.setStatusBarMessage(`Git Lost: file not present at ${target.sha.slice(0, 7)}`, 3000);
      return;
    }

    const uri = buildHistoricalUri({ repoRoot, relPath, sha: target.sha, prevPath: target.prevPath });

    // best-effort metadata for status badge
    try {
      const blameLines = await blameCache.get(relPath, target.sha).catch(() => []);
      if (blameLines[0]) recordCommitMeta(blameLines[0].commit);
    } catch { /* ignore */ }

    const dirty = editor.document.isDirty;
    const viewColumn = dirty ? vscode.ViewColumn.Beside : (editor.viewColumn ?? vscode.ViewColumn.Active);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { viewColumn, preview: false });
  };

  context.subscriptions.push(
    new LineBlame(blameCache, repoLocator),
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider),
    vscode.languages.registerHoverProvider({ scheme: 'file' }, new GitLostHoverProvider(blameCache, repoLocator)),
    statusBadge,

    vscode.commands.registerCommand('gitlost.timeTravel.back', async () => {
      const key = navKeyForActive();
      if (!key) return;
      const target = await navigator.back(key);
      await openTarget('back', target, key);
      updateContextKeys();
      statusBadge.refresh();
    }),
    vscode.commands.registerCommand('gitlost.timeTravel.forward', async () => {
      const key = navKeyForActive();
      if (!key) return;
      const target = await navigator.forward(key);
      await openTarget('forward', target, key);
      updateContextKeys();
      statusBadge.refresh();
    }),
    vscode.commands.registerCommand('gitlost.timeTravel.returnToHead', async () => {
      const key = navKeyForActive();
      if (!key) return;
      navigator.returnToHead(key);
      await openTarget('returnToHead', 'head', key);
      updateContextKeys();
      statusBadge.refresh();
    }),

    vscode.commands.registerCommand('gitlost.copySha', async (sha: string) => {
      await vscode.env.clipboard.writeText(sha);
      vscode.window.setStatusBarMessage(`Git Lost: copied ${sha.slice(0, 7)}`, 2000);
    }),
    vscode.commands.registerCommand('gitlost.openUrl', async (url: string) => {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),

    vscode.window.onDidChangeActiveTextEditor(() => updateContextKeys()),
  );

  updateContextKeys();
}

export function deactivate(): void {}
