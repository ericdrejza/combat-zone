import type { DragEvent, MouseEvent } from "react";

import { ACTOR_LAYOUT_GROUP_COLORS, ACTOR_SIZE_MULTIPLIERS } from "../../../entities/actor/actorVisuals";
import type { Actor } from "../../../entities/actor/types";
import type { RootState } from "../../../store/store";
import { getReadableTextColor } from "../../canvas/canvasLuminance";

function actorSizeClass(actor: Actor): string {
  const size = ACTOR_SIZE_MULTIPLIERS[actor.size ?? "medium"];

  if (size >= 3) {
    return "h-12 w-12";
  }

  if (size >= 2) {
    return "h-10 w-10";
  }

  if (size < 1) {
    return "h-7 w-7";
  }

  return "h-9 w-9";
}

export function ZonelessActorPanelToken({
  actor,
  activeToolId,
  selectedIds,
  onSelect,
  onDragStart,
  onDragEnd
}: {
  actor: Actor;
  activeToolId: RootState["interaction"]["activeToolId"];
  selectedIds: string[];
  onSelect: (actorId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onDragStart: (actorId: string, event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const selected = selectedIds.includes(actor.id);
  const colors = ACTOR_LAYOUT_GROUP_COLORS[actor.layoutGroup];

  return (
    <button
      aria-label={actor.name}
      className={`group flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs transition hover:bg-canvas ${
        selected ? "bg-canvas ring-2 ring-canvas-ink/30" : ""
      }`}
      draggable={activeToolId === "actor" || activeToolId === "select"}
      onClick={(event) => onSelect(actor.id, event)}
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(actor.id, event)}
      type="button"
    >
      <span
        className={`flex ${actorSizeClass(actor)} items-center justify-center overflow-hidden rounded-full border-2 border-white text-[9px] font-bold shadow-sm ${
          actor.shape === "rectangle" ? "rounded-md" : ""
        }`}
        style={{
          backgroundColor: colors.fill,
          color: getReadableTextColor(colors.fill)
        }}
      >
        {actor.image ? (
          <img alt="" className="h-full w-full object-cover" src={actor.image} />
        ) : (
          actor.name.slice(0, 2).toUpperCase()
        )}
      </span>
      <span
        className="max-w-20 truncate rounded px-1 text-[11px] font-medium"
        style={{
          backgroundColor: colors.fill,
          color: getReadableTextColor(colors.fill)
        }}
      >
        {actor.name}
      </span>
    </button>
  );
}
