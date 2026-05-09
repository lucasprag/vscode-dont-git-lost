export interface DiffRanges {
  // 1-based line ranges in the new (post-commit) file that were added or modified.
  added: Array<{ start: number; end: number }>;
  // 1-based line numbers in the new file where deletions happened ABOVE the line
  // (i.e., lines were deleted between (line - 1) and line). Use to render a
  // "deletion marker" on the line below the deletion.
  deletedAbove: number[];
}

export function parseUnifiedDiff(diff: string): DiffRanges {
  const added: Array<{ start: number; end: number }> = [];
  const deletedAbove: number[] = [];
  for (const line of diff.split('\n')) {
    const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!m) continue;
    const newStart = parseInt(m[3], 10);
    const newCount = m[4] !== undefined ? parseInt(m[4], 10) : 1;
    if (newCount > 0) {
      added.push({ start: newStart, end: newStart + newCount - 1 });
    } else {
      // Pure deletion. With --unified=0, when newCount=0, newStart is the line
      // in the new file AFTER which the deletion happened. The "first line below"
      // the deletion is newStart + 1 (or 1 if newStart=0, meaning at file start).
      deletedAbove.push(newStart + 1);
    }
  }
  return { added, deletedAbove };
}
