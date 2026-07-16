import type { LayoutPoint } from '@core/layout/types';
import type { NestingCandidateRanker } from '@core/layout/nestingPackingAsync';

const GPU_BUFFER_MAP_READ = 0x0001;
const GPU_BUFFER_COPY_SRC = 0x0004;
const GPU_BUFFER_COPY_DST = 0x0008;
const GPU_BUFFER_UNIFORM = 0x0040;
const GPU_BUFFER_STORAGE = 0x0080;

type GpuBuffer = {
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  destroy(): void;
};

type GpuDevice = {
  createShaderModule(descriptor: { code: string }): unknown;
  createComputePipeline(descriptor: {
    layout: 'auto';
    compute: { module: unknown; entryPoint: string };
  }): GpuPipeline;
  createBuffer(descriptor: {
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
  }): GpuBuffer;
  createBindGroup(descriptor: {
    layout: unknown;
    entries: Array<{ binding: number; resource: { buffer: GpuBuffer } }>;
  }): unknown;
  createCommandEncoder(): GpuCommandEncoder;
  queue: {
    writeBuffer(buffer: GpuBuffer, offset: number, data: ArrayBufferLike): void;
    submit(commandBuffers: unknown[]): void;
  };
};

type GpuPipeline = {
  getBindGroupLayout(index: number): unknown;
};

type GpuCommandEncoder = {
  beginComputePass(): GpuComputePass;
  copyBufferToBuffer(
    source: GpuBuffer,
    sourceOffset: number,
    destination: GpuBuffer,
    destinationOffset: number,
    size: number
  ): void;
  finish(): unknown;
};

type GpuComputePass = {
  setPipeline(pipeline: GpuPipeline): void;
  setBindGroup(index: number, bindGroup: unknown): void;
  dispatchWorkgroups(count: number): void;
  end(): void;
};

type GpuAdapter = {
  requestDevice(): Promise<GpuDevice>;
};

type GpuNavigator = {
  gpu?: {
    requestAdapter(): Promise<GpuAdapter | null>;
  };
};

const DISTANCE_SHADER = /* wgsl */ `
struct Point {
  x: f32,
  y: f32,
};

@group(0) @binding(0) var<storage, read> points: array<Point>;
@group(0) @binding(1) var<storage, read_write> distances: array<f32>;
@group(0) @binding(2) var<uniform> target: vec2<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&points)) {
    return;
  }

  let delta = vec2<f32>(points[index].x - target.x, points[index].y - target.y);
  distances[index] = dot(delta, delta);
}
`;

export type ProactivePlacementAcceleration = {
  kind: 'WEBGPU';
  rankCandidates: NestingCandidateRanker;
};

/**
 * Creates the optional GPU ranker inside the placement worker. WebGPU is
 * deliberately best-effort: it accelerates candidate distance calculations,
 * while CPU geometry remains authoritative and is always available as the
 * compatibility path.
 */
export async function createProactivePlacementGpuAccelerator(): Promise<
  ProactivePlacementAcceleration | undefined
> {
  const gpuNavigator = globalThis as typeof globalThis & {
    navigator?: GpuNavigator;
  };
  try {
    const adapter = await gpuNavigator.navigator?.gpu?.requestAdapter();

    if (!adapter) {
      return undefined;
    }

    const device = await adapter.requestDevice();
    const module = device.createShaderModule({ code: DISTANCE_SHADER });
    const pipeline = device.createComputePipeline({
      compute: { entryPoint: 'main', module },
      layout: 'auto'
    });

    return {
      kind: 'WEBGPU',
      rankCandidates: (candidates, target) =>
        rankCandidatesWithGpu(device, pipeline, candidates, target)
    };
  } catch {
    return undefined;
  }
}

async function rankCandidatesWithGpu(
  device: GpuDevice,
  pipeline: GpuPipeline,
  candidates: LayoutPoint[],
  target: LayoutPoint
): Promise<LayoutPoint[]> {
  if (candidates.length < 2) {
    return candidates;
  }

  const points = new Float32Array(
    candidates.flatMap(({ x, y }) => [x, y])
  );
  const targetValues = new Float32Array([target.x, target.y]);
  const scoreByteLength = candidates.length * Float32Array.BYTES_PER_ELEMENT;
  const pointBuffer = device.createBuffer({
    size: points.byteLength,
    usage: GPU_BUFFER_STORAGE | GPU_BUFFER_COPY_DST
  });
  const scoreBuffer = device.createBuffer({
    size: scoreByteLength,
    usage: GPU_BUFFER_STORAGE | GPU_BUFFER_COPY_SRC
  });
  const targetBuffer = device.createBuffer({
    size: targetValues.byteLength,
    usage: GPU_BUFFER_UNIFORM | GPU_BUFFER_COPY_DST
  });
  const readbackBuffer = device.createBuffer({
    size: scoreByteLength,
    usage: GPU_BUFFER_COPY_DST | GPU_BUFFER_MAP_READ
  });

  try {
    device.queue.writeBuffer(pointBuffer, 0, points.buffer);
    device.queue.writeBuffer(targetBuffer, 0, targetValues.buffer);
    const bindGroup = device.createBindGroup({
      entries: [
        { binding: 0, resource: { buffer: pointBuffer } },
        { binding: 1, resource: { buffer: scoreBuffer } },
        { binding: 2, resource: { buffer: targetBuffer } }
      ],
      layout: pipeline.getBindGroupLayout(0)
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(candidates.length / 64));
    pass.end();
    encoder.copyBufferToBuffer(
      scoreBuffer,
      0,
      readbackBuffer,
      0,
      scoreByteLength
    );
    device.queue.submit([encoder.finish()]);
    await readbackBuffer.mapAsync(GPU_BUFFER_MAP_READ);
    const scores = new Float32Array(readbackBuffer.getMappedRange()).slice();
    readbackBuffer.unmap();

    return candidates
      .map((point, index) => ({ index, point }))
      .sort(
        (first, second) =>
          scores[first.index] - scores[second.index] ||
          first.index - second.index
      )
      .map(({ point }) => point);
  } finally {
    pointBuffer.destroy();
    scoreBuffer.destroy();
    targetBuffer.destroy();
    readbackBuffer.destroy();
  }
}
