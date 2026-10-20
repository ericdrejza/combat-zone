import { useEffect, useRef, useState } from 'react';
import type { LockedRuler } from '@core/measurement/types';
import { ColorOpacityFields, type ColorOpacity } from '@ui/controls/ColorOpacityFields';
import { SETTINGS_BUTTON } from '@ui/settings/SettingsLayout';

/** Color edits remain dialog-local until Save commits one appearance history action. */
export function RulerColorDialog({ ruler, inherited, readOnly, onSave, onClose }: {
  ruler: LockedRuler; inherited: ColorOpacity; readOnly: boolean;
  onSave: (patch: { color: string | null; opacity: number | null }) => void; onClose: () => void;
}) {
  const [initial] = useState<ColorOpacity>(() => ({ color: ruler.color ?? inherited.color, opacity: ruler.opacity ?? inherited.opacity }));
  const [draft, setDraft] = useState(initial), [valid, setValid] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, []);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label="Ruler color"
    className="viewport-overlay z-[110] flex items-center justify-center overflow-y-auto bg-black/30 p-4"
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    {/* Hex alpha can represent opacity between slider steps; use the fields' explicit validation. */}
    <form noValidate className="max-h-[calc(100dvh-2rem)] w-full max-w-sm space-y-4 overflow-y-auto rounded-2xl border border-canvas-line bg-canvas-panel p-4 text-canvas-ink shadow-xl"
      onSubmit={event => {
        event.preventDefault(); if (!valid || readOnly) return;
        onSave({ color: draft.color === initial.color ? ruler.color : draft.color, opacity: draft.opacity === initial.opacity ? ruler.opacity : draft.opacity });
        onClose();
      }}>
      <h2 className="font-semibold">Ruler color</h2>
      <ColorOpacityFields label="Artifact" value={draft} onChange={setDraft} onValidityChange={setValid} collapsiblePicker />
      <div className="flex justify-between gap-3">
        <button className={SETTINGS_BUTTON} onClick={onClose} type="button">Cancel</button>
        <button className={SETTINGS_BUTTON} disabled={!valid || readOnly} type="submit">Save</button>
      </div>
    </form>
  </div>;
}
