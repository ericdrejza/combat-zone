import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import { useState, type DragEvent, type ReactNode } from "react";

import {
  createPanelLayoutFromOrder,
  type EncounterPanelId,
  type EncounterPanelOrder
} from "@core/encounter/panelLayout";
import { getDockablePanelDefinition } from "@ui/panels/dockablePanelMetadata";
import { PanelDropMarker } from "@ui/panels/PanelDropMarker";
import { movePanel } from "@ui/panels/panelLayout";
import { startPanelPointerDrag } from "@ui/panels/panelPointerDrag";
import type { DropTarget } from "@ui/panels/PanelsShell";

type PanelOrderSettingsProps = {
  onChange: (order: EncounterPanelOrder) => void;
  order: EncounterPanelOrder;
  getReorderDisabledReason?: (panelId: string) => string | undefined;
  renderPanelControl?: (panelId: EncounterPanelId) => ReactNode;
};

/** Edits the panel layout copied into newly created encounters. */
export function PanelOrderSettings({ onChange, order, renderPanelControl, getReorderDisabledReason }: PanelOrderSettingsProps) {
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  function endDrag() {
    setDraggedPanelId(null);
    setDropTarget(null);
  }

  function dropPanel(target: DropTarget, panelId = draggedPanelId ?? undefined) {
    if (panelId && !getReorderDisabledReason?.(panelId)) {
      const next = movePanel(createPanelLayoutFromOrder(order), panelId, target);
      onChange({
        left: next.left.map((panel) => panel.id),
        right: next.right.map((panel) => panel.id)
      });
    }
    endDrag();
  }

  function acceptDrag(event: DragEvent) {
    if (!draggedPanelId) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    return true;
  }

  function renderMarker(target: DropTarget) {
    return <PanelDropMarker
      active={draggedPanelId !== null && dropTarget?.side === target.side && dropTarget.index === target.index}
      enabled={draggedPanelId !== null}
      index={target.index}
      label={`Drop panel ${target.index} in default ${target.side} panel order`}
      onDropPanel={dropPanel}
      onPreviewDrop={setDropTarget}
      side={target.side}
    />;
  }

  return <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" data-panel-order-preview>
    {(["left", "right"] as const).map((side) => {
      const endTarget = { side, index: order[side].length };
      return <section className="min-w-0 rounded-2xl border border-canvas-line bg-canvas p-2" key={side}>
        <h6 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">{side}</h6>
        <motion.ol
          aria-label={`Default ${side} panel order`}
          className="min-h-24"
          data-panel-drop-index={order[side].length}
          data-panel-drop-kind="dock"
          data-panel-drop-side={side}
          layout="position"
          onDragOver={(event) => {
            if (acceptDrag(event)) setDropTarget(endTarget);
          }}
          onDrop={(event) => {
            if (acceptDrag(event)) dropPanel(endTarget);
          }}
        >
          {order[side].map((panelId, index) => {
            const panel = getDockablePanelDefinition(panelId);
            const disabledReason = getReorderDisabledReason?.(panelId);
            const tooltip = disabledReason ?? `Reorder ${panel.title} panel`;
            function rowTarget(event: DragEvent): DropTarget {
              const bounds = event.currentTarget.getBoundingClientRect();
              return { side, index: event.clientY > bounds.top + bounds.height / 2 ? index + 1 : index };
            }
            return <motion.li key={panelId} layout="position" transition={{ duration: 0.16, ease: "easeOut" }}>
              {renderMarker({ side, index })}
              <div
                className="flex items-center gap-2"
                data-panel-drop-index={index}
                data-panel-drop-kind="panel"
                data-panel-drop-side={side}
                onDragOver={(event) => {
                  if (acceptDrag(event)) setDropTarget(rowTarget(event));
                }}
                onDrop={(event) => {
                  if (acceptDrag(event)) dropPanel(rowTarget(event));
                }}
              >
                <div className="min-w-0 flex-1 [&>span[data-touch-tooltip-label]]:w-full"><TouchTooltip label={tooltip}><button
                  title={tooltip}
                  aria-label={`Reorder ${panel.title} panel`}
                  className="flex w-full min-w-0 touch-none enabled:cursor-grab items-center gap-1 rounded-xl border border-canvas-line bg-canvas-surface px-2 py-2 text-left shadow-sm transition enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink enabled:active:cursor-grabbing disabled:cursor-not-allowed disabled:bg-canvas disabled:text-canvas-muted disabled:opacity-50"
                  disabled={Boolean(disabledReason)}
                  draggable={false}
                  onDragEnd={endDrag}
                  onDragStart={(event) => {
                    if (disabledReason) { event.preventDefault(); return; }
                    setDraggedPanelId(panelId);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", panelId);
                  }}
                  onPointerDown={(event) => !disabledReason && startPanelPointerDrag({
                    event,
                    onDragEnd: endDrag,
                    onDragStart: setDraggedPanelId,
                    onDropPanel: dropPanel,
                    onPreviewDrop: setDropTarget,
                    panelId
                  })}
                  type="button"
                >
                  <GripVertical aria-hidden="true" className="h-4 w-4 shrink-0 text-canvas-muted" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{panel.title}</span>
                </button></TouchTooltip></div>
                {renderPanelControl?.(panelId)}
              </div>
            </motion.li>;
          })}
          <li role="presentation">{renderMarker(endTarget)}</li>
        </motion.ol>
      </section>;
    })}
  </div>;
}
