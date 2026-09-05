import { FileText } from "lucide-react";
import type { DragEvent, PointerEvent } from "react";
import type { MotionValue } from "motion/react";

import type { EncounterRecord } from "@core/persistence";
import { AssetImagePreview } from "./AssetImagePreview";
import type { AssetLibraryViewMode } from "./assetLibraryView";

type AssetLibraryEncounterItemProps = {
  loadingRotation: MotionValue<string>;
  readOnly: boolean;
  record: EncounterRecord;
  selected: boolean;
  viewMode: AssetLibraryViewMode;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
  itemRef: (element: HTMLDivElement | null) => void;
};

export function AssetLibraryEncounterItem({
  loadingRotation,
  readOnly,
  record,
  selected,
  viewMode,
  onContextMenu,
  onDragStart,
  onDoubleClick,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  onSelect,
  itemRef
}: AssetLibraryEncounterItemProps) {
  const listView = viewMode === "list";
  const backgroundImage = record.state.backgroundImage;
  const itemClass = selected
    ? "border-canvas-ink ring-2 ring-canvas-ink/20"
    : "border-canvas-line";

  return (
    <div
      className={`${listView ? "rounded-xl" : "rounded-2xl"} border bg-white p-2 transition hover:bg-canvas ${itemClass}`}
      draggable={!readOnly}
      ref={itemRef}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
    >
      <button
        aria-label={record.state.name}
        aria-pressed={selected}
        className={listView ? "group flex w-full items-center gap-3 text-left" : "w-full text-left"}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        type="button"
      >
        <span
          className={listView
            ? "flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-lg bg-canvas"
            : "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-canvas"}
        >
          {backgroundImage ? (
            <AssetImagePreview
              name={record.state.name}
              rotation={loadingRotation}
              source={backgroundImage.source}
            />
          ) : (
            <FileText aria-hidden="true" className={listView ? "h-5 w-5" : "h-10 w-10"} />
          )}
        </span>
        <span className={listView ? "min-w-0 flex-1 truncate text-sm font-medium" : "mt-2 block truncate text-xs font-medium"}>
          {record.state.name}
        </span>
      </button>
    </div>
  );
}
