import type { CommitRef, NavState } from '../types';

export type HistoryFetcher = (filePath: string) => Promise<CommitRef[]>;

export type NavTarget = CommitRef | 'head' | 'noop';

export class Navigator {
  private states = new Map<string, NavState>();

  constructor(private fetcher: HistoryFetcher) {}

  async ensureLoaded(filePath: string): Promise<NavState> {
    let state = this.states.get(filePath);
    if (!state) {
      const commits = await this.fetcher(filePath);
      state = { commits, index: -1 };
      this.states.set(filePath, state);
    }
    return state;
  }

  async back(filePath: string): Promise<NavTarget> {
    const state = await this.ensureLoaded(filePath);
    const next = state.index + 1;
    if (next >= state.commits.length) return 'noop';
    state.index = next;
    return state.commits[next];
  }

  async forward(filePath: string): Promise<NavTarget> {
    const state = await this.ensureLoaded(filePath);
    if (state.index === -1) return 'noop';
    state.index -= 1;
    if (state.index === -1) return 'head';
    return state.commits[state.index];
  }

  returnToHead(filePath: string): void {
    const state = this.states.get(filePath);
    if (state) state.index = -1;
  }

  getIndex(filePath: string): number {
    return this.states.get(filePath)?.index ?? -1;
  }

  current(filePath: string): CommitRef | undefined {
    const state = this.states.get(filePath);
    if (!state || state.index === -1) return undefined;
    return state.commits[state.index];
  }

  setIndex(filePath: string, index: number): void {
    const state = this.states.get(filePath);
    if (state) state.index = index;
  }
}
