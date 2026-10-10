import { analyzeGridImage, type GridDetectionInput, type GridDetectionResponse } from '@core/movement/gridDetectionRuntime';
import { createDefaultGrid } from '@core/movement/types';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<GridDetectionResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor() { TestWorker.instances.push(this); }
}
const input = (): GridDetectionInput => ({ pixels: new Uint8ClampedArray(4), width: 1, height: 1, canvasWidth: 960, canvasHeight: 640, grid: createDefaultGrid() });
describe('grid detection worker lifecycle', () => {
  beforeEach(() => { TestWorker.instances = []; vi.stubGlobal('Worker', TestWorker); });
  afterEach(() => vi.unstubAllGlobals());
  it('terminates a successful worker and transfers pixel bytes without copying', async () => {
    const data = input(), result = analyzeGridImage(data, new AbortController().signal), worker = TestWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith(data, [data.pixels.buffer]);
    worker.onmessage!(new MessageEvent('message', { data: { grid: data.grid } }));
    expect(await result).toEqual(data.grid); expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
  it('terminates cancelled work immediately and avoids creating already-cancelled workers', async () => {
    const controller = new AbortController(), result = analyzeGridImage(input(), controller.signal);
    controller.abort(); expect(await result).toBeNull(); expect(TestWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
    expect(await analyzeGridImage(input(), controller.signal)).toBeNull(); expect(TestWorker.instances).toHaveLength(1);
  });
  it('reports worker failure while cleaning up the background task', async () => {
    const result = analyzeGridImage(input(), new AbortController().signal), worker = TestWorker.instances[0];
    worker.onmessage!(new MessageEvent('message', { data: { grid: null, error: 'Grid analysis failed.' } }));
    await expect(result).rejects.toThrow('Grid analysis failed'); expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
