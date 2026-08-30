import type { DragEvent, MouseEvent, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  UsersRound
} from "lucide-react";

import { setActorDragImage } from "@core/rendering/actorDragPreview";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { Actor, ActorLayoutGroup } from "@entities/actor/types";
import { selectEntity } from "@interaction/interactionState";
import { useDispatch } from "react-redux";
import type { RootState } from "@store/store";
import { getTextColorForLuminance } from "../../canvas/canvasLuminance";
import {
  getZonelessActorTextPayload,
  ZONELESS_ACTOR_DRAG_TYPE
} from "./zonelessActorDrag";
import { useResizablePanel } from "../../canvas/useResizablePanel";
import { ZonelessActorPanelToken } from "./ZonelessActorPanelToken";
import { armCompactCanvasTransfer } from "@ui/canvas/compactCanvasTransfer";

type ZonelessActorPanelProps = {
  activeToolId: RootState["interaction"]["activeToolId"];
  actors: RootState["encounter"]["present"]["actors"];
  canvasBackgroundLuminance: number;
  isActorDragActive: boolean;
  onActorCreationDragOver: (event: DragEvent<HTMLElement>) => void;
  onActorCreationDrop: (event: DragEvent<HTMLElement>) => void;
  selection: RootState["interaction"]["selection"];
};

export type ActorGroup = {
  id: ActorLayoutGroup;
  label: string;
  actors: Actor[];
};

const GROUPS: Array<{ id: ActorLayoutGroup; label: string }> = [
  { id: "hero", label: "Hero" },
  { id: "neutral", label: "Neutral" },
  { id: "enemy", label: "Enemy" }
];

function sortActors(actors: Actor[]): Actor[] {
  return [...actors].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);

    return nameOrder || left.id.localeCompare(right.id);
  });
}

export function getZonelessActors(
  actors: ZonelessActorPanelProps["actors"]
): Actor[] {
  return sortActors(
    actors.allIds
      .map((actorId) => actors.byId[actorId])
      .filter(
        (actor): actor is Actor =>
          actor?.currentZoneId === ZONELESS_ACTOR_ZONE_ID
      )
  );
}

export function getGroupedActors(actors: Actor[]): ActorGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    actors: actors.filter((actor) => actor.layoutGroup === group.id)
  })).filter((group) => group.actors.length > 0);
}

