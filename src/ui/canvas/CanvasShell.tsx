import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { ZONELESS_ACTOR_ZONE_ID } from "../../core/encounter/types";
import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import type { LayoutPoint } from "../../core/layout/types";
import { RENDER_LAYERS } from "../../core/rendering/types";
import { prepareValidatedEncounterChange } from "../../core/validation/validatedEncounterChange";
import { createActor } from "../../entities/actor/actorMutations";
import { resolveLibraryAsset } from "../../library/librarySlice";
import { LIBRARY_NODE_DRAG_TYPE } from "../library/libraryDrag";
import type { RootState } from "../../store/store";
import { commitEncounterChange } from "../../store/encounterSlice";
import { closeZoneShapeMenu } from "../toolbar/events";
import { ActorLayer } from "./ActorLayer";
import { CanvasBackgroundLayer } from "./CanvasBackgroundLayer";
import { CanvasOverlays } from "./CanvasOverlays";
import { CanvasToolStatusBadge } from "./CanvasToolStatusBadge";
import { CANVAS_BACKGROUND_COLOR, CANVAS_HEIGHT, CANVAS_WIDTH } from "./canvasConstants";
import { getTextColorForLuminance } from "./canvasLuminance";
import type {
  ActorDragState,
  ShapeDraftState,
  VertexDragState,
  ZoneDragState
} from "./canvasInteractionTypes";
import { ZoneLayer } from "./ZoneLayer";
import { type LocalBoxSelectionState, toSvgPoint } from "./zoneGeometry";
import { findZoneIdAtPoint } from "./actorCanvasLayout";
import { useCanvasInteractionHandlers } from "./useCanvasInteractionHandlers";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import {
  useBackgroundLuminanceByZoneId,
  usePolygonDraftBackgroundLuminance
} from "./useCanvasLuminance";
export function CanvasShell() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const zoneShapeMode = useSelector(
    (state: RootState) => state.interaction.zoneShapeMode
  );
  const zonePaintBrush = useSelector(
    (state: RootState) => state.interaction.zonePaintBrush
  );
  const lastZoneOpacity = useSelector(
    (state: RootState) => state.interaction.lastZoneOpacity
  );
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const backgroundImage = encounter.backgroundImage;
  const [actorDrag, setActorDrag] = useState<ActorDragState | null>(null);
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);
  const [altKeyDown, setAltKeyDown] = useState(false);
  const [zoneDraftPoints, setZoneDraftPoints] = useState<LayoutPoint[]>([]);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraftState | null>(null);
  const [vertexDrag, setVertexDrag] = useState<VertexDragState | null>(null);
  const [zoneDrag, setZoneDrag] = useState<ZoneDragState | null>(null);
  const [boxSelection, setBoxSelection] = useState<LocalBoxSelectionState | null>(
    null
  );
  const suppressNextCanvasClickRef = useRef(false);
  const suppressNextCanvasClickUnconditionallyRef = useRef(false);
  const suppressNextCanvasClickPointRef = useRef<LayoutPoint | null>(null);
  const suppressNextEntityClickRef = useRef<string | null>(null);
  const backgroundLuminanceByZoneId = useBackgroundLuminanceByZoneId(
    backgroundImage,
    encounter.zones
  );
  const polygonDraftBackgroundLuminance = usePolygonDraftBackgroundLuminance(
    backgroundImage,
    zoneDraftPoints
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setAltKeyDown(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setAltKeyDown(false);
      }
    }

    function handleWindowBlur() {
      setAltKeyDown(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useCanvasKeyboard({
    activeToolId,
    actorTool,
    clearShapeDraft: () => setShapeDraft(null),
    clearZoneDraftPoints: () => setZoneDraftPoints([]),
    closeZoneShapeMenu,
    dispatch,
    encounter,
    selection,
    zonePaintBrush
  });

  const {
    getDisplayedPolygon,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleActorMouseDown,
    handleResizeHandleMouseDown
  } = useCanvasInteractionHandlers({
    activeToolId,
    actorDrag,
    actorTool,
    boxSelection,
    dispatch,
    encounter,
    lastZoneOpacity,
    selection,
    setActorDrag,
    setBoxSelection,
    setShapeDraft,
    setVertexDrag,
    setZoneDraftPoints,
    setZoneDrag,
    shapeDraft,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef,
    suppressNextCanvasClickUnconditionallyRef,
    suppressNextEntityClickRef,
    vertexDrag,
    zoneDraftPoints,
    zoneDrag,
    zonePaintBrush,
    zoneShapeMode
  });

  const polygonDraftColor = getTextColorForLuminance(
    polygonDraftBackgroundLuminance
  );
  const showFactionOutlines =
    altKeyDown && (activeToolId === "actor" || activeToolId === "select");
  const selectedActorNames =
    selection.selectedEntityType === "actor"
      ? selection.selectedIds
          .map((actorId) => encounter.actors.byId[actorId]?.name)
          .filter((name): name is string => Boolean(name))
          .sort((left, right) => left.localeCompare(right))
      : [];
  const hoveredActorName = hoveredActorId
    ? encounter.actors.byId[hoveredActorId]?.name
    : undefined;
  const statusActorNames =
    selectedActorNames.length > 0
      ? selectedActorNames
      : hoveredActorName
        ? [hoveredActorName]
        : [];

  function commitActorFromLibraryNode(nodeId: string, destinationZoneId: string) {
    const tokens = library.sections.tokens;
    const asset = resolveLibraryAsset(tokens, nodeId);

    if (!asset) {
      return;
    }

    const actorId = `actor-${Date.now()}`;
    const nextEncounter = createActor(encounter, {
      currentZoneId: destinationZoneId,
      id: actorId,
      image: asset,
      layoutGroup: actorTool.layoutGroup,
      shape: actorTool.shape,
      size: actorTool.size
    });
    const action = createEncounterActionRecord("actor.create", {
      actorId,
      destinationZoneId
    });
    const prepared = prepareValidatedEncounterChange({
      action,
      currentEncounter: encounter,
      nextEncounter
    });

    if (!prepared.blocked) {
      dispatch(
        commitEncounterChange({
          action: prepared.action,
          nextEncounter: prepared.nextEncounter
        })
      );
    }
  }

  function handleCanvasDragOver(event: DragEvent<SVGSVGElement>) {
    if (
      activeToolId !== "actor" ||
      !Array.from(event.dataTransfer.types).includes(LIBRARY_NODE_DRAG_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleCanvasDrop(event: DragEvent<SVGSVGElement>) {
    if (activeToolId !== "actor") {
      return;
    }

    const nodeId = event.dataTransfer.getData(LIBRARY_NODE_DRAG_TYPE);

    if (!nodeId) {
      return;
    }

    event.preventDefault();
    const point = toSvgPoint(event, event.currentTarget);
    const destinationZoneId =
      findZoneIdAtPoint(encounter, point) ?? ZONELESS_ACTOR_ZONE_ID;

    commitActorFromLibraryNode(nodeId, destinationZoneId);
  }

  return (
    <section
      aria-label="Encounter canvas"
      className="relative min-h-0 overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm"
      role="main"
    >
      <svg
        aria-label="SVG encounter workspace"
        className={`h-full min-h-0 w-full bg-[${CANVAS_BACKGROUND_COLOR}]`}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        role="img"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      >
        {RENDER_LAYERS.map((layer) => (
          <g
            key={layer.id}
            aria-label={`${layer.label} layer`}
            data-layer={layer.id}
          >
            {layer.id === "background" ? (
              <CanvasBackgroundLayer backgroundImage={backgroundImage} />
            ) : null}
            {layer.id === "zones"
              ? (
                  <ZoneLayer
                    activeToolId={activeToolId}
                    actorTargetZoneId={actorTool.targetZoneId}
                    backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
                    getDisplayedPolygon={getDisplayedPolygon}
                    onResizeHandleMouseDown={handleResizeHandleMouseDown}
                    selection={selection}
                    zones={encounter.zones}
                  />
                )
              : null}
            {layer.id === "freeFloatingActors"
              ? (
                  <ActorLayer
                    actorDrag={actorDrag}
                    encounter={encounter}
                    onActorMouseDown={handleActorMouseDown}
                    onActorMouseEnter={setHoveredActorId}
                    onActorMouseLeave={(actorId) =>
                      setHoveredActorId((current) =>
                        current === actorId ? null : current
                      )
                    }
                    selection={selection}
                    showFactionOutlines={showFactionOutlines}
                  />
                )
              : null}
            {layer.id === "uiOverlays"
              ? (
                  <CanvasOverlays
                    boxSelection={boxSelection}
                    polygonDraftColor={polygonDraftColor}
                    shapeDraft={shapeDraft}
                    zoneDraftPoints={zoneDraftPoints}
                    zoneShapeMode={zoneShapeMode}
                  />
                )
              : null}
          </g>
        ))}
      </svg>
      <CanvasToolStatusBadge
        activeToolId={activeToolId}
        actorNames={statusActorNames}
        zoneShapeMode={zoneShapeMode}
      />
    </section>
  );
}
