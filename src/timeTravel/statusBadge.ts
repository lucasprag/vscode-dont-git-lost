import * as vscode from 'vscode';
import type { Navigator } from './navigator';
import { readPayload } from './historicalDoc';
import { formatAgo } from '../blame/annotation';

export class StatusBadge implements vscode.Disposable {
  private item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  private subscriptions: vscode.Disposable[] = [];

  constructor(_navigator: Navigator, private getCommitMeta: (sha: string) => { authorName: string; authorTime: number } | undefined) {
    this.item.command = 'dontgitlost.timeTravel.returnToHead';
    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
    );
    this.refresh();
  }

  refresh(): void {
    const editor = vscode.window.activeTextEditor;
    const payload = editor ? readPayload(editor.document.uri) : undefined;
    if (!editor || !payload) {
      this.item.hide();
      return;
    }
    const meta = this.getCommitMeta(payload.sha);
    const ago = meta ? formatAgo(meta.authorTime, Date.now()) : '';
    const author = meta?.authorName ?? '';
    this.item.text = `$(history) ${payload.sha.slice(0, 7)} • ${ago}${author ? ` • ${author}` : ''}`;
    this.item.tooltip = 'Click to return to HEAD';
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
    this.subscriptions.forEach((d) => d.dispose());
  }
}