export function ZonelessActorPanel({
  activeToolId,
  actors,
  canvasBackgroundLuminance,
  isActorDragActive,
  onActorCreationDragOver,
  onActorCreationDrop,
  selection
}: ZonelessActorPanelProps) {
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);
  const [groupByFaction, setGroupByFaction] = useState(true);
  const dragPreviewCleanupRef = useRef<(() => void) | null>(null);
  const {
    isResized,
    isResizing,
    resetSize,
    size,
    startResize
  } = useResizablePanel();
  const zonelessActors = useMemo(() => getZonelessActors(actors), [actors]);
  const groupedActors = useMemo(
    () => getGroupedActors(zonelessActors),
    [zonelessActors]
  );
  const selectedIds =
    selection.selectedEntityType === "actor" ? selection.selectedIds : [];
  const selectedZonelessIds = selectedIds.filter((actorId) =>
    zonelessActors.some((actor) => actor.id === actorId)
  );
  const contrastColor = getTextColorForLuminance(canvasBackgroundLuminance);

  useEffect(() => {
    return () => dragPreviewCleanupRef.current?.();
  }, []);

  function handleSelect(
    actorId: string,
    event: MouseEvent<HTMLButtonElement>
  ) {
    if (activeToolId !== "actor" && activeToolId !== "select") {
      return;
    }

    dispatch(
      selectEntity({
        entityType: "actor",
        ids: [actorId],
        toggle: event.shiftKey || event.ctrlKey || event.metaKey
      })
    );
  }

  function handleDragStart(
    actorId: string,
    event: DragEvent<HTMLButtonElement>
  ) {
    if (activeToolId !== "actor" && activeToolId !== "select") {
      event.preventDefault();
      return;
    }

    const actorIds = selectedZonelessIds.includes(actorId)
      ? selectedZonelessIds
      : [actorId];

    const actor = zonelessActors.find((candidate) => candidate.id === actorId);

    if (actor) {
      dragPreviewCleanupRef.current?.();
      dragPreviewCleanupRef.current = setActorDragImage(event.dataTransfer, {
        image: actor.image,
        layoutGroup: actor.layoutGroup,
        name: actor.name,
        shape: actor.shape,
        size: actor.size
      });
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ZONELESS_ACTOR_DRAG_TYPE, actorIds.join(","));
    // Keep a standard fallback for browsers that omit custom MIME types while
    // exposing the drag over the canvas.
    event.dataTransfer.setData(
      "text/plain",
      getZonelessActorTextPayload(actorIds)
    );
  }

  function handleDragEnd() {
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = null;
  }

  function startPointerTransfer(
    actorId: string,
    event: PointerEvent<HTMLButtonElement>
  ) {
    const actorIds = selectedZonelessIds.includes(actorId)
      ? selectedZonelessIds
      : [actorId];
    const actor = zonelessActors.find((candidate) => candidate.id === actorId);

    if (!actor) {
      return;
    }

    armCompactCanvasTransfer(
      event.nativeEvent,
      { actor, actorIds, kind: "zoneless-actors" },
      undefined,
      "all"
    );
  }

  return (
    <aside
      aria-label="Zoneless actors"
      className={`min-w-min absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col overflow-hidden border p-2 ${
        expanded
          ? "rounded-2xl border-canvas-line bg-canvas-panel/10 shadow-lg backdrop-blur"
          : "rounded-lg bg-transparent"
      } ${
        isActorDragActive ? "border-canvas-ink ring-2 ring-canvas-ink/20" : ""
      } ${isResizing ? "select-none" : ""}`}
      data-drop-target="zoneless-actors"
      onDragOver={onActorCreationDragOver}
      onDrop={onActorCreationDrop}
      style={{
        height: expanded ? `${size.height}px` : undefined,
        maxWidth: "calc(100% - 1.5rem)",
        borderColor: contrastColor,
        color: contrastColor,
        width: `${size.width}px`
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex items-center gap-2">
            <UsersRound aria-hidden="true" size={16} />
            <span className="truncate text-sm font-semibold">Zoneless</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                expanded ? "bg-canvas text-canvas-muted" : ""
              }`}
              style={expanded 
                ? {} 
                : {
                  color: contrastColor,
                  outline: `1px solid ${contrastColor}`
                }
              }
              >
              {zonelessActors.length}
            </span>
          </div>
          {expanded ? (
          <label className="flex items-center gap-2 text-xs">
            <input
              aria-label="Group by faction"
              checked={groupByFaction}
              className="h-4 w-4 accent-canvas-ink"
              onChange={(event) => setGroupByFaction(event.target.checked)}
              type="checkbox"
            />
            Group by faction
          </label>
        ) : null}
        </div>
        {isResized ? (
          <button
            aria-label="Reset zoneless actors panel size"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-ink transition hover:bg-canvas"
            onClick={resetSize}
            title="Reset panel size"
            type="button"
          >
            <RotateCcw aria-hidden="true" size={15} />
          </button>
        ) : null}
        <button
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse zoneless actors" : "Expand zoneless actors"}
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border transition hover:bg-canvas ${
            expanded
              ? "border-canvas-line bg-white text-canvas-ink"
              : "border-current bg-transparent text-inherit"
          }`}
          onClick={() => setExpanded((current) => !current)}
          style={expanded ? undefined : { borderColor: contrastColor }}
          type="button"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-canvas-line pt-2" style={{borderColor: contrastColor}}>
          {zonelessActors.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-canvas-muted">
              Drop actors here to remove them from the canvas.
            </p>
          ) : groupByFaction ? (
            <div className="flex gap-4">
              {groupedActors.map((group) => (
                <section className="border-x" aria-label={`${group.label} zoneless actors`} key={group.id}
                  style={{borderColor: contrastColor}}
                >
                  <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wide">
                    {group.label}
                  </h3>
                  <div className="flex flex-row flex-wrap p-2 gap-1">
                    {group.actors.map((actor) => (
                      <ZonelessActorPanelToken
                        actor={actor}
                        key={actor.id}
                        onDragEnd={handleDragEnd}
                        onDragStart={handleDragStart}
                        onPointerDown={startPointerTransfer}
                        onSelect={handleSelect}
                        selectedIds={selectedIds}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {zonelessActors.map((actor) => (
                <ZonelessActorPanelToken
                  actor={actor}
                  key={actor.id}
                  onDragEnd={handleDragEnd}
                  onDragStart={handleDragStart}
                  onPointerDown={startPointerTransfer}
                  onSelect={handleSelect}
                  selectedIds={selectedIds}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
      {expanded ? (
        <>
          <button
            aria-label="Resize zoneless actors panel left edge"
            className="absolute bottom-2 left-0 top-2 w-2 cursor-ew-resize"
            onMouseDown={(event) => startResize(event, "left")}
            type="button"
          />
          <button
            aria-label="Resize zoneless actors panel right edge"
            className="absolute bottom-2 right-0 top-2 w-2 cursor-ew-resize"
            onMouseDown={(event) => startResize(event, "right")}
            type="button"
          />
          <button
            aria-label="Resize zoneless actors panel top edge"
            className="absolute left-2 right-2 top-0 h-2 cursor-ns-resize"
            onMouseDown={(event) => startResize(event, "top")}
            type="button"
          />
        </>
      ) : null}
    </aside>
  );
}
