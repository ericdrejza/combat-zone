import type { Actor } from '@entities/actor/types';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { SETTINGS_CONTROL } from '@ui/settings/SettingsLayout';

export function ActorMovementLimit({ actor, unit, onChange }: { actor: Actor; unit: string; onChange: (value: number | null) => void }) {
  const { readOnly } = usePersistence();
  return <label className="block space-y-1">Movement limit ({unit})<input key={`${actor.id}:${actor.movementLimit}`} aria-label="Movement limit" type="number" min="0" step="any"
    disabled={readOnly} className={SETTINGS_CONTROL} defaultValue={actor.movementLimit ?? ''} placeholder="No limit"
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    onBlur={event => {
      const input = event.currentTarget;
      if (!input.value) onChange(null);
      else if (input.validity.valid && Number.isFinite(input.valueAsNumber)) onChange(input.valueAsNumber);
      else input.value = String(actor.movementLimit ?? '');
    }} /></label>;
}
