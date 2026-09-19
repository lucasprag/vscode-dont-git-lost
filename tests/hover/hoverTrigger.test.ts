import { describe, it, expect } from 'vitest';
import { shouldProvideBlameHover } from '../../src/hover/hoverTrigger';

describe('shouldProvideBlameHover', () => {
  it('annotation: rejects mid-line', () => {
    expect(shouldProvideBlameHover('annotation', 5, 20)).toBe(false);
  });
  it('annotation: allows at EOL', () => {
    expect(shouldProvideBlameHover('annotation', 20, 20)).toBe(true);
  });
  it('line: allows mid-line', () => {
    expect(shouldProvideBlameHover('line', 5, 20)).toBe(true);
  });
  it('annotation: allows at EOL', () => {
    expect(shouldProvideBlameHover('annotation', 20, 20)).toBe(true);
  });
});
