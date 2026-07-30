import type { EncounterState } from "../encounter/types";
import { getActorRadius, toNestingActor } from "../layout/actorFootprints";
import { packEngagementParticipants } from "../layout/engagementPacking";
import {
  routeEngagementConnectorGroups
} from "../layout/engagementConnectorRouting";
import { orderActorsForEngagementPacking } from "../layout/engagementPackingOrder";
import { getEngagementAwareSplitInput } from '../layout/engagementSplitLayout';
import { packPolygonActors } from "../layout/nesting_ts";
import {
  getPolygonFlexAffectedZoneIds,
  polygonsEqual
} from "./polygonFlexPlacement";
import type {
  ValidationAction,
  ValidationMessage,
  ValidationResult,
  Validator
} from "./types";
import { engagementEntitiesAreSeparate } from './engagementEntityOverlap';
import { ENGAGEMENT_TOKEN_RADIUS } from '../layout/engagementGeometryConstants';

function result(messages: ValidationMessage[]): ValidationResult {
  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages
  };
}

function hasAmbiguousEngagementMembership(
  state: EncounterState,
  zoneId: string
): boolean {
  const seen = new Set<string>();
  return state.engagements.allIds.some((engagementId) => {
    const engagement = state.engagements.byId[engagementId];
    if (!engagement || engagement.parentZoneId !== zoneId) return false;
    const unique = new Set(engagement.participantIds);
    if (unique.size !== engagement.participantIds.length) return true;
    return engagement.participantIds.some((actorId) => {
      if (seen.has(actorId)) return true;
      seen.add(actorId);
      return false;
    });
  });
}

/**
 * Polygon layouts share a hard geometric invariant. This runs in OFF mode
 * because allowing an overlapping actor would make the derived canvas
 * placement ambiguous. Reshaping a zone or changing an actor footprint uses
 * the same fit check.
 */
