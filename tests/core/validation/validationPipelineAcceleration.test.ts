import { describe, expect, it } from 'vitest';

import {
  getComputationResource,
  setComputationResource
} from '@core/computationResource';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { runValidationPipeline } from '@core/validation/pipeline';
import { MVP_VALIDATORS } from '@core/validation/validators';
import type {
  ValidationWorkerRequest,
  ValidationWorkerResponse
} from '@core/validation/validationWorkerTypes';

class FakeValidationWorker {
  static lastInstance: FakeValidationWorker | undefined;
  private listeners = new Map<string, (event: MessageEvent) => void>();
  request?: ValidationWorkerRequest;

  constructor() {
    FakeValidationWorker.lastInstance = this;
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void {
    this.listeners.set(type, listener);
  }

  postMessage(request: ValidationWorkerRequest): void {
    this.request = request;
    const response: ValidationWorkerResponse = {
      requestId: request.requestId,
      results: request.validatorIds.map(() => ({ valid: true, messages: [] })),
      type: 'validated'
    };

    queueMicrotask(() => {
      this.listeners.get('message')?.({ data: response } as MessageEvent);
    });
  }

  terminate(): void {}
}

describe('validation pipeline acceleration', () => {
  it('shares the selected computation resource with every built-in validator', async () => {
    const previousWorker = globalThis.Worker;
    globalThis.Worker = FakeValidationWorker as unknown as typeof Worker;
    setComputationResource('WEBGPU');

    try {
      const state = createEncounterState({
        id: 'validation-acceleration',
        name: 'Validation acceleration'
      });
      const result = await runValidationPipeline({
        state,
        action: {
          type: 'encounter.rename',
          payload: { name: 'Renamed' }
        }
      });

      expect(FakeValidationWorker.lastInstance?.request?.resource).toBe('WEBGPU');
      expect(FakeValidationWorker.lastInstance?.request?.validatorIds).toHaveLength(
        MVP_VALIDATORS.length
      );
      expect(result).toMatchObject({
        blocked: false,
        valid: true,
        messages: []
      });
    } finally {
      setComputationResource('CPU');
      if (previousWorker) {
        globalThis.Worker = previousWorker;
      } else {
        delete (globalThis as { Worker?: typeof Worker }).Worker;
      }
    }
  });

  it('exposes the resource independently of actor placement responses', () => {
    setComputationResource('WEBGPU');
    expect(getComputationResource()).toBe('WEBGPU');

    setComputationResource('CPU');
    expect(getComputationResource()).toBe('CPU');
  });
});
