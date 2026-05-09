import * as vscode from 'vscode';
import { GitEngine } from './git/gitEngine';
import { BlameCache } from './git/blameCache';
import { RepoLocator } from './git/repoLocator';
import { LineBlame } from './blame/lineBlame';
import { GitLostHoverProvider } from './hover/hoverProvider';

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

  context.subscriptions.push(
    new LineBlame(blameCache, repoLocator),
    vscode.languages.registerHoverProvider({ scheme: 'file' }, new GitLostHoverProvider(blameCache, repoLocator)),
    vscode.commands.registerCommand('gitlost.copySha', async (sha: string) => {
      await vscode.env.clipboard.writeText(sha);
      vscode.window.setStatusBarMessage(`Git Lost: copied ${sha.slice(0, 7)}`, 2000);
    }),
    vscode.commands.registerCommand('gitlost.openUrl', async (url: string) => {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );
}

export function deactivate(): void {}
