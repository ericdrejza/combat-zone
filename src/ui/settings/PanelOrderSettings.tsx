import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical
} from "lucide-react";
import { motion } from "motion/react";
import { useState, type DragEvent } from "react";

import type {
  EncounterDockSide,
  EncounterPanelId,
  EncounterPanelOrder
} from "@core/encounter/panelLayout";
import { getDockablePanelDefinition } from "@ui/panels/dockablePanelMetadata";

type PanelOrderSettingsProps = {
  onChange: (order: EncounterPanelOrder) => void;
  order: EncounterPanelOrder;
};

function movePanel(
  order: EncounterPanelOrder,
  panelId: EncounterPanelId,
  targetSide: EncounterDockSide,
  targetIndex: number
): EncounterPanelOrder {
  const next = {
    left: order.left.filter((id) => id !== panelId),
    right: order.right.filter((id) => id !== panelId)
  };
  next[targetSide].splice(Math.max(0, Math.min(targetIndex, next[targetSide].length)), 0, panelId);
  return next;
}

function moveBefore(
  order: EncounterPanelOrder,
  panelId: EncounterPanelId,
  targetSide: EncounterDockSide,
  targetId: EncounterPanelId
) {
  const withoutPanel = order[targetSide].filter((id) => id !== panelId);
  return movePanel(order, panelId, targetSide, withoutPanel.indexOf(targetId));
}

/** Edits the panel layout copied into newly created encounters. */
export function PanelOrderSettings({ onChange, order }: PanelOrderSettingsProps) {
  const [draggedPanelId, setDraggedPanelId] = useState<EncounterPanelId | null>(null);

  function readDraggedPanel(event: DragEvent): EncounterPanelId | null {
    return draggedPanelId ?? (event.dataTransfer.getData("text/plain") as EncounterPanelId || null);
  }

  return <div className="grid grid-cols-2 gap-3" data-panel-order-preview>
    {(["left", "right"] as const).map((side) => (
      <section className="min-w-0 rounded-2xl border border-canvas-line bg-canvas p-2" key={side}>
        <h6 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">{side}</h6>
        <motion.ol
          aria-label={`Default ${side} panel order`}
          className="min-h-24 space-y-2"
          layout="position"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const panelId = readDraggedPanel(event);
            if (panelId) onChange(movePanel(order, panelId, side, order[side].length));
            setDraggedPanelId(null);
          }}
        >
          {order[side].map((panelId, index) => {
            const panel = getDockablePanelDefinition(panelId);
            const otherSide = side === "left" ? "right" : "left";
            return <motion.li
              className="flex min-w-0 items-center gap-1 rounded-xl border border-canvas-line bg-canvas-surface px-2 py-2 shadow-sm"
              draggable
              key={panelId}
              layout="position"
              onDragEnd={() => setDraggedPanelId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={(event) => {
                const dragEvent = event as unknown as DragEvent<HTMLLIElement>;
                setDraggedPanelId(panelId);
                dragEvent.dataTransfer.effectAllowed = "move";
                dragEvent.dataTransfer.setData("text/plain", panelId);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const draggedId = readDraggedPanel(event);
                if (draggedId && draggedId !== panelId) onChange(moveBefore(order, draggedId, side, panelId));
                setDraggedPanelId(null);
              }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <GripVertical aria-hidden="true" className="h-4 w-4 shrink-0 cursor-grab text-canvas-muted" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{panel.title}</span>
              <button aria-label={`Move ${panel.title} up`} className="rounded-md p-1 text-canvas-muted hover:bg-canvas disabled:opacity-30" disabled={index === 0} onClick={() => onChange(movePanel(order, panelId, side, index - 1))} title="Move up" type="button"><ChevronUp aria-hidden="true" className="h-3.5 w-3.5" /></button>
              <button aria-label={`Move ${panel.title} down`} className="rounded-md p-1 text-canvas-muted hover:bg-canvas disabled:opacity-30" disabled={index === order[side].length - 1} onClick={() => onChange(movePanel(order, panelId, side, index + 1))} title="Move down" type="button"><ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /></button>
              <button aria-label={`Move ${panel.title} to ${otherSide}`} className="rounded-md p-1 text-canvas-muted hover:bg-canvas" onClick={() => onChange(movePanel(order, panelId, otherSide, order[otherSide].length))} title={`Move to ${otherSide}`} type="button">{side === "left" ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />}</button>
            </motion.li>;
          })}
        </motion.ol>
      </section>
    ))}
  </div>;
}
