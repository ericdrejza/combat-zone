import { detectGrid } from './gridDetection';
import type { GridDetectionInput, GridDetectionResponse } from './gridDetectionRuntime';

const scope = self as unknown as {
  addEventListener: (type: 'message', listener: (event: MessageEvent<GridDetectionInput>) => void) => void;
  postMessage: (response: GridDetectionResponse) => void;
};
scope.addEventListener('message', ({ data }) => {
  try { scope.postMessage({ grid: detectGrid(data.pixels, data.width, data.height, data.canvasWidth, data.canvasHeight, data.grid) }); }
  catch { scope.postMessage({ grid: null, error: 'Grid analysis failed. Try vertex alignment.' }); }
});
