import * as vscode from 'vscode';
import { GitEngine } from './git/gitEngine';
import { BlameCache } from './git/blameCache';
import { RepoLocator } from './git/repoLocator';
import { LineBlame } from './blame/lineBlame';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const gitEngine = new GitEngine();
  const repoLocator = new RepoLocator();
  await repoLocator.ensureReady();

  const blameCache = new BlameCache(async (_path, _head) => {
    // We need the repoRoot. Resolve via the active editor's URI on demand.
    const editor = vscode.window.activeTextEditor;
    if (!editor) return [];
    const match = repoLocator.locate(editor.document.uri);
    if (!match) return [];
    return gitEngine.blame(match.repoRoot, match.relPath);
  });

  const lineBlame = new LineBlame(gitEngine, blameCache, repoLocator);
  context.subscriptions.push(lineBlame);
}

export function deactivate(): void {}
