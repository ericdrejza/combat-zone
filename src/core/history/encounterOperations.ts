const operations = new Set<symbol>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Session-only tokens prevent history replay from racing unfinished mutations. */
export function beginEncounterOperation(): () => void {
  const token = Symbol();
  operations.add(token);
  notify();
  return () => {
    if (operations.delete(token)) notify();
  };
}

export const isEncounterOperationActive = () => operations.size > 0;
export function subscribeEncounterOperations(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Hold the token through the consumer's commit, including failures. */
export function runEncounterOperation<T>(operation: () => T): T {
  const release = beginEncounterOperation();
  try {
    const result = operation();
    if (result instanceof Promise) return result.finally(release) as T;
    release();
    return result;
  } catch (error) {
    release();
    throw error;
  }
}

export function consumeEncounterPreparation<T>(
  prepared: T | Promise<T>, consume: (value: T) => void,
  onFailure?: () => void
): void | Promise<void> {
  const fail = (error: unknown) => {
    if (!onFailure) throw error;
    onFailure();
  };
  return runEncounterOperation(() => {
    if (prepared instanceof Promise) return prepared.then(consume).catch(fail);
    try { consume(prepared); } catch (error) { fail(error); }
  });
}
