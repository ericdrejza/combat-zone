import { useDispatch, useSelector } from "react-redux";

import type {
  ActorLayoutGroup,
  ActorShape,
  ActorSize,
  ActorType
} from "../../entities/actor/types";
import { updateActorProperties } from "../../entities/actor/actorMutations";
import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import { commitEncounterChange } from "../../store/encounterSlice";
import type { RootState } from "../../store/store";

const ACTOR_TYPES: ActorType[] = [
  "creature",
  "object",
  "objective",
  "pointOfInterest"
];
const LAYOUT_GROUPS: ActorLayoutGroup[] = ["hero", "neutral", "enemy"];
const ACTOR_SHAPES: ActorShape[] = ["circle", "rectangle"];
const ACTOR_SIZES: ActorSize[] = ["small", "medium", "large", "xLarge"];

export function ActorPropertiesPanel() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const selectedActorId =
    selection.selectedEntityType === "actor" ? selection.selectedIds[0] : undefined;
  const actor = selectedActorId ? encounter.actors.byId[selectedActorId] : undefined;

  if (!actor) {
    return (
      <p className="text-sm text-canvas-muted">
        Select an actor to edit its name, type, faction, image, and size.
      </p>
    );
  }

  function commitActorProperties(
    properties: Parameters<typeof updateActorProperties>[2]
  ) {
    if (!actor) {
      return;
    }

    const nextEncounter = updateActorProperties(
      encounter,
      actor.id,
      properties
    );

    if (nextEncounter === encounter) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("actor.updateProperties", {
          actorId: actor.id,
          properties
        }),
        nextEncounter
      })
    );
  }

  return (
    <div key={actor.id} className="space-y-4 text-sm">
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Name</span>
        <input
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 text-canvas-ink"
          onBlur={(event) =>
            commitActorProperties({ name: event.currentTarget.value.trim() })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          type="text"
          defaultValue={actor.name}
        />
      </label>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Type</span>
        <select
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 text-canvas-ink"
          onChange={(event) =>
            commitActorProperties({ actorType: event.currentTarget.value as ActorType })
          }
          value={actor.actorType}
        >
          {ACTOR_TYPES.map((actorType) => (
            <option key={actorType} value={actorType}>
              {actorType}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Faction</span>
        <select
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 text-canvas-ink"
          onChange={(event) =>
            commitActorProperties({
              layoutGroup: event.currentTarget.value as ActorLayoutGroup
            })
          }
          value={actor.layoutGroup}
        >
          {LAYOUT_GROUPS.map((layoutGroup) => (
            <option key={layoutGroup} value={layoutGroup}>
              {layoutGroup}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Size</span>
        <select
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 text-canvas-ink"
          onChange={(event) =>
            commitActorProperties({ size: event.currentTarget.value as ActorSize })
          }
          value={actor.size}
        >
          {ACTOR_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Shape</span>
        <select
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 text-canvas-ink"
          onChange={(event) =>
            commitActorProperties({
              shape: event.currentTarget.value as ActorShape
            })
          }
          value={actor.shape}
        >
          {ACTOR_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {shape}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Token image URL</span>
        <input
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2 text-canvas-ink"
          onBlur={(event) =>
            commitActorProperties({
              image: event.currentTarget.value.trim() || undefined
            })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          type="text"
          defaultValue={actor.image ?? ""}
        />
      </label>
    </div>
  );
}
