import { useMemo } from "react";

import type { RootState } from "@store/store";
import type { ActorPlacementTranslation } from "./actors/actorPlacementTranslation";
import type { VertexDragState, ZoneDragState } from "./canvasInteractionTypes";
import { snapZonePolygon } from "@core/movement/zoneVertexSnapping";
import { getPolygonBounds } from "@core/layout/polygonGeometry";

/** Uses only gesture geometry to preview locked Actors during Zone edits. */
export function useZoneActorTranslation(
  encounter: RootState["encounter"]["present"],
  zoneDrag: ZoneDragState | null,
  vertexDrag: VertexDragState | null = null
) {
  return useMemo<ActorPlacementTranslation | null>(() => {
    if (!encounter.movementRules.zoneLocked) {
      return null;
    }

    if (vertexDrag?.hasMoved) {
      const zone = encounter.zones.byId[vertexDrag.zoneId];
      if (!zone) return null;
      const original = getPolygonBounds(zone.polygon);
      const resized = getPolygonBounds(snapZonePolygon(encounter, { ...zone, polygon: vertexDrag.polygon }));
      const width = original.maxX - original.minX, height = original.maxY - original.minY;
      return {
        zoneId: zone.id,
        origin: { x: original.minX, y: original.minY },
        offset: { x: resized.minX - original.minX, y: resized.minY - original.minY },
        scale: { x: width > 1e-8 ? (resized.maxX - resized.minX) / width : 1,
          y: height > 1e-8 ? (resized.maxY - resized.minY) / height : 1 }
      };
    }

    if (!zoneDrag) return null;

    const zone = encounter.zones.byId[zoneDrag.zoneId];

    // Once committed, cached placement geometry already contains translated points.
    if (!zone || (zoneDrag.phase !== 'dragging' && zone.polygon !== (zoneDrag.sourcePolygon ?? zoneDrag.originalPolygon))) {
      return null;
    }

    const target = zoneDrag.phase === 'validating' && zoneDrag.previewPolygon ? zoneDrag.previewPolygon : zoneDrag.originalPolygon;
    const original = getPolygonBounds(zone.polygon), next = getPolygonBounds(target);
    const dragging = zoneDrag.phase === 'dragging';
    const offset = { x: next.minX - original.minX + (dragging ? zoneDrag.current.x - zoneDrag.start.x : 0),
      y: next.minY - original.minY + (dragging ? zoneDrag.current.y - zoneDrag.start.y : 0) };
    const width = original.maxX - original.minX, height = original.maxY - original.minY;
    const scale = { x: width > 1e-8 ? (next.maxX - next.minX) / width : 1,
      y: height > 1e-8 ? (next.maxY - next.minY) / height : 1 };
    return { zoneId: zone.id, offset, ...(Math.abs(scale.x - 1) > 1e-8 || Math.abs(scale.y - 1) > 1e-8
      ? { scale, origin: { x: original.minX, y: original.minY } } : {}) };

  }, [encounter, zoneDrag, vertexDrag]);
}
