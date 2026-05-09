import * as vscode from 'vscode';
import { readConfig } from '../config';

export class AuthBroker {
  async getGithubToken(silent: boolean): Promise<string | undefined> {
    try {
      const session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: !silent, silent });
      return session?.accessToken;
    } catch {
      return undefined;
    }
  }

  getGitlabToken(): string | undefined {
    const t = readConfig().gitlabToken;
    return t || undefined;
  }

  getBitbucketToken(): string | undefined {
    const t = readConfig().bitbucketToken;
    return t || undefined;
  }
}
