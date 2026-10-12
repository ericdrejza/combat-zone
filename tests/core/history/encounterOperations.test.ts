import { beginEncounterOperation, consumeEncounterPreparation, isEncounterOperationActive, runEncounterOperation, subscribeEncounterOperations } from '@core/history/encounterOperations';

it('keeps overlapping tokens active until every owner releases, idempotently', () => {
  const listener = vi.fn();
  const unsubscribe = subscribeEncounterOperations(listener);
  const first = beginEncounterOperation(), second = beginEncounterOperation();
  first(); first();
  expect(isEncounterOperationActive()).toBe(true);
  second();
  expect(isEncounterOperationActive()).toBe(false);
  expect(listener).toHaveBeenCalledTimes(4);
  unsubscribe();
});

it('holds asynchronous preparation through the consumer commit', async () => {
  let resolve!: (value: number) => void;
  const promise = new Promise<number>((done) => { resolve = done; });
  const consumer = vi.fn(() => expect(isEncounterOperationActive()).toBe(true));
  const result = consumeEncounterPreparation(promise, consumer);
  expect(isEncounterOperationActive()).toBe(true);
  resolve(1);
  await result;
  expect(consumer).toHaveBeenCalledWith(1);
  expect(isEncounterOperationActive()).toBe(false);
});

it('releases on rejected preparation and synchronous consumer errors', async () => {
  await expect(consumeEncounterPreparation(Promise.reject(new Error('failed')), () => undefined)).rejects.toThrow('failed');
  expect(isEncounterOperationActive()).toBe(false);
  expect(() => runEncounterOperation(() => { throw new Error('failed'); })).toThrow('failed');
  expect(isEncounterOperationActive()).toBe(false);
});
