import { Waypoints, Radius, Cone, RectangleHorizontal, RectangleEllipsis } from 'lucide-react';

/** Keep the toolbar and artifact conversion controls on the same shape/icon vocabulary. */
export const RULER_SHAPE_OPTIONS = [
  { shape: 'path', label: 'Path ruler', Icon: Waypoints },
  { shape: 'circle', label: 'Circle ruler', Icon: Radius },
  { shape: 'cone', label: 'Cone ruler', Icon: Cone },
  { shape: 'rectangle', label: 'Rectangle ruler', Icon: RectangleHorizontal },
  { shape: 'line', label: 'Line ruler', Icon: RectangleEllipsis }
] as const;
