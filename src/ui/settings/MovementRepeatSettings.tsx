import { SettingsField, SETTINGS_CONTROL } from './SettingsLayout';
import { useEffect, useState } from 'react';
import { useCombatPreferences } from '@ui/combat_preferences/CombatPreferenceProvider';

export function MovementRepeatSettings() {
  const { movementRepeatDelayMs, setMovementRepeatDelayMs } = useCombatPreferences();
  const [draft, setDraft] = useState(String(movementRepeatDelayMs));
  useEffect(() => setDraft(String(movementRepeatDelayMs)), [movementRepeatDelayMs]);
  return <SettingsField label="Held movement repeat delay (ms)" description="Time between Grid and Free movement steps while holding a key. Higher values move more slowly (50–2000 ms). Saves when you leave the field or press Enter.">
    <input aria-label="Held movement repeat delay (ms)" type="number" min="50" max="2000" step="10" value={draft}
      className={SETTINGS_CONTROL}
      onChange={event => setDraft(event.currentTarget.value)} onBlur={() => {
        const value = Number(draft);
        if (Number.isSafeInteger(value) && value >= 50 && value <= 2000) setMovementRepeatDelayMs(value);
        else setDraft(String(movementRepeatDelayMs));
      }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
  </SettingsField>;
}
