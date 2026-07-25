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
  PrepareChangeWorkerRequest,
  ValidationWorkerMessageResponse,
  ValidationWorkerRequest
} from './validationWorkerTypes';
import type {
  PrepareValidatedEncounterChangeInput,
  PreparedValidatedEncounterChange
} from './validatedEncounterChange';

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
const pendingChanges = new Map<
  number,
  {
    reject: (reason?: unknown) => void;
    resolve: (prepared: PreparedValidatedEncounterChange) => void;
  }
>();

function rejectPending(reason: unknown): void {
  pending.forEach(({ reject }) => reject(reason));
  pending.clear();
  pendingChanges.forEach(({ reject }) => reject(reason));
  pendingChanges.clear();
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
    (event: MessageEvent<ValidationWorkerMessageResponse>) => {
      if (event.data.type === 'change-prepared') {
        const changeRequest = pendingChanges.get(event.data.requestId);

        if (changeRequest) {
          pendingChanges.delete(event.data.requestId);
          changeRequest.resolve(event.data.prepared);
        }
        return;
      }

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

/**
 * Runs adjustment and validation in one worker turn so automatic zone fitting
 * does not execute synchronously before the first async boundary.
 */
export function prepareEncounterChangeInWorker({
  action,
  currentEncounter,
  nextEncounter,
  validators
}: PrepareValidatedEncounterChangeInput): Promise<PreparedValidatedEncounterChange> | undefined {
  if (validators) {
    return undefined;
  }

  const validationWorker = getWorker();

  if (!validationWorker) {
    return undefined;
  }

  const requestId = nextRequestId;
  nextRequestId += 1;
  const request: PrepareChangeWorkerRequest = {
    action,
    currentEncounter,
    nextEncounter,
    requestId,
    type: 'prepare-change'
  };

  return new Promise((resolve, reject) => {
    pendingChanges.set(requestId, { reject, resolve });
    validationWorker.postMessage(request);
  });
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
