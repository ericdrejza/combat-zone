import type { DragEvent, MouseEvent } from "react";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, UsersRound } from "lucide-react";

import { ZONELESS_ACTOR_ZONE_ID } from "../../core/encounter/types";
import { ACTOR_LAYOUT_GROUP_COLORS, ACTOR_SIZE_MULTIPLIERS } from "../../entities/actor/actorVisuals";
import type { Actor, ActorLayoutGroup } from "../../entities/actor/types";
import { selectEntity } from "../../interaction/interactionState";
import { useDispatch } from "react-redux";
import type { RootState } from "../../store/store";
import { ZONELESS_ACTOR_DRAG_TYPE } from "./zonelessActorDrag";

type ZonelessActorPanelProps = {
  activeToolId: RootState["interaction"]["activeToolId"];
  actors: RootState["encounter"]["present"]["actors"];
  selection: RootState["interaction"]["selection"];
};

type ActorGroup = {
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

function getZonelessActors(
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

function getGroupedActors(actors: Actor[]): ActorGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    actors: actors.filter((actor) => actor.layoutGroup === group.id)
  })).filter((group) => group.actors.length > 0);
}

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

function ActorPanelToken({
  actor,
  activeToolId,
  selectedIds,
  onSelect,
  onDragStart
}: {
  actor: Actor;
  activeToolId: ZonelessActorPanelProps["activeToolId"];
  selectedIds: string[];
  onSelect: (actorId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onDragStart: (actorId: string, event: DragEvent<HTMLButtonElement>) => void;
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
      onDragStart={(event) => onDragStart(actor.id, event)}
      type="button"
    >
      <span
        className={`flex ${actorSizeClass(actor)} items-center justify-center overflow-hidden rounded-full border-2 border-white text-[9px] font-bold text-white shadow-sm ${
          actor.shape === "rectangle" ? "rounded-md" : ""
        }`}
        style={{ backgroundColor: colors.fill }}
      >
        {actor.image ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            src={actor.image}
          />
        ) : (
          actor.name.slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="max-w-20 truncate text-canvas-ink">{actor.name}</span>
    </button>
  );
}

export function ZonelessActorPanel({
  activeToolId,
  actors,
  selection
}: ZonelessActorPanelProps) {
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);
  const [groupByFaction, setGroupByFaction] = useState(true);
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

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ZONELESS_ACTOR_DRAG_TYPE, actorIds.join(","));
  }

  if (zonelessActors.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Zoneless actors"
      className="absolute bottom-3 left-1/2 z-20 w-[min(44rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-canvas-line bg-canvas-panel/95 p-2 shadow-lg backdrop-blur"
    >
      <div className="flex items-center gap-2">
        {expanded ? (
          <label className="flex items-center gap-2 text-xs text-canvas-muted">
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <UsersRound aria-hidden="true" size={16} />
          <span className="truncate text-sm font-semibold">Zoneless</span>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-canvas-muted">
            {zonelessActors.length}
          </span>
        </div>
        <button
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse zoneless actors" : "Expand zoneless actors"}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-ink transition hover:bg-canvas"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 max-h-48 overflow-y-auto border-t border-canvas-line pt-2">
          {groupByFaction ? (
            <div className="flex gap-10">
              {groupedActors.map((group) => (
                <section className="border-x" aria-label={`${group.label} zoneless actors`} key={group.id}>
                  <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wide text-canvas-muted">
                    {group.label}
                  </h3>
                  <div className="flex flex-row flex-wrap gap-1">
                    {group.actors.map((actor) => (
                      <ActorPanelToken
                        actor={actor}
                        activeToolId={activeToolId}
                        key={actor.id}
                        onDragStart={handleDragStart}
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
                <ActorPanelToken
                  actor={actor}
                  activeToolId={activeToolId}
                  key={actor.id}
                  onDragStart={handleDragStart}
                  onSelect={handleSelect}
                  selectedIds={selectedIds}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
