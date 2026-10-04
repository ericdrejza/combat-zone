import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import { useState, type DragEvent } from "react";

import {
  createPanelLayoutFromOrder,
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
};

/** Edits the panel layout copied into newly created encounters. */
export function PanelOrderSettings({ onChange, order }: PanelOrderSettingsProps) {
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  function endDrag() {
    setDraggedPanelId(null);
    setDropTarget(null);
  }

  function dropPanel(target: DropTarget, panelId = draggedPanelId ?? undefined) {
    if (panelId) {
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

  return <div className="grid grid-cols-2 gap-3" data-panel-order-preview>
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
            function rowTarget(event: DragEvent): DropTarget {
              const bounds = event.currentTarget.getBoundingClientRect();
              return { side, index: event.clientY > bounds.top + bounds.height / 2 ? index + 1 : index };
            }
            return <motion.li key={panelId} layout="position" transition={{ duration: 0.16, ease: "easeOut" }}>
              {renderMarker({ side, index })}
              <div
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
                <button
                  aria-label={`Reorder ${panel.title} panel`}
                  className="flex w-full min-w-0 touch-none cursor-grab items-center gap-1 rounded-xl border border-canvas-line bg-canvas-surface px-2 py-2 text-left shadow-sm active:cursor-grabbing"
                  draggable={false}
                  onDragEnd={endDrag}
                  onDragStart={(event) => {
                    setDraggedPanelId(panelId);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", panelId);
                  }}
                  onPointerDown={(event) => startPanelPointerDrag({
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
                </button>
              </div>
            </motion.li>;
          })}
          <li role="presentation">{renderMarker(endTarget)}</li>
        </motion.ol>
      </section>;
    })}
  </div>;
}
