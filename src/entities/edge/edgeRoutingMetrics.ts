export type EdgeRoutingMetrics = Record<string, number>;
let active: EdgeRoutingMetrics | undefined;

/** Worker-local diagnostics; never persisted or included in encounter history. */
export function measureEdgeRouting<T>(phase: string, calculate: () => T): T {
  if (!active) return calculate();
  active[`${phase}Calls`] = (active[`${phase}Calls`] ?? 0) + 1;
  const start = performance.now();
  try { return calculate(); }
  finally { active[phase] = (active[phase] ?? 0) + performance.now() - start; }
}

export function collectEdgeRoutingMetrics<T>(calculate: () => T): { value: T; metrics: EdgeRoutingMetrics } {
  const previous = active;
  const metrics: EdgeRoutingMetrics = {};
  active = metrics;
  try { return { value: measureEdgeRouting("total", calculate), metrics }; }
  finally { active = previous; }
}
