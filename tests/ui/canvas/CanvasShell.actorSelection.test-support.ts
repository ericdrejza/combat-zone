import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { EntityCollection } from "@core/state/entityCollection";
import type { Actor } from "@entities/actor/types";
import type { Zone } from "@entities/zone/types";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { createRectanglePolygon } from "@ui/canvas/zones/zoneGeometry";

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

export function actor(id: string, currentZoneId = ZONELESS_ACTOR_ZONE_ID): Actor {
  return {
    actorType: "creature",
    currentZoneId,
    id,
    layoutGroup: "hero",
    metadata: {},
    name: id,
    shape: "circle",
    size: "medium",
    statusEffects: []
  };
}

export function namedActor(
  id: string,
  name: string,
  currentZoneId = ZONELESS_ACTOR_ZONE_ID
): Actor {
  return {
    ...actor(id, currentZoneId),
    name
  };
}

export function zone(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): Zone {
  return {
    colorBorder: "#166534",
    colorFill: "#dcfce7",
    id,
    layoutOrientation: "LEFT_RIGHT",
    layoutStrategy: "FLEX",
    name: id,
    namePosition: "top-left",
    opacity: 0.45,
    polygon: createRectanglePolygon({ x, y }, { x: x + width, y: y + height }),
    shape: "rectangle",
    showBorder: true,
    showName: true,
    tags: []
  };
}

export function seedEncounter(
  actors: Actor[],
  zones: Zone[] = [],
  validationMode: "OFF" | "ADVISORY" | "ASSISTED" | "STRICT" = "ADVISORY"
) {
  store.dispatch(
    commitEncounterChange({
      action: createEncounterActionRecord("test.seed"),
      nextEncounter: {
        ...createEncounterState({
          id: "encounter-actors",
          name: "Actor Selection Encounter"
        }),
        actors: collection(actors),
        validationState: {
          messages: [],
          mode: validationMode
        },
        zones: collection(zones)
      }
    })
  );
}

export function getRenderedPoint(element: HTMLElement): { x: number; y: number } {
  const transform = element.style.transform;
  const match = transform.match(
    /translateX\(([-\d.]+)px\) translateY\(([-\d.]+)px\)/
  );
  if (!match) throw new Error(`Missing rendered point: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

export function getMotionPositionHistory(
  element: HTMLElement
): Array<{ x: number; y: number }> {
  return JSON.parse(
    element.getAttribute("data-motion-position-history") ?? "[]"
  ) as Array<{ x: number; y: number }>;
}
