import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import type { EncounterState } from '@core/encounter/types';
import { updateGridConfiguration } from '@core/movement/updateGridConfiguration';
import { useInterfacePreferences } from '@ui/interface_preferences/InterfacePreferenceProvider';

/** Settings previews use the same resize candidate as Apply without touching durable state. */
export function useGridMapPreview(encounter: EncounterState) {
  const draft = useSelector((state: RootState) => state.interaction.gridPreview);
  const aligning = useSelector((state: RootState) => state.interaction.gridCalibrationActive);
  const { backgroundResizeOverflowBehavior } = useInterfacePreferences();
  return useMemo(() => !aligning && draft
    ? updateGridConfiguration(encounter, draft, backgroundResizeOverflowBehavior)
    : encounter, [encounter, draft, aligning, backgroundResizeOverflowBehavior]);
}
