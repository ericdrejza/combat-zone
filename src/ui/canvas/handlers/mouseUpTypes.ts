import type { Zone } from '@entities/zone/types';
import type { CanvasInteractionState } from '../canvasInteractionTypes';

/** State and geometry access needed while finalizing a canvas interaction. */
export type MouseUpHandlerInput = CanvasInteractionState & {
  getDisplayedPolygon: (zone: Zone) => Zone['polygon'];
};
