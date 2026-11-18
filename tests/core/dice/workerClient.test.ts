import { afterEach, expect, it, vi } from "vitest";
import { rollFormulas } from "@core/dice/workerClient";
class FakeWorker {
  static latest: FakeWorker;
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  terminate = vi.fn(); postMessage = vi.fn();
  constructor() { FakeWorker.latest = this; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("terminates timed-out work rather than blocking the browser indefinitely", async () => {
  vi.stubGlobal("Worker", FakeWorker); vi.useFakeTimers();
  const pending = rollFormulas(["d6!~999"]);
  const rejected = expect(pending).rejects.toThrow(/time budget/);
  await vi.advanceTimersByTimeAsync(4000); await rejected;
  expect(FakeWorker.latest.terminate).toHaveBeenCalledOnce();
});
it("cancels workers on encounter cleanup and rejects late results", async () => {
  vi.stubGlobal("Worker", FakeWorker); const controller = new AbortController();
  const pending = rollFormulas(["d6"], controller.signal); const rejected = expect(pending).rejects.toThrow(/cancelled/);
  controller.abort(); await rejected; expect(FakeWorker.latest.terminate).toHaveBeenCalledOnce();
});
