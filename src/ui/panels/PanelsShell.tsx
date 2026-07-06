import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

export type DockSide = "left" | "right";

export type DockPanelDefinition = {
  collapsed: boolean;
  id: string;
  title: string;
  description?: string;
};

export type DropTarget = {
  side: DockSide;
  index: number;
};

type PanelsShellProps = {
  draggedPanelId: string | null;
  dropTarget: DropTarget | null;
  onDragEnd: () => void;
  onDragStart: (panelId: string) => void;
  onPanelCollapsedChange: (panelId: string, collapsed: boolean) => void;
  onDropPanel: (target: DropTarget) => void;
  onPreviewDrop: (target: DropTarget) => void;
  panels: DockPanelDefinition[];
  side: DockSide;
};

export function PanelsShell({
  draggedPanelId,
  dropTarget,
  onDragEnd,
  onDragStart,
  onPanelCollapsedChange,
  onDropPanel,
  onPreviewDrop,
  panels,
  side
}: PanelsShellProps) {
  const dockEndTarget = { side, index: panels.length };

  return (
    <aside
      aria-label={`${side} docked panels`}
      className="space-y-2"
      onDragOver={(event) => {
        if (!draggedPanelId) {
          return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        onPreviewDrop(dockEndTarget);
      }}
      onDrop={(event) => {
        if (!draggedPanelId) {
          return;
        }

        event.preventDefault();
        onDropPanel(dockEndTarget);
      }}
    >
      {panels.map((panel, index) => (
        <div key={panel.id}>
          <PanelDropMarker
            active={
              dropTarget?.side === side &&
              dropTarget.index === index &&
              draggedPanelId !== null
            }
            index={index}
            onDropPanel={onDropPanel}
            onPreviewDrop={onPreviewDrop}
            side={side}
          />
          <DockPanel
            index={index}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onPanelCollapsedChange={onPanelCollapsedChange}
            onDropPanel={onDropPanel}
            onPreviewDrop={onPreviewDrop}
            panel={panel}
            side={side}
          />
        </div>
      ))}
      <PanelDropMarker
        active={
          dropTarget?.side === side &&
          dropTarget.index === panels.length &&
          draggedPanelId !== null
        }
        index={panels.length}
        onDropPanel={onDropPanel}
        onPreviewDrop={onPreviewDrop}
        side={side}
      />
    </aside>
  );
}

type DockPanelProps = {
  index: number;
  onDragEnd: () => void;
  onDragStart: (panelId: string) => void;
  onPanelCollapsedChange: (panelId: string, collapsed: boolean) => void;
  onDropPanel: (target: DropTarget) => void;
  onPreviewDrop: (target: DropTarget) => void;
  panel: DockPanelDefinition;
  side: DockSide;
};

function DockPanel({
  index,
  onDragEnd,
  onDragStart,
  onPanelCollapsedChange,
  onDropPanel,
  onPreviewDrop,
  panel,
  side
}: DockPanelProps) {
  function getPanelDropTarget(event: React.DragEvent<HTMLElement>): DropTarget {
    const panelBounds = event.currentTarget.getBoundingClientRect();
    const dropAfterPanel = event.clientY > panelBounds.top + panelBounds.height / 2;

    return {
      side,
      index: dropAfterPanel ? index + 1 : index
    };
  }

  return (
    <section
      aria-label={`${panel.title} panel`}
      className="rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm"
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        onPreviewDrop(getPanelDropTarget(event));
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropPanel(getPanelDropTarget(event));
      }}
    >
      <header className="flex items-center justify-between gap-3 p-4">
        <h2 className="font-display text-lg font-semibold">{panel.title}</h2>
        <div className="flex items-center gap-2">
          <button
            aria-label={`Reorder ${panel.title} panel`}
            className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-muted transition hover:bg-canvas active:cursor-grabbing"
            draggable
            onDragEnd={onDragEnd}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", panel.id);
              onDragStart(panel.id);
            }}
            type="button"
          >
            <GripVertical aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-expanded={!panel.collapsed}
            aria-label={
              panel.collapsed
                ? `Expand ${panel.title} panel`
                : `Collapse ${panel.title} panel`
            }
            className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-muted transition hover:bg-canvas"
            onClick={() =>
              onPanelCollapsedChange(panel.id, !panel.collapsed)
            }
            type="button"
          >
            {panel.collapsed ? (
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>
      {!panel.collapsed ? (
        <div className="border-t border-canvas-line px-4 pb-4 pt-3">
          <p className="text-sm text-canvas-muted">
            {panel.description ??
              "Panel scaffold. Feature-specific controls will be added as roadmap tickets are implemented."}
          </p>
        </div>
      ) : null}
    </section>
  );
}

type PanelDropMarkerProps = {
  active: boolean;
  index: number;
  onDropPanel: (target: DropTarget) => void;
  onPreviewDrop: (target: DropTarget) => void;
  side: DockSide;
};

function PanelDropMarker({
  active,
  index,
  onDropPanel,
  onPreviewDrop,
  side
}: PanelDropMarkerProps) {
  const target = { side, index };

  return (
    <div
      aria-label={`Drop panel ${index} in ${side} docked panels`}
      className="py-1"
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        onPreviewDrop(target);
      }}
      onDrop={(event) => {
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
