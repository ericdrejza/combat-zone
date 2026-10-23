import { useZonelessActorDropHandlers } from "./zonelessActorDropHandlers";
import { GroupByFactionButton } from "./GroupByFactionButton";
import { useState } from "react";
import { ZonelessActorPanelToken } from "./ZonelessActorPanelToken";
import { SelectAllZonelessButton, ZonelessFactionButton } from "./ZonelessPanelHeader";
import { useZonelessPanelActors } from "./useZonelessPanelActors";

/** Drawer presentation of the authoritative zoneless actor collection. */
export function CompactZonelessActorPanel() {
  const { handleActorCreationDragOverZoneless, handleActorCreationDropToZoneless } = useZonelessActorDropHandlers();
  const [groupByFaction, setGroupByFaction] = useState(true);
  const { zonelessActors, groups, selectedIds, canSelect, selectActors,
    handleSelect, handleDragStart, handleDragEnd, startPointerTransfer } = useZonelessPanelActors();

  function renderActors(actorIds: typeof zonelessActors) {
    return actorIds.map((actor) => (
      <ZonelessActorPanelToken
        actor={actor}
        key={actor.id}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        onPointerDown={startPointerTransfer}
        onSelect={handleSelect}
        selectedIds={selectedIds}
      />
    ));
  }

  return (
    <div className="min-h-full space-y-3" data-drop-target="zoneless-actors"
      onDragOver={handleActorCreationDragOverZoneless} onDrop={handleActorCreationDropToZoneless}>
      <div className="flex items-center gap-2">
        <SelectAllZonelessButton disabled={!canSelect || !zonelessActors.length} onSelect={() => selectActors(zonelessActors)} />
        <GroupByFactionButton grouped={groupByFaction} onChange={setGroupByFaction} />
      </div>
      {zonelessActors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-canvas-line px-3 py-5 text-center text-sm text-canvas-muted">
          Drop actors here to remove them from the canvas.
        </p>
      ) : groupByFaction ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <section aria-label={`${group.label} zoneless actors`} key={group.id}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
                <ZonelessFactionButton group={group} disabled={!canSelect} onSelect={() => selectActors(group.actors)} />
              </h3>
              <div className="flex flex-wrap gap-1">{renderActors(group.actors)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">{renderActors(zonelessActors)}</div>
      )}
    </div>
  );
}
