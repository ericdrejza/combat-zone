import type { ComputationResource } from '@core/computationResource';
import type { EncounterState } from '@core/encounter/types';
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

export type ValidationWorkerResponse = {
  requestId: number;
  results: ValidationResult[];
  type: 'validated';
};
