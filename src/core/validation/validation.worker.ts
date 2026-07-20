import { MVP_VALIDATORS } from './validators';
import type {
  ValidationWorkerRequest,
  ValidationWorkerResponse
} from './validationWorkerTypes';

const workerScope = self as unknown as {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<ValidationWorkerRequest>) => void
  ) => void;
  postMessage: (message: ValidationWorkerResponse) => void;
};

workerScope.addEventListener('message', (event) => {
  const request = event.data;

  if (request.type !== 'validate') {
    return;
  }

  const validatorsById = new Map(
    MVP_VALIDATORS.map((validator) => [validator.id, validator])
  );
  const context = {
    mode: request.mode,
    nextState: request.nextState,
    state: request.state
  };
  const results = request.validatorIds.flatMap((validatorId) => {
    const validator = validatorsById.get(validatorId);

    return validator ? [validator.validate(request.action, context)] : [];
  });

  workerScope.postMessage({
    requestId: request.requestId,
    results,
    type: 'validated'
  });
});
