import type { ReactNode, DragEventHandler, MouseEvent, MouseEventHandler, PointerEvent as ReactPointerEvent } from 'react';
import type { LayoutPoint } from '@core/layout/types';
import type { RootState } from '@store/store';
import type { Zone } from '@entities/zone/types';
import type { EdgePreset } from '@entities/edge/edgeMutations';
import type { ActorDragEndEvent, ActorDragStartEvent, ActorDragState, EngagementDragState, EdgeDragState, ShapeDraftState, ZoneDragState } from './canvasInteractionTypes';
import type { ActorRenderPlacement } from './actors/actorCanvasLayout';
import type { ActorPlacementTranslation } from './actors/actorPlacementTranslation';
import type { LocalBoxSelectionState } from './zones/zoneGeometry';

export type CanvasWorkspaceProps = {
  rotationPreview?: { zoneId: string; rotation: number; active: boolean };
  onZoneRotationCancel?: () => void;
  keyboardOverlay?: ReactNode;
  activeToolId: RootState["interaction"]["activeToolId"];
  actorDrag: ActorDragState | null;
  actorTargetZoneId: string | null;
  engagementDrag: EngagementDragState | null;
  backgroundImage: RootState["encounter"]["present"]["backgroundImage"];
  backgroundLuminanceByZoneId: Record<string, number>;
  boxSelection: LocalBoxSelectionState | null;
  canvasBackgroundLuminance: number;
  canvasRef: { current: SVGSVGElement | null };
  directManipulationZoneId: string | null;
  encounter: RootState["encounter"]["present"];
  edgeDrag: EdgeDragState | null;
  edgeTool: EdgePreset;
  actorRenderPlacements: ActorRenderPlacement[];
  zoneActorTranslation: ActorPlacementTranslation | null;
  getDisplayedPolygon: (zone: Zone) => LayoutPoint[];
  onActorDragStart: (
    actorId: string,
    point: LayoutPoint,
    event: ActorDragStartEvent
  ) => void;
  onActorDrag: (point: LayoutPoint) => void;
  onActorDragEnd: (event: ActorDragEndEvent) => void;
  onActorIncomingPointCommitted: (actorId: string) => void;
  onActorReturnComplete: (actorId: string) => void;
  onEngagementDrag: (point: LayoutPoint) => void;
  onEngagementDragEnd: () => void;
  onEngagementDragReturnComplete: () => void;
  onEngagementDragStart: (engagementId: string, point: LayoutPoint) => void;
  onEngagementSelect: (engagementId: string, toggle?: boolean) => void;
  handleCanvasClick: MouseEventHandler<SVGSVGElement>;
  handleCanvasContextMenu: MouseEventHandler<SVGSVGElement>;
  handleCanvasDoubleClick: MouseEventHandler<SVGSVGElement>;
  handleCanvasDragOver: DragEventHandler<SVGSVGElement>;
  handleCanvasDrop: DragEventHandler<SVGSVGElement>;
  handleCanvasMouseDown: (
    event: MouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>
  ) => void;
  handleCanvasMouseMove: (
    event: MouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>
  ) => void;
  handleCanvasMouseUp: (
    event: MouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>
  ) => void;
  handleResizeHandleMouseDown: (
    zone: Zone,
    polygon: LayoutPoint[],
    point: LayoutPoint,
    vertexIndex: number,
    event: MouseEvent<SVGCircleElement> | ReactPointerEvent<SVGCircleElement>
  ) => number | undefined;
  onResizeHandleDrag: (point: LayoutPoint, gestureId?: number, timeStamp?: number) => void;
  onResizeHandleDragEnd: (event: ActorDragEndEvent, gestureId?: number) => void;
  onZoneMotionComplete: () => void;
  polygonDraftColor: string;
  selection: RootState["interaction"]["selection"];
  shapeDraft: ShapeDraftState | null;
  showFactionOutlines: boolean;
  onActorMouseEnter: (actorId: string) => void;
  onActorMouseLeave: (actorId: string) => void;
  zoneDraftPoints: LayoutPoint[];
  zoneOpacityPreview: RootState["interaction"]["zoneOpacityPreview"];
  zoneShapeMode: RootState["interaction"]["zoneShapeMode"];
  zoneDrag: ZoneDragState | null;
};
