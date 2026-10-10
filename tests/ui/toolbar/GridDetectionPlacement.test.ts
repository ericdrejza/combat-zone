import { detectBackgroundGrid } from '@ui/canvas/grid/detectBackgroundGrid';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { detectGridAtResolutions } from '@core/movement/gridDetectionPasses';
vi.mock('@core/movement/gridDetectionPasses', () => ({ detectGridAtResolutions: vi.fn() }));
describe('detection after canvas edge completion', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('detects in background-sized coordinates and translates the result into its saved placement', async () => {
    class TestImage {
      width = 580; height = 580; crossOrigin = ''; onload?: () => void;
      set src(_url: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', TestImage);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
    const state = createEncounterState({ id: 'placed-map', name: 'Placed map' });
    state.canvasSize = { width: 300, height: 300 };
    state.backgroundImage = { source: { kind: 'url', url: 'https://example.com/map.png' }, name: 'Map', mediaType: 'image/png', width: 580, height: 580, frame: { x: 5, y: 5, width: 290, height: 290 } };
    vi.mocked(detectGridAtResolutions).mockResolvedValue({ ...state.grid, origin: { x: 10, y: 20 } });
    const result = await detectBackgroundGrid('https://example.com/map.png', state, new AbortController().signal);
    expect(detectGridAtResolutions).toHaveBeenCalledWith(expect.objectContaining({ canvasWidth: 290, canvasHeight: 290 }));
    expect(result!.origin).toEqual({ x: 15, y: 25 });
  });
});
