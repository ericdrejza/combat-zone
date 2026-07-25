import { describe, expect, it } from 'vitest';

import {
  packPolygonActors,
  resolvePolygonNestingSettings,
  type NestingActor
} from '@core/layout/nesting_ts';
import { tryPack } from '@core/layout/nestingPacking';
import { getFittingSplitSectionPacking } from '@core/layout/splitSectionPacking';
import { getSplitLayoutSections } from '@core/layout/splitSectionLayout';
import {
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import type { LayoutPoint } from '@core/layout/types';

const rectangle = (width: number, height: number): LayoutPoint[] => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height }
];

function actor(
  id: string,
  layoutGroup: NonNullable<NestingActor['layoutGroup']>,
  radius = 30
): NestingActor {
  return { id, layoutGroup, radius, shape: 'circle' };
}

describe('isolated split section layouts', () => {
  it('derives a SPLIT_FLEX faction layout from only actors in that section', () => {
    const actors = [
      actor('hero-one', 'hero'),
      actor('hero-two', 'hero'),
      actor('hero-three', 'hero'),
      actor('hero-four', 'hero'),
      actor('neutral-one', 'neutral'),
      actor('neutral-two', 'neutral'),
      actor('enemy', 'enemy', 45)
    ];
    const polygon = rectangle(600, 300);
    const settings = resolvePolygonNestingSettings({
      layoutStrategy: 'SPLIT_FLEX'
    });
    const splitResult = packPolygonActors({
      actors,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_FLEX',
      polygon
    });
    const neutralSection = getSplitLayoutSections(
      { actors, layoutOrientation: 'LEFT_RIGHT', polygon },
      settings,
      splitResult.borderSpacing
    ).find((section) => section.id === 'neutral')!;
    const neutralResult = packPolygonActors({
      actors: neutralSection.actors,
      polygon: neutralSection.polygon,
      settings: {
        actorGap: settings.actorGap,
        minimumBorderSpacing: splitResult.borderSpacing,
        preferredBorderSpacing: splitResult.borderSpacing
      }
    });

    expect(splitResult.fits).toBe(true);
    expect(neutralResult.fits).toBe(true);
    expect(splitResult.placements['neutral-one']).toEqual(
      neutralResult.placements['neutral-one']
    );
    expect(splitResult.placements['neutral-two']).toEqual(
      neutralResult.placements['neutral-two']
    );
  });

  it('centers SPLIT_SEQUENTIAL actors on aligned wrapping rows', () => {
    const heroes = Array.from({ length: 5 }, (_, index) =>
      actor(`hero-${index}`, 'hero', 20)
    );
    const actors = [...heroes, actor('enemy', 'enemy', 60)];
    const polygon = rectangle(400, 240);
    const result = packPolygonActors({
      actors,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_SEQUENTIAL',
      polygon
    });
    const settings = resolvePolygonNestingSettings({
      layoutStrategy: 'SPLIT_SEQUENTIAL'
    });
    const heroSection = getSplitLayoutSections(
      { actors, layoutOrientation: 'LEFT_RIGHT', polygon },
      settings,
      result.borderSpacing
    ).find((section) => section.id === 'hero')!;
    const rows = new Map<number, LayoutPoint[]>();

    for (const hero of heroes) {
      const point = result.placements[hero.id];
      const row = rows.get(point.y) ?? [];
      row.push(point);
      rows.set(point.y, row);
    }

    expect(result.fits).toBe(true);
    expect(rows.size).toBeGreaterThan(1);

    for (const points of rows.values()) {
      const rowCenter =
        points.reduce((total, point) => total + point.x, 0) / points.length;

      expect(rowCenter).toBeCloseTo(
        (heroSection.bounds.minX + heroSection.bounds.maxX) / 2,
        5
      );
      expect(points.map((point) => point.x)).toEqual(
        [...points].map((point) => point.x).sort((a, b) => a - b)
      );
    }
  });

  it('moves boundaries across all three sections before applying area weighting', () => {
    const width = 303;
    const height = 544;
    const polygon = Array.from({ length: 32 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;

      return {
        x: width / 2 + Math.cos(angle) * width / 2,
        y: height / 2 + Math.sin(angle) * height / 2
      };
    });
    const actors: NestingActor[] = [
      { id: 'hero-0', layoutGroup: 'hero', radius: 27, shape: 'circle' },
      { id: 'hero-1', layoutGroup: 'hero', radius: 24, shape: 'rectangle' },
      { id: 'neutral-0', layoutGroup: 'neutral', radius: 16, shape: 'circle' },
      { id: 'neutral-1', layoutGroup: 'neutral', radius: 19, shape: 'rectangle' },
      { id: 'neutral-2', layoutGroup: 'neutral', radius: 30, shape: 'circle' },
      { id: 'neutral-3', layoutGroup: 'neutral', radius: 45, shape: 'circle' },
      { id: 'enemy-0', layoutGroup: 'enemy', radius: 14, shape: 'rectangle' },
      { id: 'enemy-1', layoutGroup: 'enemy', radius: 33, shape: 'circle' },
      { id: 'enemy-2', layoutGroup: 'enemy', radius: 35, shape: 'circle' }
    ];
    const input = {
      actors,
      layoutOrientation: 'LEFT_RIGHT' as const,
      layoutStrategy: 'SPLIT_FLEX' as const,
      polygon
    };
    const result = packPolygonActors(input);
    const settings = resolvePolygonNestingSettings(input);
    const preferred = getSplitLayoutSections(
      input,
      settings,
      result.borderSpacing
    );
    const fitting = getFittingSplitSectionPacking(
      input,
      settings,
      result.borderSpacing,
      'FLEX'
    );

    expect(result.fits).toBe(true);
    expect(result.borderSpacing).toBe(12);
    expect(
      preferred.every((section) =>
        tryPack(
          {
            ...input,
            actors: section.actors,
            layoutStrategy: 'FLEX',
            polygon: section.polygon
          },
          settings,
          result.borderSpacing
        ).fits
      )
    ).toBe(false);
    expect(fitting).toBeDefined();
    expect(fitting!.sections[0].bounds.maxX).toBeGreaterThan(
      preferred[0].bounds.maxX
    );
    expect(
      fitting!.sections[2].bounds.maxX - fitting!.sections[2].bounds.minX
    ).toBeLessThan(
      preferred[2].bounds.maxX - preferred[2].bounds.minX
    );

    for (const section of fitting!.sections) {
      for (const current of section.actors) {
        expect(
          isFootprintInsideZone(
            getFootprint(
              current,
              result.placements[current.id],
              result.borderSpacing,
              settings.circleSegments
            ),
            section.polygon
          )
        ).toBe(true);
      }
    }
  });
});
