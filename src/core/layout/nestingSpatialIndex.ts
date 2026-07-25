import type { LayoutPoint } from './types';
import type { NestingActor } from './nesting_ts';
import {
  footprintsOverlap as polygonFootprintsOverlap,
  getFootprint
} from './polygonGeometry';

type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type IndexedFootprint = {
  actor: NestingActor;
  bounds: Bounds;
  center: LayoutPoint;
  polygon: LayoutPoint[];
  radius: number;
};

function getBounds(center: LayoutPoint, radius: number): Bounds {
  return {
    minX: center.x - radius,
    maxX: center.x + radius,
    minY: center.y - radius,
    maxY: center.y + radius
  };
}

function boundsOverlap(first: Bounds, second: Bounds): boolean {
  return !(
    first.maxX <= second.minX ||
    second.maxX <= first.minX ||
    first.maxY <= second.minY ||
    second.maxY <= first.minY
  );
}

function footprintsOverlap(
  first: IndexedFootprint,
  second: IndexedFootprint
): boolean {
  if (!boundsOverlap(first.bounds, second.bounds)) {
    return false;
  }

  return polygonFootprintsOverlap(first.polygon, second.polygon);
}

/**
 * Broad-phases actor collision checks into local grid cells. Only nearby
 * footprints reach the existing authoritative polygon narrow phase.
 */
export class NestingSpatialIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly footprints: IndexedFootprint[] = [];

  public constructor(
    private readonly cellSize: number,
    private readonly circleSegments: number
  ) {}

  public createFootprint(
    actor: NestingActor,
    center: LayoutPoint,
    expansion: number
  ): IndexedFootprint {
    const radius = actor.radius + expansion;

    return {
      actor,
      bounds: getBounds(center, radius),
      center,
      polygon: getFootprint(actor, center, expansion, this.circleSegments),
      radius
    };
  }

  public overlaps(footprint: IndexedFootprint): boolean {
    const candidateIndexes = new Set<number>();

    this.forEachCell(footprint.bounds, (key) => {
      this.cells.get(key)?.forEach((index) => candidateIndexes.add(index));
    });

    for (const index of candidateIndexes) {
      const placed = this.footprints[index];

      if (placed && footprintsOverlap(footprint, placed)) {
        return true;
      }
    }

    return false;
  }

  public insert(footprint: IndexedFootprint): void {
    const index = this.footprints.length;
    this.footprints.push(footprint);

    this.forEachCell(footprint.bounds, (key) => {
      const entries = this.cells.get(key);

      if (entries) {
        entries.push(index);
      } else {
        this.cells.set(key, [index]);
      }
    });
  }

  private forEachCell(bounds: Bounds, visit: (key: string) => void): void {
    const minColumn = Math.floor(bounds.minX / this.cellSize);
    const maxColumn = Math.floor(bounds.maxX / this.cellSize);
    const minRow = Math.floor(bounds.minY / this.cellSize);
    const maxRow = Math.floor(bounds.maxY / this.cellSize);

    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        visit(`${column}:${row}`);
      }
    }
  }
}
