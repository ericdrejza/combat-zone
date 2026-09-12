import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import type {
  EncounterDockSide,
  EncounterPanelState
} from "@core/encounter/panelLayout";
import { getDockablePanelDefinition } from "./dockablePanelMetadata";
import { startPanelPointerDrag } from "./panelPointerDrag";

export type DockSide = EncounterDockSide;

export type DockPanelDefinition = EncounterPanelState & {
  description?: string;
  title: string;
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
  onDropPanel: (target: DropTarget, panelId?: string) => void;
  onPreviewDrop: (target: DropTarget) => void;
  panels: EncounterPanelState[];
  renderPanelHeaderActions?: (panel: DockPanelDefinition) => ReactNode;
  renderPanelContent?: (panel: DockPanelDefinition) => ReactNode;
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
  renderPanelHeaderActions,
  renderPanelContent,
  side
}: PanelsShellProps) {
  const dockEndTarget = { side, index: panels.length };

  return (
    <aside
      aria-label={`${side} docked panels`}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1"
      data-panel-drop-index={panels.length}
      data-panel-drop-kind="dock"
      data-panel-drop-side={side}
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
      {panels.map((panel, index) => {
        const stretch = panels.length === 1 && !panel.collapsed;
        const definition = getDockablePanelDefinition(panel.id);
        return (
        <div
          className={stretch ? "flex min-h-0 flex-1 flex-col" : undefined}
          key={panel.id}
        >
          <PanelDropMarker
            active={
              dropTarget?.side === side &&
              dropTarget.index === index &&
              draggedPanelId !== null
            }
            enabled={draggedPanelId !== null}
            index={index}
            onDropPanel={onDropPanel}
            onPreviewDrop={onPreviewDrop}
            side={side}
          />
          <DockPanel
            draggedPanelId={draggedPanelId}
            index={index}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onPanelCollapsedChange={onPanelCollapsedChange}
            onDropPanel={onDropPanel}
            onPreviewDrop={onPreviewDrop}
            panel={{ ...panel, ...definition }}
            renderPanelHeaderActions={renderPanelHeaderActions}
            renderPanelContent={renderPanelContent}
            side={side}
            stretch={stretch}
          />
        </div>
        );
      })}
      <PanelDropMarker
        active={
          dropTarget?.side === side &&
          dropTarget.index === panels.length &&
          draggedPanelId !== null
        }
        enabled={draggedPanelId !== null}
        index={panels.length}
        onDropPanel={onDropPanel}
        onPreviewDrop={onPreviewDrop}
        side={side}
      />
    </aside>
  );
}

type DockPanelProps = {
  draggedPanelId: string | null;
  index: number;
  onDragEnd: () => void;
  onDragStart: (panelId: string) => void;
  onPanelCollapsedChange: (panelId: string, collapsed: boolean) => void;
  onDropPanel: (target: DropTarget, panelId?: string) => void;
  onPreviewDrop: (target: DropTarget) => void;
  panel: DockPanelDefinition;
  renderPanelHeaderActions?: (panel: DockPanelDefinition) => ReactNode;
  renderPanelContent?: (panel: DockPanelDefinition) => ReactNode;
  side: DockSide;
  stretch: boolean;
};

function DockPanel({
  draggedPanelId,
  index,
  onDragEnd,
  onDragStart,
  onPanelCollapsedChange,
  onDropPanel,
  onPreviewDrop,
  panel,
  renderPanelHeaderActions,
  renderPanelContent,
  side,
  stretch
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
      className={`rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm ${
        stretch ? "flex min-h-0 flex-1 flex-col" : ""
      }`}
      data-panel-drop-index={index}
      data-panel-drop-kind="panel"
      data-panel-drop-side={side}
      data-panel-stretch={stretch || undefined}
      onDragOver={(event) => {
        if (!draggedPanelId) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        onPreviewDrop(getPanelDropTarget(event));
      }}
      onDrop={(event) => {
        if (!draggedPanelId) return;
        event.preventDefault();
        event.stopPropagation();
        onDropPanel(getPanelDropTarget(event));
      }}
    >
      <header className="flex items-center justify-between gap-3 p-4">
        <h2 className="font-display text-lg font-semibold">{panel.title}</h2>
        <div className="flex items-center gap-2">
          {renderPanelHeaderActions?.(panel)}
          <button
            aria-label={`Reorder ${panel.title} panel`}
            className="flex h-8 w-8 touch-none cursor-grab items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas active:cursor-grabbing"
            draggable={false}
            onDragEnd={onDragEnd}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", panel.id);
              onDragStart(panel.id);
            }}
            onPointerDown={(event) =>
              startPanelPointerDrag({
                event,
                onDragEnd,
                onDragStart,
                onDropPanel,
                onPreviewDrop,
                panelId: panel.id
              })
            }
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
            className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas"
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
        <div className={`border-t border-canvas-line px-4 pb-4 pt-3 ${
          stretch ? "min-h-0 flex-1 overflow-y-auto" : ""
        }`}>
          {renderPanelContent?.(panel) ?? (
            <p className="text-sm text-canvas-muted">
              {panel.description ??
                "Panel scaffold. Feature-specific controls will be added as roadmap tickets are implemented."}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

type PanelDropMarkerProps = {
  active: boolean;
  enabled: boolean;
  index: number;
  onDropPanel: (target: DropTarget, panelId?: string) => void;
  onPreviewDrop: (target: DropTarget) => void;
  side: DockSide;
};

function PanelDropMarker({
  active,
  enabled,
  index,
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
      label={`Drop panel ${index} in ${side} docked panels`}
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
