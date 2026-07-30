import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { RootState } from '@store/store';
import type { ActorRenderPlacement } from '../actors/actorCanvasLayout';
import type { ActorPlacementTranslation } from '../actors/actorPlacementTranslation';
import type {
  ActorDragState,
  EngagementDragState
} from '../canvasInteractionTypes';
import { getZoneNameTextColor } from '../canvasLuminance';
import {
  getEngagementTokenPoint,
  routeEngagementConnectorGroups,
  type EngagementParticipantPoint
} from './engagementGeometry';
import { EngagementVisual } from './EngagementVisual';

type EngagementLayerProps = {
  encounter: EncounterState;
  placements: ActorRenderPlacement[];
  selection: RootState['interaction']['selection'];
  actorDrag: ActorDragState | null;
  activeToolId: RootState['interaction']['activeToolId'];
  backgroundLuminanceByZoneId: Record<string, number>;
  engagementDrag: EngagementDragState | null;
  zoneActorTranslation?: ActorPlacementTranslation | null;
  onEngagementDrag: (point: LayoutPoint) => void;
  onEngagementDragEnd: () => void;
  onEngagementDragReturnComplete: () => void;
  onEngagementDragStart: (engagementId: string, point: LayoutPoint) => void;
  onEngagementSelect: (engagementId: string, toggle?: boolean) => void;
};

type EngagementRenderModel = {
  color: string;
  engagementId: string;
  outlineColor: string;
  participants: EngagementParticipantPoint[];
  token: LayoutPoint;
};

function addOffset(point: LayoutPoint, offset: LayoutPoint): LayoutPoint {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function translateZonePoint(
  point: LayoutPoint,
  zoneId: string,
  translation: ActorPlacementTranslation | null
): LayoutPoint {
  return translation?.zoneId === zoneId
    ? {
        x: point.x + translation.offset.x,
        y: point.y + translation.offset.y
      }
    : point;
}

/** Engagement connectors/tokens deliberately render behind the Actor layer. */
export function EngagementLayer({
  activeToolId,
  actorDrag,
  backgroundLuminanceByZoneId,
  encounter,
  engagementDrag,
  onEngagementDrag,
  onEngagementDragEnd,
  onEngagementDragReturnComplete,
  onEngagementDragStart,
  onEngagementSelect,
  placements,
  selection,
  zoneActorTranslation = null
}: EngagementLayerProps) {
  const placementByActorId = new Map(
    placements.map((placement) => [placement.actor.id, placement])
  );
  const actorObstacles: EngagementParticipantPoint[] = placements.map(
    (placement) => ({
      actorId: placement.actor.id,
      point: translateZonePoint(
        placement.point,
        placement.actor.currentZoneId,
        zoneActorTranslation
      ),
      radius: placement.radius,
      shape: placement.actor.shape
    })
  );
  const models: EngagementRenderModel[] = encounter.engagements.allIds.flatMap(
    (engagementId) => {
      const engagement = encounter.engagements.byId[engagementId];
      const zone = engagement
        ? encounter.zones.byId[engagement.parentZoneId]
        : undefined;
      if (!engagement || !zone) return [];
      const settledParticipants = engagement.participantIds.flatMap((actorId) => {
        const placement = placementByActorId.get(actorId);
        return placement
          ? [{
              actorId,
              point: placement.point,
              radius: placement.radius,
              shape: placement.actor.shape
            }]
          : [];
      });
      if (settledParticipants.length < 2) return [];
      const sectionPolygon = placementByActorId.get(
        engagement.participantIds[0]
      )?.sectionPolygon;
      const settledToken =
        placementByActorId.get(engagement.participantIds[0])
          ?.engagementTokenPoint ??
        getEngagementTokenPoint(
          settledParticipants,
          sectionPolygon ?? zone.polygon
        );
      const participants = settledParticipants.map((participant) => ({
        ...participant,
        point: translateZonePoint(
          participant.point,
          engagement.parentZoneId,
          zoneActorTranslation
        )
      }));
      return [{
        color: zone.colorBorder,
        engagementId,
        outlineColor: getZoneNameTextColor(
          zone,
          backgroundLuminanceByZoneId[zone.id]
        ),
        participants,
        token: translateZonePoint(
          settledToken,
          engagement.parentZoneId,
          zoneActorTranslation
        )
      }];
    }
  );
  const connectorRouting = routeEngagementConnectorGroups(
    models,
    actorObstacles
  );

  return (
    <>
      {models.map((model) => {
        const settledConnectors =
          connectorRouting.connectorsByEngagementId[model.engagementId] ?? [];
        const engagement = encounter.engagements.byId[model.engagementId];
        const draggedParticipantIds = new Set(
          engagement?.participantIds.filter((actorId) =>
            actorDrag?.actorIds.includes(actorId)
          ) ?? []
        );
        const movesCompleteEngagement =
          actorDrag?.phase === 'dragging' &&
          engagement !== undefined &&
          draggedParticipantIds.size === engagement.participantIds.length;
        const dragOffset =
          movesCompleteEngagement && actorDrag
            ? {
                x: actorDrag.current.x - actorDrag.start.x,
                y: actorDrag.current.y - actorDrag.start.y
              }
            : { x: 0, y: 0 };
        const connectors = movesCompleteEngagement
          ? settledConnectors.map((connector) => ({
              ...connector,
              from: addOffset(connector.from, dragOffset),
              to: addOffset(connector.to, dragOffset)
            }))
          : settledConnectors;
        const selectedActorIds =
          selection.selectedEntityType === 'actor'
            ? new Set(selection.selectedIds)
            : undefined;
        const selected =
          selectedActorIds !== undefined &&
          model.participants.every(({ actorId }) =>
            selectedActorIds.has(actorId)
          );

        return (
          <EngagementVisual
            key={model.engagementId}
            activeToolId={activeToolId}
            color={model.color}
            connectors={connectors}
            drag={
              engagementDrag?.engagementId === model.engagementId
                ? engagementDrag
                : null
            }
            engagementId={model.engagementId}
            hiddenActorIds={
              movesCompleteEngagement ? undefined : draggedParticipantIds
            }
            isDropTarget={
              engagementDrag?.phase === 'dragging' &&
              engagementDrag.hoverTargetEngagementId === model.engagementId
            }
            onDrag={onEngagementDrag}
            onDragEnd={onEngagementDragEnd}
            onDragReturnComplete={onEngagementDragReturnComplete}
            onDragStart={onEngagementDragStart}
            onSelect={onEngagementSelect}
            selected={selected}
            token={
              movesCompleteEngagement
                ? addOffset(model.token, dragOffset)
                : model.token
            }
            targetOutlineColor={model.outlineColor}
          />
        );
      })}
    </>
  );
}
