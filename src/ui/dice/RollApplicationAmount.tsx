import { Pencil } from "lucide-react";
import { DICE_BUTTON, DICE_INPUT, DiceIconButton } from "./DiceIconButton";

/** Amount drafts remain independent per actor as tiles regroup or wrap. */
export function RollApplicationAmount({ name, value, editing, disabled, onChange, onEdit }: {
  name: string; value: string; editing: boolean; disabled: boolean; onChange: (value: string) => void; onEdit: () => void;
}) {
  return <div className="mt-1 min-w-0 space-y-1">
    <div className="grid h-8 grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-center gap-0.5 text-center">
      {editing ? <button className={`${DICE_BUTTON} !px-0 !py-1`} type="button" disabled={disabled} aria-label={`Decrease amount for ${name}`} onClick={() => onChange(String(Number(value) - 1))}>−</button> : <span />}
      {editing ? <input className={`${DICE_INPUT} mx-auto !w-full max-w-[3.5rem] !px-1 !py-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} aria-label={`Amount for ${name}`} type="number" min="1" step="1" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} /> : <span>{value}</span>}
      {editing ? <button className={`${DICE_BUTTON} !px-0 !py-1`} type="button" disabled={disabled} aria-label={`Increase amount for ${name}`} onClick={() => onChange(String(Number(value) + 1))}>+</button> : <span />}
    </div>
    <div className="flex items-center justify-between gap-1">
      <DiceIconButton className={editing ? "bg-canvas-surface" : ""} label={`Edit amount for ${name}`} aria-pressed={editing} disabled={disabled} onClick={onEdit}><Pencil className="h-3 w-3" /></DiceIconButton>
      {editing ? <><button className={`${DICE_BUTTON} !px-1 !py-2 text-xs`} type="button" disabled={disabled} onClick={() => onChange(String(Math.floor(Number(value) / 2)))}>/2</button><button className={`${DICE_BUTTON} !px-1 !py-2 text-xs`} type="button" disabled={disabled} onClick={() => onChange(String(Number(value) * 2))}>×2</button></> : null}
    </div>
  </div>;
}
