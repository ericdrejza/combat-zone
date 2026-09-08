export {
  CANVAS_HEIGHT,
  CANVAS_WIDTH
} from '@core/layout/polygonCanvasBounds';
export const CLOSE_DISTANCE = 16;
export const MIN_SHAPE_SIZE = 8;
export const CIRCLE_SEGMENTS = 60;
export const HEXAGON_SEGMENTS = 6;
// These hex values mirror --color-canvas-panel so contrast calculations follow
// the surface surrounding the workable canvas area in both supported themes.
export const CANVAS_BACKGROUND_COLORS = {
  dark: '#27272a',
  light: '#fffaf0'
} as const;
export type CanvasColorTheme = keyof typeof CANVAS_BACKGROUND_COLORS;
export const CANVAS_BACKGROUND_COLOR = CANVAS_BACKGROUND_COLORS.light;
export const LOW_ZONE_OPACITY_THRESHOLD = 0.3;
export const BACKGROUND_SAMPLE_COUNT = 20;
