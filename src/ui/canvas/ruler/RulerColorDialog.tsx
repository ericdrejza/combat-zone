import { useState } from 'react';
import { RulerColorDialogFrame } from './RulerColorDialogFrame';
import type { LockedRuler } from '@core/measurement/types';
import { ColorOpacityFields, type ColorOpacity } from '@ui/controls/ColorOpacityFields';
import { SETTINGS_BUTTON } from '@ui/settings/SettingsLayout';

/** Preview valid drafts without history; only Save commits the final appearance. */
export function RulerColorDialog({ ruler, inherited, readOnly, onSave, onClose, onPreview }: {
  ruler: LockedRuler; inherited: ColorOpacity; readOnly: boolean;
  onPreview?: (value: ColorOpacity) => void;
  onSave: (patch: { color: string | null; opacity: number | null }) => void; onClose: () => void;
}) {
  const [initial] = useState<ColorOpacity>(() => ({ color: ruler.color ?? inherited.color, opacity: ruler.opacity ?? inherited.opacity }));
  const [draft, setDraft] = useState(initial), [valid, setValid] = useState(true);
  return <RulerColorDialogFrame onClose={onClose}
      onSubmit={event => {
        event.preventDefault(); if (!valid || readOnly) return;
        onSave({ color: draft.color === initial.color ? ruler.color : draft.color, opacity: draft.opacity === initial.opacity ? ruler.opacity : draft.opacity });
        onClose();
      }}>
      <ColorOpacityFields label="Artifact" value={draft} onChange={value => { setDraft(value); onPreview?.(value); }} onValidityChange={setValid} keepPickerOpen />
      <div className="flex justify-between gap-3">
        <button className={SETTINGS_BUTTON} onClick={onClose} type="button">Cancel</button>
        <button className={SETTINGS_BUTTON} disabled={!valid || readOnly} type="submit">Save</button>
      </div>
  </RulerColorDialogFrame>;
}
