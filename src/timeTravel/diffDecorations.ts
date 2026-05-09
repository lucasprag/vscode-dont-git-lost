import * as vscode from 'vscode';
import { SCHEME } from './historicalDoc';
import type { DiffRanges } from './diffParser';

/**
 * Renders GitHub-style diff decorations on `git-lost:` editors.
 *
 * Stores hunk data per URI so when the user switches between historical tabs
 * the right decorations appear. Decorations apply to lines as they exist in
 * the new (post-commit) file: added/modified lines get a green tint; lines
 * where deletions happened above get a red top-border marker.
 */
export class DiffDecorations implements vscode.Disposable {
  private readonly addedDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.addedForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });

  private readonly deletedDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderStyle: 'solid',
    borderWidth: '2px 0 0 0',
    borderColor: new vscode.ThemeColor('editorGutter.deletedBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.deletedForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });

  // Keyed by uri.toString()
  private readonly hunksPerUri = new Map<string, DiffRanges>();
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor() {
    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.refresh(editor);
      }),
      // When the content of a git-lost: doc changes (we fired onDidChange),
      // VS Code re-renders and may drop existing decorations. Re-apply them.
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.scheme !== SCHEME) return;
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document === event.document) this.refresh(editor);
        }
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        if (doc.uri.scheme === SCHEME) {
          this.hunksPerUri.delete(doc.uri.toString());
        }
      }),
    );
  }

  /** Store hunks for the URI and apply if the URI is currently active. */
  setHunks(uri: vscode.Uri, hunks: DiffRanges): void {
    this.hunksPerUri.set(uri.toString(), hunks);
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === uri.toString()) {
      this.applyTo(editor, hunks);
    }
  }

  /** Remove decorations and stored hunks for the URI. */
  clear(uri: vscode.Uri): void {
    this.hunksPerUri.delete(uri.toString());
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === uri.toString()) {
      editor.setDecorations(this.addedDecoration, []);
      editor.setDecorations(this.deletedDecoration, []);
    }
  }

  /** Apply stored hunks for the editor's URI, or clear if none. */
  refresh(editor: vscode.TextEditor): void {
    const hunks = this.hunksPerUri.get(editor.document.uri.toString());
    if (hunks) {
      this.applyTo(editor, hunks);
    } else {
      editor.setDecorations(this.addedDecoration, []);
      editor.setDecorations(this.deletedDecoration, []);
    }
  }

  private applyTo(editor: vscode.TextEditor, hunks: DiffRanges): void {
    const lineCount = editor.document.lineCount;

    const addedRanges: vscode.Range[] = [];
    for (const r of hunks.added) {
      // Convert 1-based to 0-based, clamp to document bounds.
      const start = Math.max(0, r.start - 1);
      const end = Math.min(lineCount - 1, r.end - 1);
      if (end < start) continue;
      addedRanges.push(new vscode.Range(start, 0, end, 0));
    }

    const deletedRanges: vscode.Range[] = [];
    for (const lineNumber of hunks.deletedAbove) {
      // 1-based → 0-based; clamp to last existing line if the deletion was at end.
      const idx = Math.max(0, Math.min(lineCount - 1, lineNumber - 1));
      deletedRanges.push(new vscode.Range(idx, 0, idx, 0));
    }

    editor.setDecorations(this.addedDecoration, addedRanges);
    editor.setDecorations(this.deletedDecoration, deletedRanges);
  }

  dispose(): void {
    this.addedDecoration.dispose();
    this.deletedDecoration.dispose();
    this.subscriptions.forEach((d) => d.dispose());
    this.hunksPerUri.clear();
  }
}
