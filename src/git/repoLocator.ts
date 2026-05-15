import * as vscode from 'vscode';
import { relative } from 'node:path';

interface GitExtensionApi {
  getAPI(version: 1): GitApi;
}
interface GitApi {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
  onDidCloseRepository: vscode.Event<GitRepository>;
}
interface GitRepository {
  rootUri: vscode.Uri;
  state: { HEAD?: { commit?: string }; onDidChange: vscode.Event<void> };
}

export interface RepoMatch {
  repoRoot: string;
  relPath: string;
  headSha: string | undefined;
  onHeadChanged: vscode.Event<void>;
}

export class RepoLocator {
  private api: GitApi | undefined;
  private readonly _onDidChangeRepositories = new vscode.EventEmitter<void>();
  readonly onDidChangeRepositories: vscode.Event<void> = this._onDidChangeRepositories.event;

  async ensureReady(): Promise<void> {
    if (this.api) return;
    const ext = vscode.extensions.getExtension<GitExtensionApi>('vscode.git');
    if (!ext) throw new Error('vscode.git extension not available');
    if (!ext.isActive) await ext.activate();
    this.api = ext.exports.getAPI(1);
    this.api.onDidOpenRepository(() => this._onDidChangeRepositories.fire());
    this.api.onDidCloseRepository(() => this._onDidChangeRepositories.fire());
  }

  locate(fileUri: vscode.Uri): RepoMatch | undefined {
    if (!this.api) return undefined;
    const filePath = fileUri.fsPath;
    let best: GitRepository | undefined;
    let bestLen = -1;
    for (const repo of this.api.repositories) {
      const root = repo.rootUri.fsPath;
      if (filePath === root || filePath.startsWith(root + '/') || filePath.startsWith(root + '\\')) {
        if (root.length > bestLen) {
          best = repo;
          bestLen = root.length;
        }
      }
    }
    if (!best) return undefined;
    const repoRoot = best.rootUri.fsPath;
    return {
      repoRoot,
      relPath: relative(repoRoot, filePath).replace(/\\/g, '/'),
      headSha: best.state.HEAD?.commit,
      onHeadChanged: best.state.onDidChange,
    };
  }
}
