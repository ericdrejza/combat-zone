import { Pencil } from "lucide-react";

type EncounterTitleProps = {
  compact?: boolean;
  name: string;
  onRename: () => void;
};

/** Keeps the active encounter identity visible without consuming mobile toolbar space. */
export function EncounterTitle({ compact = false, name, onRename }: EncounterTitleProps) {
  return (
    <button
      aria-label={`Rename encounter ${name}`}
      className={
        compact
          ? "inline-flex max-w-[min(16rem,calc(100vw-7rem))] items-center gap-2 rounded-full border border-canvas-line bg-canvas-panel/95 px-3 py-2 text-sm font-semibold shadow-md backdrop-blur"
          : "inline-flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/60"
      }
      onClick={onRename}
      title="Rename encounter"
      type="button"
    >
      <span className="truncate">{name}</span>
      <Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />
    </button>
  );
}
