import { Trash2 } from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

/** Shared destructive affordance for clearing the log and deleting individual entries. */
export function LogDeleteButton({ label, disabled, onClick, plain = false }: {
  plain?: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return <TouchTooltip label={label}>
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={`flex shrink-0 items-center justify-center focus-visible:ring-2 disabled:cursor-not-allowed disabled:text-canvas-muted disabled:opacity-40 ${plain
        ? "h-6 w-6 bg-transparent text-red-700 enabled:hover:text-red-900 focus-visible:ring-red-700 dark:text-red-500 dark:enabled:hover:text-red-300 dark:focus-visible:ring-red-500 dark:disabled:text-canvas-muted"
        : "h-8 w-8 rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted enabled:hover:bg-canvas focus-visible:ring-canvas-ink"}`}>
      <Trash2 aria-hidden="true" className="h-4 w-4" />
    </button>
  </TouchTooltip>;
}
