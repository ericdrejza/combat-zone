import type { Actor } from "../actor/types";
import type { Edge } from "../edge/types";
import type { Engagement } from "../engagement/types";
import type { EncounterState } from "@core/encounter/types";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { EntityCollection, EntityId } from "@core/state/entityCollection";
import type { LayoutOrientation, LayoutPoint } from "@core/layout/types";
import type { Zone, ZoneNamePosition, ZoneShape } from "./types";

export type CreateZoneInput = {
  autoResize?: boolean;
  colorBorder?: string;
  colorFill?: string;
  id: EntityId;
  name?: string;
  namePosition?: ZoneNamePosition;
  opacity?: number;
  polygon: LayoutPoint[];
  showBorder?: boolean;
  showName?: boolean;
  showSectionDividers?: boolean;
  shape?: ZoneShape;
  layoutOrientation?: LayoutOrientation;
  layoutStrategy?: Zone["layoutStrategy"];
  tags?: string[];
};

export type UpdateZonePropertiesInput = {
  autoResize?: boolean;
  colorBorder?: string;
  colorFill?: string;
  layoutOrientation?: LayoutOrientation;
  layoutStrategy?: Zone["layoutStrategy"];
  name?: string;
  namePosition?: ZoneNamePosition;
  opacity?: number;
  showBorder?: boolean;
  showName?: boolean;
  showSectionDividers?: boolean;
  tags?: string[];
};

function upsertEntity<TEntity extends { id: EntityId }>(
  collection: EntityCollection<TEntity>,
  entity: TEntity
): EntityCollection<TEntity> {
  return {
    byId: {
      ...collection.byId,
      [entity.id]: entity
    },
    allIds: collection.allIds.includes(entity.id)
      ? collection.allIds
      : [...collection.allIds, entity.id]
  };
}

function removeEntities<TEntity extends { id: EntityId }>(
  collection: EntityCollection<TEntity>,
  idsToRemove: Set<EntityId>
): EntityCollection<TEntity> {
  const byId = { ...collection.byId };

  for (const id of idsToRemove) {
    delete byId[id];
  }

  return {
    byId,
    allIds: collection.allIds.filter((id) => !idsToRemove.has(id))
  };
}

function updateEntities<TEntity extends { id: EntityId }>(
  collection: EntityCollection<TEntity>,
  updater: (entity: TEntity) => TEntity
): EntityCollection<TEntity> {
  const byId: EntityCollection<TEntity>["byId"] = {};

  for (const id of collection.allIds) {
    const entity = collection.byId[id];

    if (entity) {
      byId[id] = updater(entity);
    }
  }

  return {
    byId,
    allIds: collection.allIds
  };
}

export function buildZone({
  autoResize = false,
  colorBorder = "#9b876b",
  colorFill = "#ffffff",
  id,
  layoutOrientation = "LEFT_RIGHT",
  layoutStrategy = "FLEX",
  name = "New Zone",
  namePosition = "top-left",
  opacity = 0.7,
  polygon,
  showBorder = true,
  showName = false,
  showSectionDividers = false,
  shape = "polygon",
  tags = []
}: CreateZoneInput): Zone {
  return {
    autoResize,
    colorBorder,
    colorFill,
    id,
    name,
    namePosition,
    opacity,
    polygon,
    showBorder,
    showName,
    showSectionDividers,
    shape,
    layoutStrategy,
    layoutOrientation,
    tags
  };
}

export function createZone(
  state: EncounterState,
  input: CreateZoneInput
): EncounterState {
  const zone = buildZone(input);

  return {
    ...state,
    zones: upsertEntity(state.zones, zone)
  };
}

export function updateZonePolygon(
  state: EncounterState,
  zoneId: EntityId,
  polygon: LayoutPoint[]
): EncounterState {
  const zone = state.zones.byId[zoneId];

  if (!zone) {
    return state;
  }

  return {
    ...state,
    zones: upsertEntity(state.zones, {
      ...zone,
      polygon
    })
  };
}

export function updateZoneProperties(
  state: EncounterState,
  zoneId: EntityId,
  properties: UpdateZonePropertiesInput
): EncounterState {
  const zone = state.zones.byId[zoneId];

  if (!zone) {
    return state;
  }

  return {
    ...state,
    zones: upsertEntity(state.zones, {
      ...zone,
      ...properties
    })
  };
}

export function deleteZone(
  state: EncounterState,
  zoneId: EntityId
): EncounterState {
  if (!state.zones.byId[zoneId]) {
    return state;
  }

  const connectedEdgeIds = new Set(
    state.edges.allIds.filter((edgeId) => {
      const edge = state.edges.byId[edgeId];

      return edge?.fromZoneId === zoneId || edge?.toZoneId === zoneId;
    })
  );
  const containedEngagementIds = new Set(
    state.engagements.allIds.filter(
      (engagementId) => state.engagements.byId[engagementId]?.parentZoneId === zoneId
    )
  );

  return {
    ...state,
    zones: removeEntities(state.zones, new Set([zoneId])),
    edges: removeEntities<Edge>(state.edges, connectedEdgeIds),
    engagements: removeEntities<Engagement>(
      state.engagements,
      containedEngagementIds
    ),
    actors: updateEntities<Actor>(state.actors, (actor) =>
      actor.currentZoneId === zoneId
        ? {
            ...actor,
            currentZoneId: ZONELESS_ACTOR_ZONE_ID
          }
        : actor
    )
  };
}
