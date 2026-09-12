import type { Dispatch, SetStateAction } from 'react';

import type { LayoutPoint } from '@core/layout/types';
import type { ZoneShape } from '@entities/zone/types';
import type { AppDispatch } from '@store/store';
import type { RootState } from '@store/store';
import type { ZoneColorDefaults } from '@ui/interface_preferences/InterfacePreferenceProvider';
import type { ActorRenderPlacement } from './actors/actorCanvasLayout';
import type { LocalBoxSelectionState } from './zones/zoneGeometry';

export type EdgeDragState = {
  current: LayoutPoint;
  sourceZoneId: string;
  start: LayoutPoint;
  targetZoneId?: string;
};

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
  shape: Extract<ZoneShape, 'rectangle' | 'circle' | 'hexagon'>;
  start: LayoutPoint;
};

export type ZoneDragState = {
  current: LayoutPoint;
  hasMoved: boolean;
  originalPolygon: LayoutPoint[];
  phase: 'dragging' | 'committed';
  start: LayoutPoint;
  zoneId: string;
};

export type ActorDragState = {
  actorId: string;
  actorIds: string[];
  /** Frozen render points keep worker revisions from moving a drag's origin. */
  originPointsByActorId?: Record<string, LayoutPoint>;
  /** Target actor held for 500ms to explicitly signal create-engagement. */
  engagementIntentActorId?: string;
  /** Existing group held for 500ms to explicitly signal join-engagement. */
  engagementIntentEngagementId?: string;
  current: LayoutPoint;
  hasMoved: boolean;
  phase: 'dragging' | 'returning';
  /** Explicit snap-back targets used when a drop does not mutate the encounter. */
  returnPointsByActorId?: Record<string, LayoutPoint>;
  start: LayoutPoint;
};

export type EngagementDragState = {
  current: LayoutPoint;
  engagementId: string;
  hasMoved: boolean;
  hoverTargetEngagementId?: string;
  phase: 'dragging' | 'returning';
  start: LayoutPoint;
};

export type ActorDragStartEvent = {
  ctrlKey: boolean;
  metaKey: boolean;
  pointerType?: string;
  shiftKey: boolean;
  touchMultiSelect?: boolean;
};

export type ActorDragEndEvent = {
  stopPropagation: () => void;
};

export type MutableRefValue<TValue> = {
  current: TValue;
};

export type CanvasInteractionState = {
  activeToolId: RootState['interaction']['activeToolId'];
  actorDrag: ActorDragState | null;
  actorRenderPlacements: ActorRenderPlacement[];
  actorPaintBrush: RootState['interaction']['actorPaintBrush'];
  actorTool: RootState['interaction']['actorTool'];
  boxSelection: LocalBoxSelectionState | null;
  canvasRef: MutableRefValue<SVGSVGElement | null>;
  dispatch: AppDispatch;
  encounter: RootState['encounter']['present'];
  edgeDrag: EdgeDragState | null;
  edgeTool: RootState['interaction']['edgeTool'];
  selection: RootState['interaction']['selection'];
  touchMultiSelect?: RootState['interaction']['touchMultiSelect'];
  setActorDrag: Dispatch<SetStateAction<ActorDragState | null>>;
  setBoxSelection: Dispatch<SetStateAction<LocalBoxSelectionState | null>>;
  setEdgeDrag: Dispatch<SetStateAction<EdgeDragState | null>>;
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
  zonePaintBrush: RootState['interaction']['zonePaintBrush'];
  zoneColorDefaults: ZoneColorDefaults;
  zoneOpacityDefault: number;
  zoneShowBorderDefault: boolean;
  zoneShapeMode: RootState['interaction']['zoneShapeMode'];
};
