import { packPolygonActorsWithCandidateRanker } from '@core/layout/nestingPackingAsync';
import { packPolygonFlexActors } from '@core/layout/polygonFlexLayout';
import type { NestingActor } from '@core/layout/nesting_ts';
import { createProactivePlacementGpuAccelerator } from '@ui/canvas/actors/proactivePlacementGpu';

const ACTOR_COUNTS = [12, 25, 50] as const;
const MEASURED_SAMPLES = 20;
const polygon = [
  { x: 0, y: 0 },
  { x: 1400, y: 0 },
  { x: 1400, y: 1000 },
  { x: 0, y: 1000 }
];

type Timing = {
  medianMs: number;
  p95Ms: number;
};

function actors(count: number): NestingActor[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `actor-${index}`,
    radius: 30,
    shape: index % 3 === 0 ? 'rectangle' : 'circle'
  }));
}

function summarize(samples: number[]): Timing {
  const sorted = [...samples].sort((first, second) => first - second);

  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)]
  };
}

async function measure(operation: () => void | Promise<void>): Promise<Timing> {
  await operation();
  const samples: number[] = [];

  for (let sample = 0; sample < MEASURED_SAMPLES; sample += 1) {
    const start = performance.now();
    await operation();
    samples.push(performance.now() - start);
  }

  return summarize(samples);
}

async function run(): Promise<void> {
  const output = document.querySelector<HTMLPreElement>('#output');
  const button = document.querySelector<HTMLButtonElement>('#run');

  if (!output || !button) {
    return;
  }

  button.disabled = true;
  output.textContent = 'Running CPU measurements…';
  const accelerator = await createProactivePlacementGpuAccelerator().catch(
    () => undefined
  );
  const results = [];

  for (const actorCount of ACTOR_COUNTS) {
    const input = { actors: actors(actorCount), polygon };
    const cpu = await measure(() => {
      if (!packPolygonFlexActors(input).fits) {
        throw new Error(`CPU packing failed for ${actorCount} actors.`);
      }
    });
    const gpu = accelerator
      ? await measure(async () => {
          const packed = await packPolygonActorsWithCandidateRanker(
            input,
            accelerator.rankCandidates
          );

          if (!packed.fits) {
            throw new Error(`WebGPU packing failed for ${actorCount} actors.`);
          }
        })
      : undefined;

    results.push({
      actors: actorCount,
      cpu,
      gpu,
      gpuSpeedup:
        gpu === undefined ? undefined : cpu.medianMs / gpu.medianMs
    });
    output.textContent = JSON.stringify(results, null, 2);
  }

  const fifty = results.find((result) => result.actors === 50);
  const smallerRegressed = results
    .filter((result) => result.actors < 50 && result.gpu)
    .some((result) => result.gpu!.medianMs > result.cpu.medianMs);
  const retainWebGpu = Boolean(
    fifty?.gpu &&
      fifty.cpu.medianMs / fifty.gpu.medianMs >= 1.2 &&
      !smallerRegressed
  );

  output.textContent = JSON.stringify(
    {
      adapter: accelerator?.kind ?? 'UNAVAILABLE',
      results,
      verdict: accelerator
        ? retainWebGpu
          ? 'RETAIN_WEBGPU'
          : 'REMOVE_WEBGPU'
        : 'WEBGPU_UNAVAILABLE'
    },
    null,
    2
  );
  button.disabled = false;
}

document.querySelector('#run')?.addEventListener('click', () => {
  void run();
});
