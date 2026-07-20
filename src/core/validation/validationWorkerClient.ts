import type { ComputationResource } from '@core/computationResource';
import type { EncounterState } from '@core/encounter/types';
import { MVP_VALIDATORS } from './validators';
import type {
  ValidationAction,
  ValidationMode,
  ValidationResult,
  Validator
} from './types';
import type {
  ValidationWorkerRequest,
  ValidationWorkerResponse
} from './validationWorkerTypes';

type ValidationWorkerInput = {
  action: ValidationAction;
  mode: ValidationMode;
  nextState?: EncounterState;
  resource: ComputationResource;
  state: EncounterState;
  validators: Validator<EncounterState>[];
};

type PendingValidation = {
  reject: (reason?: unknown) => void;
  resolve: (results: ValidationResult[]) => void;
};

let worker: Worker | undefined;
let nextRequestId = 1;
const pending = new Map<number, PendingValidation>();

function rejectPending(reason: unknown): void {
  pending.forEach(({ reject }) => reject(reason));
  pending.clear();
}

function getWorker(): Worker | undefined {
  if (worker || typeof Worker === 'undefined') {
    return worker;
  }

  worker = new Worker(new URL('./validation.worker.ts', import.meta.url), {
    type: 'module'
  });
  worker.addEventListener(
    'message',
    (event: MessageEvent<ValidationWorkerResponse>) => {
      const request = pending.get(event.data.requestId);

      if (!request) {
        return;
      }

      pending.delete(event.data.requestId);
      request.resolve(event.data.results);
    }
  );
  worker.addEventListener('error', (event) => {
    worker?.terminate();
    worker = undefined;
    rejectPending(event.error ?? new Error('Validation worker failed.'));
  });

  return worker;
}

/** Runs the built-in validators off the UI thread when workers are available. */
export function runValidatorsInWorker({
  action,
  mode,
  nextState,
  resource,
  state,
  validators
}: ValidationWorkerInput): Promise<ValidationResult[]> | undefined {
  const validationWorker = getWorker();

  const builtInValidatorIds = new Set(
    MVP_VALIDATORS.map((validator) => validator.id)
  );

  if (
    !validationWorker ||
    validators.some((validator) => !builtInValidatorIds.has(validator.id))
  ) {
    return undefined;
  }

  const requestId = nextRequestId;
  nextRequestId += 1;
  const request: ValidationWorkerRequest = {
    action,
    mode,
    nextState,
    resource,
    state,
    type: 'validate',
    validatorIds: validators.map((validator) => validator.id),
    requestId
  };

  return new Promise<ValidationResult[]>((resolve, reject) => {
    pending.set(requestId, { reject, resolve });
    validationWorker.postMessage(request);
  });
}
