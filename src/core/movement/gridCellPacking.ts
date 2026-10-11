import type { LayoutPoint } from '@core/layout/types';

export type GridCellCandidate = { point: LayoutPoint; cells: string[] };

/** Whole cell sets are indivisible: relocating one actor must free every cell it owns. */
export function assignGridCells(candidates: GridCellCandidate[][]): Map<number, LayoutPoint> | null {
  const occupied = new Set<string>(), positions = new Map<number, LayoutPoint>();
  const failed = new Set<string>();
  function assign(remaining: number[]): boolean {
    if (!remaining.length) return true;
    const available = remaining.map(index => ({ index, choices: candidates[index].filter(candidate => candidate.cells.every(cell => !occupied.has(cell))) }));
    if (available.some(actor => !actor.choices.length)) return false;
    // Reject overcrowded regions before exploring equivalent arrangements.
    const cells = new Set(available.flatMap(actor => actor.choices.flatMap(candidate => candidate.cells)));
    const required = available.reduce((sum, actor) => sum + Math.min(...actor.choices.map(candidate => candidate.cells.length)), 0);
    if (cells.size < required) return false;
    available.sort((a, b) => a.choices.length - b.choices.length || b.choices[0].cells.length - a.choices[0].cells.length || a.index - b.index);
    const { index, choices } = available[0];
    const key = `${remaining.join(',')}:${[...occupied].sort().join(';')}`;
    if (failed.has(key)) return false;
    const next = remaining.filter(actor => actor !== index);
    for (const candidate of choices) {
      candidate.cells.forEach(cell => occupied.add(cell));
      positions.set(index, candidate.point);
      if (assign(next)) return true;
      candidate.cells.forEach(cell => occupied.delete(cell));
      positions.delete(index);
    }
    failed.add(key);
    return false;
  }
  return assign(candidates.map((_, index) => index)) ? positions : null;
}
