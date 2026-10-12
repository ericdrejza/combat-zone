import { useLayoutEffect } from 'react';
import { beginEncounterOperation } from '@core/history/encounterOperations';

/** Keep local drafts outside Redux while sharing their history-blocking lifetime. */
export function useEncounterOperation(active: boolean): void {
  useLayoutEffect(() => active ? beginEncounterOperation() : undefined, [active]);
}
