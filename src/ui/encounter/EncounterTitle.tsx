import { Pencil } from "lucide-react";

import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

type EncounterTitleProps = {
  compact?: boolean;
  iconOnly?: boolean;
  name: string;
  onRename: () => void;
};

/** Keeps the active encounter identity visible without consuming mobile toolbar space. */
export function EncounterTitle({
  compact = false,
  iconOnly = false,
  name,
  onRename
}: EncounterTitleProps) {
  const button = (
    <button
      aria-label={`Rename encounter ${name}`}
      className={
        iconOnly
          ? "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-canvas-line bg-white px-2 text-canvas-ink shadow-sm transition hover:bg-canvas"
          : compact
          ? "inline-flex max-w-[min(16rem,calc(100vw-7rem))] items-center gap-2 rounded-full border border-canvas-line bg-canvas-panel/95 px-3 py-2 text-sm font-semibold shadow-md backdrop-blur"
          : "inline-flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/60"
      }
      onClick={onRename}
      title="Rename encounter"
      type="button"
    >
      {!iconOnly ? <span className="truncate">{name}</span> : null}
      <Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />
    </button>
  );

  return iconOnly ? <TouchTooltip label={name}>{button}</TouchTooltip> : button;
}
