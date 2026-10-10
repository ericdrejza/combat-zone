import type { EncounterState } from '@core/encounter/types';
import { getBackgroundFrame } from '@core/encounter/backgroundFrame';
/** Background placement defines coverage; without an image, retain the original unpadded canvas. */
export function getGridCoverage(state: EncounterState) {
  return state.backgroundImage ? getBackgroundFrame(state.backgroundImage, state.canvasSize) : state.gridCoverage ?? { ...state.canvasSize, x: 0, y: 0 };
}
