import type { ComputationResource } from '@core/computationResource';
import type { EncounterState } from '@core/encounter/types';
import type { EncounterActionRecord } from '@core/history/types';
import type { PreparedValidatedEncounterChange } from './validatedEncounterChange';
import type { ValidationAction, ValidationMode, ValidationResult } from './types';

export type ValidationWorkerRequest = {
  action: ValidationAction;
  mode: ValidationMode;
  nextState?: EncounterState;
  resource: ComputationResource;
  state: EncounterState;
  type: 'validate';
  validatorIds: string[];
  requestId: number;
};

export type PrepareChangeWorkerRequest = {
  action: EncounterActionRecord;
  currentEncounter: EncounterState;
  nextEncounter: EncounterState;
  requestId: number;
  type: 'prepare-change';
};

export type ValidationWorkerMessage =
  | ValidationWorkerRequest
  | PrepareChangeWorkerRequest;

export type ValidationWorkerResponse = {
  requestId: number;
  results: ValidationResult[];
  type: 'validated';
};

export type PrepareChangeWorkerResponse = {
  prepared: PreparedValidatedEncounterChange;
  requestId: number;
  type: 'change-prepared';
};

export type ValidationWorkerMessageResponse =
  | ValidationWorkerResponse
  | PrepareChangeWorkerResponse;
