import type { DockSide, DropTarget } from "./PanelsShell";

type PanelDropMarkerProps = {
  active: boolean;
  enabled: boolean;
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
  side
}: PanelDropMarkerProps) {
  return (
    <PanelDropTarget
      active={active}
      className="py-1"
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
            ? "h-1 rounded-full bg-canvas-ink"
            : "h-1 rounded-full bg-transparent"
        }
      />
    </div>
  );
}
