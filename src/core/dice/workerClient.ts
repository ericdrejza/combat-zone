import type { DiceResult } from "./types";

/** Each request owns a worker: cancellation or timeout cannot contaminate another roll. */
export function rollFormulas(formulas: string[], signal?: AbortSignal): Promise<DiceResult[]> {
  if (!formulas.length) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("Roll cancelled.")); return; }
    const worker = new Worker(new URL("./dice.worker.ts", import.meta.url), { type: "module" });
    const finish = (error?: string, results?: DiceResult[]) => {
      clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.terminate();
      if (error) reject(new Error(error)); else resolve(results ?? []);
    };
    const abort = () => finish("Roll cancelled.");
    const timer = setTimeout(() => finish("Roll exceeded its time budget. Reduce the dice or ~m cap."), 4000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ results?: DiceResult[]; error?: string }>) => finish(event.data.error, event.data.results);
    worker.onerror = () => finish("Dice engine could not run. Try again.");
    worker.postMessage(formulas);
  });
}
