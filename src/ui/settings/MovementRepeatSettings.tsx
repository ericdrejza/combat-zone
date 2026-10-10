import { useEffect, useState } from 'react';
import { useCombatPreferences } from '@ui/combat_preferences/CombatPreferenceProvider';

export function MovementRepeatSettings() {
  const { movementRepeatDelayMs, setMovementRepeatDelayMs } = useCombatPreferences();
  const [draft, setDraft] = useState(String(movementRepeatDelayMs));
  useEffect(() => setDraft(String(movementRepeatDelayMs)), [movementRepeatDelayMs]);
  return <label className="block space-y-2 text-sm font-semibold">Held movement repeat delay (ms)
    <input aria-label="Held movement repeat delay (ms)" type="number" min="50" max="2000" step="10" value={draft}
      className="w-full rounded-xl border border-canvas-line bg-canvas p-2 font-normal hover:border-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink"
      onChange={event => setDraft(event.currentTarget.value)} onBlur={() => {
        const value = Number(draft);
        if (Number.isSafeInteger(value) && value >= 50 && value <= 2000) setMovementRepeatDelayMs(value);
        else setDraft(String(movementRepeatDelayMs));
      }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    <span className="block font-normal text-canvas-muted">Time between Grid and Free movement steps while holding a key. Higher values move more slowly (50–2000 ms). Saves when you leave the field.</span>
  </label>;
}
