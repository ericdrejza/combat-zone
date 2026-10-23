import { useState } from "react";
import { ZonelessActorPanelToken } from "./ZonelessActorPanelToken";
import { SelectAllZonelessButton, ZonelessFactionButton } from "./ZonelessPanelHeader";
import { useZonelessPanelActors } from "./useZonelessPanelActors";

/** Drawer presentation of the authoritative zoneless actor collection. */
export function CompactZonelessActorPanel() {
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
    <div className="space-y-3" data-drop-target="zoneless-actors">
      <SelectAllZonelessButton disabled={!canSelect || !zonelessActors.length} onSelect={() => selectActors(zonelessActors)} />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          aria-label="Group by faction"
          checked={groupByFaction}
          className="h-5 w-5 accent-canvas-ink"
          onChange={(event) => setGroupByFaction(event.target.checked)}
          type="checkbox"
        />
        Group by faction
      </label>
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
