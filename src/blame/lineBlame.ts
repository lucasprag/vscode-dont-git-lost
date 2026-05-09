import * as vscode from 'vscode';
import { formatAnnotation } from './annotation';
import type { BlameCache } from '../git/blameCache';
import type { RepoLocator } from '../git/repoLocator';
import { readConfig } from '../config';

const DEBOUNCE_MS = 100;

export class LineBlame implements vscode.Disposable {
  private decoration = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 3em',
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'normal',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
  private timer: NodeJS.Timeout | undefined;
  private subscriptions: vscode.Disposable[] = [];

  constructor(
    private blameCache: BlameCache,
    private repoLocator: RepoLocator,
  ) {
    this.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((e) => this.schedule(e.textEditor)),
      vscode.window.onDidChangeActiveTextEditor((editor) => editor && this.schedule(editor)),
      vscode.workspace.onDidChangeConfiguration(() => this.refreshActive()),
    );
  }

  private schedule(editor: vscode.TextEditor): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(editor), DEBOUNCE_MS);
  }

  private refreshActive(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) this.schedule(editor);
  }

  private async update(editor: vscode.TextEditor): Promise<void> {
    const cfg = readConfig();
    if (!cfg.blameEnabled || editor !== vscode.window.activeTextEditor) {
      editor.setDecorations(this.decoration, []);
      return;
    }
    if (editor.document.uri.scheme !== 'file') {
      editor.setDecorations(this.decoration, []);
      return;
    }
    const match = this.repoLocator.locate(editor.document.uri);
    if (!match || !match.headSha) {
      editor.setDecorations(this.decoration, []);
      return;
    }
    const line = editor.selection.active.line;
    try {
      const blame = await this.blameCache.get(match.relPath, match.headSha);
      const entry = blame.find((b) => b.lineNumber === line);
      if (!entry || entry.isUncommitted) {
        editor.setDecorations(this.decoration, []);
        return;
      }
      const text = formatAnnotation(
        entry.commit,
        cfg.blameFormat,
        cfg.blameMessageMaxLength,
        Date.now(),
      );
      const range = editor.document.lineAt(line).range;
      editor.setDecorations(this.decoration, [{
        range,
        renderOptions: { after: { contentText: text } },
        hoverMessage: undefined, // hover is handled by hoverProvider
      }]);
    } catch {
      editor.setDecorations(this.decoration, []);
    }
  }

  dispose(): void {
    this.decoration.dispose();
    this.subscriptions.forEach((d) => d.dispose());
    if (this.timer) clearTimeout(this.timer);
  }
}
