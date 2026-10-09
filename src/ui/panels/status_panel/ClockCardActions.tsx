import { Pencil, Trash2 } from "lucide-react";

const buttonClass = "absolute top-1 rounded p-1 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 enabled:hover:bg-canvas focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:text-canvas-muted disabled:!opacity-40";

/** Overlay actions preserve the name's layout on hover, focus, and touch. */
export function ClockCardActions({ name, disabled, onEdit, onDelete }: { name: string; disabled: boolean; onEdit: () => void; onDelete: () => void }) {
  return <>
    <button aria-label={`Edit ${name} clock`} title={disabled ? "Read-only encounter" : "Edit clock"} disabled={disabled}
      className={`${buttonClass} left-1 text-canvas-muted enabled:hover:text-canvas-ink`} onClick={onEdit} type="button"><Pencil aria-hidden="true" className="h-3 w-3" /></button>
    <button aria-label={`Delete ${name} clock`} title={disabled ? "Read-only encounter" : "Delete clock"} disabled={disabled}
      className={`${buttonClass} right-1 text-red-700 dark:text-red-500 enabled:hover:text-red-800 dark:enabled:hover:text-red-400`} onClick={onDelete} type="button"><Trash2 aria-hidden="true" className="h-3 w-3" /></button>
  </>;
}