export const PolygonPlacementValidator: Validator<EncounterState> = {
  id: "PolygonPlacementValidator",
  runsInOffMode: true,
  validate(action, { state, nextState }) {
    if (!nextState) {
      return result([]);
    }

    const affectedZoneIds = getPolygonFlexAffectedZoneIds(
      action,
      state,
      nextState
    );

    const messages: ValidationMessage[] = [];

    for (const zoneId of affectedZoneIds) {
      const zone = nextState.zones.byId[zoneId];

      if (!zone) {
        continue;
      }

      const previousZone = state.zones.byId[zoneId];
      const attemptedPolygon =
        action.payload.requestedPolygon ?? action.payload.polygon;
      const zoneWasAutomaticallyResized =
        action.type === "zone.reshape" &&
        previousZone &&
        Array.isArray(attemptedPolygon) &&
        !polygonsEqual(
          attemptedPolygon as { x: number; y: number }[],
          zone.polygon
        );
      const actorChangeResizedZone =
        action.type !== "zone.reshape" &&
        previousZone &&
        !polygonsEqual(previousZone.polygon, zone.polygon);

      if (zoneWasAutomaticallyResized || actorChangeResizedZone) {
        messages.push({
          code: "layout.polygonFlexZoneResized",
          message:
            action.type === "zone.reshape"
              ? `Zone ${zone.name} was enlarged to fit its actors.`
              : `Zone ${zone.name} was resized to fit the actor change.`,
          severity: "warning"
        });
      }

      const zoneActors = nextState.actors.allIds.flatMap((actorId) => {
        const actor = nextState.actors.byId[actorId];

        return actor && actor.currentZoneId === zoneId ? [actor] : [];
      });
      const orderedZoneActors = orderActorsForEngagementPacking(
        nextState,
        zoneActors
      );
      const actors = orderedZoneActors.map(toNestingActor);
      const splitInput = zone.layoutStrategy.startsWith('SPLIT')
        ? getEngagementAwareSplitInput(nextState, zoneId)
        : undefined;
      const packing = packPolygonActors({
        actors: splitInput?.actors ?? actors,
        layoutOrientation: zone.layoutOrientation,
        layoutStrategy: zone.layoutStrategy,
        polygon: zone.polygon,
        splitSectionOrder: splitInput?.splitSectionOrder
      });

      if (!packing.fits) {
        messages.push({
          code: "layout.polygonFlexNoSpace",
          message: `Actors cannot fit in polygon ${zone.layoutStrategy} zone ${zone.name} without overlap.`,
          severity: "error"
        });
        continue;
      }

      const splitSectionById = new Map(
        packing.splitSections?.map((section) => [section.id, section.polygon])
      );
      const splitSectionIdByActorId = new Map(
        splitInput?.actors.map((actor) => [actor.id, actor.splitSectionId])
      );
      const actorPlacements = orderedZoneActors.flatMap((actor) => {
        const actorId = actor.id;
        const point = packing.placements[actorId];

        if (!point) {
          return [];
        }

        const sectionId = splitSectionIdByActorId.get(actorId);
        const sectionPolygon = sectionId
          ? splitSectionById.get(sectionId)
          : undefined;

        return [{
          actorId,
          point,
          radius: getActorRadius(actor),
          shape: actor.shape,
          ...(sectionPolygon ? { sectionPolygon } : {})
        }];
      });
      const splitSectionPolygons = Object.fromEntries(
        (packing.splitSections ?? []).map((section) => [
          `${zoneId}:${section.id}`,
          section.polygon
        ])
      );
      // The domain validator reports duplicate/cross-group membership under
      // the selected policy. Do not mistake one referenced Actor for two
      // overlapping physical entities in the hard geometry audit.
      if (hasAmbiguousEngagementMembership(nextState, zoneId)) {
        continue;
      }
      const engagementPacking = packEngagementParticipants(
        nextState,
        actorPlacements,
        splitSectionPolygons
      );

      if (!engagementPacking.fits) {
        messages.push({
          code: engagementPacking.failureReason === 'connectors'
            ? "layout.engagementConnectorMissing"
            : "layout.engagementNoSpace",
          message: engagementPacking.failureReason === 'connectors'
            ? `Every actor in each engagement in zone ${zone.name} must connect to its token or another actor in that engagement.`
            : `Engagements cannot fit in zone ${zone.name} without overlapping actors or engagement tokens.`,
          severity: "error"
        });
        continue;
      }

      const settledByActorId = new Map(
        engagementPacking.placements.map((placement) => [
          placement.actorId,
          placement
        ])
      );
      const zoneEngagements = nextState.engagements.allIds.flatMap(
        (engagementId) => {
          const engagement = nextState.engagements.byId[engagementId];
          return engagement?.parentZoneId === zoneId ? [engagement] : [];
        }
      );
      const connectorGroups = zoneEngagements.flatMap((engagement) => {
        const token = engagementPacking.tokenPoints[engagement.id];
        const participants = engagement.participantIds.flatMap((actorId) => {
          const placement = settledByActorId.get(actorId);
          return placement
            ? [{
                actorId,
                point: placement.point,
                radius: placement.radius,
                shape: placement.shape
              }]
            : [];
        });
        if (!token || participants.length !== engagement.participantIds.length) {
          return [];
        }
        return [{ engagementId: engagement.id, participants, token }];
      });
      const tokenPoints = connectorGroups.map(({ token }) => token);

      if (!engagementEntitiesAreSeparate(
        engagementPacking.placements,
        tokenPoints,
        ENGAGEMENT_TOKEN_RADIUS
      )) {
        messages.push({
          code: "layout.engagementEntityOverlap",
          message: `Actors and Engagement tokens in zone ${zone.name} must not overlap.`,
          severity: "error"
        });
        continue;
      }
      const connectorRouting = routeEngagementConnectorGroups(
        connectorGroups,
        engagementPacking.placements
      );

      if (!connectorRouting.complete) {
        messages.push({
          code: "layout.engagementConnectorMissing",
          message: `Every actor in each engagement in zone ${zone.name} must connect to its token or another actor in that engagement.`,
          severity: "error"
        });
      }
    }

    return {
      ...result(messages),
      blocked: messages.some((message) => message.severity === "error")
    };
  }
};

/** @deprecated Use PolygonPlacementValidator. */
export const PolygonFlexPlacementValidator = PolygonPlacementValidator;
