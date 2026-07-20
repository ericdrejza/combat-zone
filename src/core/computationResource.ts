export type ComputationResource = 'WEBGPU' | 'CPU';

let computationResource: ComputationResource = 'CPU';

/**
 * Stores the best computation resource discovered by an off-thread worker.
 * Keeping this outside a worker response lets layout, validation, and future
 * computation pipelines share the same capability decision.
 */
export function setComputationResource(resource: ComputationResource): void {
  computationResource = resource;
}

export function getComputationResource(): ComputationResource {
  return computationResource;
}
