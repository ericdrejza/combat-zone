import type { MouseEvent, PointerEvent } from "react";
import type { LayoutPoint } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
import type { RootState } from "@store/store";
import type { ActorDragEndEvent, ZoneDragState } from "../canvasInteractionTypes";

export type ZoneLayerProps = {
  rotationPreview?: { zoneId: string; rotation: number; active: boolean };
  onZoneRotationCancel?: () => void;
  activeToolId: string;
  actorTargetZoneId: string | null;
  backgroundLuminanceByZoneId: Record<string, number>;
  directManipulationZoneId: string | null;
  encounter: RootState["encounter"]["present"];
  getDisplayedPolygon: (zone: Zone) => LayoutPoint[];
  onResizeHandleMouseDown: (
    zone: Zone,
    polygon: LayoutPoint[],
    point: LayoutPoint,
    vertexIndex: number,
    event: MouseEvent<SVGCircleElement> | PointerEvent<SVGCircleElement>
  ) => number | undefined;
  onResizeHandleDrag: (point: LayoutPoint, gestureId?: number, timeStamp?: number) => void;
  onResizeHandleDragEnd: (event: ActorDragEndEvent, gestureId?: number) => void;
  onZoneMotionComplete: () => void;
  selection: RootState["interaction"]["selection"];
  zoneDrag: ZoneDragState | null;
  zoneOpacityPreview: RootState["interaction"]["zoneOpacityPreview"];
};
