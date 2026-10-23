import { useRef, type DragEvent } from "react";
import type { EncounterPanelId, EncounterPanelState } from "@core/encounter/panelLayout";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { getCompactPanelDefinition } from "./compactPanelMetadata";
import { resolvePanelPointerDropTarget, startPanelPointerDrag } from "./panelPointerDrag";
import type { DockSide, DropTarget } from "./PanelsShell";

export type PanelTabDragProps = {
  draggedPanelId: string | null;
  dropTarget: DropTarget | null;
  onDragEnd: () => void;
  onDragStart: (id: string) => void;
  onDropPanel: (target: DropTarget, id?: string) => void;
  onPreviewDrop: (target: DropTarget) => void;
};

type Props = PanelTabDragProps & {
  panels: EncounterPanelState[];
  activePanelId: EncounterPanelId | null;
  collapsed: boolean;
  libraryAvailable: boolean;
  onSelect: (id: EncounterPanelId) => void;
  side: DockSide;
};

/** Footer tabs share the dock's authoritative order and pointer/native drop semantics. */
export function PanelFooterTabs({ panels, activePanelId, collapsed, libraryAvailable,
  onSelect, side, draggedPanelId, dropTarget, onDragStart, onDragEnd, onDropPanel, onPreviewDrop }: Props) {
  const suppressClick = useRef(false);
  function finish() {
    onDragEnd();
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }
  function drop(target: DropTarget, id?: string) {
    onDropPanel(target, id);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }
  function nativeTarget(event: DragEvent): DropTarget {
    return resolvePanelPointerDropTarget(event.clientX, event.clientY, event.target as Element)
      ?? { side, index: panels.length };
  }
  function previewAt(index: number) {
    return draggedPanelId !== null && dropTarget?.side === side && dropTarget.index === index;
  }
  function keyboard(event: React.KeyboardEvent<HTMLButtonElement>) {
    const keys = collapsed ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    if (![...keys, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')!
      .querySelectorAll<HTMLButtonElement>('[role="tab"]:not([aria-disabled="true"])'));
    const index = tabs.indexOf(event.currentTarget);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
      : (index + (event.key === keys[0] ? -1 : 1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
    if (tabs[next]?.getAttribute("aria-selected") !== "true") tabs[next]?.click();
  }
  return <div role="tablist" aria-label={`${side} panel tabs`} aria-orientation={collapsed ? "vertical" : "horizontal"}
    className={`flex min-h-10 min-w-10 gap-2 ${collapsed ? "flex-col items-center" : "w-max min-w-full flex-nowrap justify-center px-1"}`}
    data-panel-drop-kind="tabs" data-panel-drop-side={side} data-panel-drop-index={panels.length}
    onDragOver={event => { if (draggedPanelId) { event.preventDefault(); event.stopPropagation(); onPreviewDrop(nativeTarget(event)); } }}
    onDrop={event => { if (draggedPanelId) { event.preventDefault(); event.stopPropagation(); drop(nativeTarget(event)); } }}>
    {panels.length === 0 && previewAt(0) ? <span aria-hidden="true" className={`pointer-events-none rounded-full bg-canvas-ink ${collapsed ? "h-1 w-10" : "h-10 w-1"}`} /> : null}
    {panels.map((panel, index) => {
      const { Icon, title } = getCompactPanelDefinition(panel.id);
      const unavailable = panel.id === "library" && !libraryAvailable;
      const active = !collapsed && activePanelId === panel.id;
      const label = unavailable ? `${title} panel unavailable for this tool; drag to reorder` : `${active ? "Collapse" : "Show"} ${title} panel; drag to reorder`;
      return <span className="relative inline-flex shrink-0" key={panel.id} role="presentation">
        {previewAt(index) ? <span aria-hidden="true" className={`pointer-events-none absolute rounded-full bg-canvas-ink ${collapsed ? "-top-1 left-0 h-1 w-10" : "-left-1 top-0 h-10 w-1"}`} /> : null}
        <TouchTooltip label={label}><button type="button" role="tab" id={`panel-tab-${panel.id}`}
          aria-label={`${title} panel`} aria-selected={active} aria-disabled={unavailable}
          aria-controls={`panel-tab-content-${panel.id}`} title={label}
          tabIndex={activePanelId === panel.id || (!activePanelId && index === 0) ? 0 : -1}
          className={`flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-full border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-canvas-ink ${
            unavailable ? "cursor-grab border-canvas-line bg-canvas-surface text-canvas-muted opacity-40 hover:border-canvas-muted"
              : active ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink hover:bg-canvas-ink/80"
                : "border-canvas-line bg-canvas-panel text-canvas-muted hover:bg-canvas-surface"
          }`}
          data-panel-drop-kind="tab" data-panel-drop-side={side} data-panel-drop-index={index}
          data-panel-drop-axis={collapsed ? "vertical" : "horizontal"}
          draggable={false} onKeyDown={keyboard}
          onClick={event => { if (suppressClick.current) { suppressClick.current = false; return; } if (!unavailable) { event.currentTarget.focus(); onSelect(panel.id); } }}
          onDragStart={event => { suppressClick.current = true; event.dataTransfer.setData("text/plain", panel.id); onDragStart(panel.id); }}
          onDragEnd={finish}
          onPointerDown={event => startPanelPointerDrag({ event, panelId: panel.id,
            onDragStart: id => { suppressClick.current = true; onDragStart(id); },
            onDragEnd: finish, onDropPanel: drop, onPreviewDrop })}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </button></TouchTooltip>
        {index === panels.length - 1 && previewAt(panels.length) ? <span aria-hidden="true"
          className={`pointer-events-none absolute rounded-full bg-canvas-ink ${collapsed ? "-bottom-1 left-0 h-1 w-10" : "-right-1 top-0 h-10 w-1"}`} /> : null}
      </span>;
    })}
  </div>;
}
