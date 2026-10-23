import type { DockSide, DropTarget } from "./PanelsShell";

type PanelDropMarkerProps = {
  active: boolean;
  enabled: boolean;
  overlay?: boolean;
  index: number;
  onDropPanel: (target: DropTarget, panelId?: string) => void;
  onPreviewDrop: (target: DropTarget) => void;
  side: DockSide;
  label?: string;
};

export function PanelDropMarker({
  active,
  enabled,
  index,
  label,
  onDropPanel,
  onPreviewDrop,
  overlay = false,
  side
}: PanelDropMarkerProps) {
  return (
    <PanelDropTarget
      active={active}
      className={overlay
        ? `absolute inset-x-0 -top-2 z-10 flex h-2 items-center ${enabled ? "" : "pointer-events-none"}`
        : "py-1"}
      enabled={enabled}
      index={index}
      label={label ?? `Drop panel ${index} in ${side} docked panels`}
      onDropPanel={onDropPanel}
      onPreviewDrop={onPreviewDrop}
      side={side}
    />
  );
}

type PanelDropTargetProps = PanelDropMarkerProps & {
  className: string;
  label: string;
};

function PanelDropTarget({
  active,
  className,
  enabled,
  index,
  label,
  onDropPanel,
  onPreviewDrop,
  side
}: PanelDropTargetProps) {
  const target = { side, index };

  return (
    <div
      aria-label={label}
      className={className}
      data-panel-drop-index={index}
      data-panel-drop-kind="marker"
      data-panel-drop-side={side}
      onDragOver={(event) => {
        if (!enabled) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        onPreviewDrop(target);
      }}
      onDrop={(event) => {
        if (!enabled) return;
        event.preventDefault();
        event.stopPropagation();
        onDropPanel(target);
      }}
    >
      <div
        aria-hidden={!active}
        className={
          active
            ? "h-1 w-full rounded-full bg-canvas-ink"
            : "h-1 w-full rounded-full bg-transparent"
        }
      />
    </div>
  );
}
