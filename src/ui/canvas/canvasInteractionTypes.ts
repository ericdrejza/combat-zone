import type { Dispatch, SetStateAction } from "react";

import type { LayoutPoint } from "@core/layout/types";
import type { ZoneShape } from "@entities/zone/types";
import type { AppDispatch } from "@store/store";
import type { RootState } from "@store/store";
import type { ActorRenderPlacement } from "./actorCanvasLayout";
import type { LocalBoxSelectionState } from "./zoneGeometry";

export type VertexDragState = {
  hasMoved: boolean;
  handleStart: LayoutPoint;
  polygon: LayoutPoint[];
  vertexIndex: number;
  zoneId: string;
};

export type ShapeDraftState = {
  cloneSourceZoneId?: string;
  current: LayoutPoint;
  shape: Extract<ZoneShape, "rectangle" | "circle" | "hexagon">;
  start: LayoutPoint;
};

export type ZoneDragState = {
  current: LayoutPoint;
  hasMoved: boolean;
  originalPolygon: LayoutPoint[];
  phase: "dragging" | "committed";
  start: LayoutPoint;
  zoneId: string;
};

export type ActorDragState = {
  actorId: string;
  actorIds: string[];
  current: LayoutPoint;
  hasMoved: boolean;
  phase: "dragging" | "returning";
  start: LayoutPoint;
};

export type ActorDragStartEvent = {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export type ActorDragEndEvent = {
  stopPropagation: () => void;
};

export type MutableRefValue<TValue> = {
  current: TValue;
};

export type CanvasInteractionState = {
  activeToolId: RootState["interaction"]["activeToolId"];
  actorDrag: ActorDragState | null;
  actorRenderPlacements: ActorRenderPlacement[];
  actorPaintBrush: RootState["interaction"]["actorPaintBrush"];
  actorTool: RootState["interaction"]["actorTool"];
  boxSelection: LocalBoxSelectionState | null;
  canvasRef: MutableRefValue<SVGSVGElement | null>;
  dispatch: AppDispatch;
  encounter: RootState["encounter"]["present"];
  lastZoneOpacity: RootState["interaction"]["lastZoneOpacity"];
  selection: RootState["interaction"]["selection"];
  setActorDrag: Dispatch<SetStateAction<ActorDragState | null>>;
  setBoxSelection: Dispatch<SetStateAction<LocalBoxSelectionState | null>>;
  setShapeDraft: Dispatch<SetStateAction<ShapeDraftState | null>>;
  setVertexDrag: Dispatch<SetStateAction<VertexDragState | null>>;
  setZoneDraftPoints: Dispatch<SetStateAction<LayoutPoint[]>>;
  setZoneDrag: Dispatch<SetStateAction<ZoneDragState | null>>;
  shapeDraft: ShapeDraftState | null;
  suppressNextCanvasClickPointRef: MutableRefValue<LayoutPoint | null>;
  suppressNextCanvasClickRef: MutableRefValue<boolean>;
  suppressNextCanvasClickUnconditionallyRef: MutableRefValue<boolean>;
  suppressNextEntityClickRef: MutableRefValue<string | null>;
  vertexDrag: VertexDragState | null;
  zoneDraftPoints: LayoutPoint[];
  zoneDrag: ZoneDragState | null;
  zonePaintBrush: RootState["interaction"]["zonePaintBrush"];
  zoneShapeMode: RootState["interaction"]["zoneShapeMode"];
};
