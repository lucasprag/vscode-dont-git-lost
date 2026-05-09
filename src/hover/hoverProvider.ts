import * as vscode from 'vscode';
import { buildHoverMarkdown } from './hoverCard';
import type { BlameCache } from '../git/blameCache';
import type { RepoLocator } from '../git/repoLocator';

export class GitLostHoverProvider implements vscode.HoverProvider {
  constructor(
    private blameCache: BlameCache,
    private repoLocator: RepoLocator,
  ) {}

  async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    if (document.uri.scheme !== 'file') return undefined;
    const match = this.repoLocator.locate(document.uri);
    if (!match || !match.headSha) return undefined;

    const blame = await this.blameCache.get(match.relPath, match.headSha);
    const entry = blame.find((b) => b.lineNumber === position.line);
    if (!entry || entry.isUncommitted) return undefined;

    const md = new vscode.MarkdownString(
      buildHoverMarkdown({
        commit: entry.commit,
        avatarUrl: undefined,
        commitUrl: undefined,
        pr: undefined,
        hostMissing: undefined,
        nowMs: Date.now(),
      }),
      true,
    );
    md.isTrusted = true;
    md.supportThemeIcons = true;

    const range = document.lineAt(position.line).range;
    return new vscode.Hover(md, range);
  }
}
