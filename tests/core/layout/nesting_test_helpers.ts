import type { LayoutPoint } from '@core/layout/types';
import type { NestingActor } from '@core/layout/nesting_ts';

export const rectangle = (width: number, height: number): LayoutPoint[] => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height }
];

export const actor = (
  id: string,
  shape: NestingActor['shape'] = 'circle',
  radius = 30
): NestingActor => ({
  id,
  radius,
  shape
});
