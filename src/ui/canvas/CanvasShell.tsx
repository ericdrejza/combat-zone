import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import type { LayoutPoint } from "../../core/layout/types";
import { RENDER_LAYERS } from "../../core/rendering/types";
import type { Zone } from "../../entities/zone/types";
import type { ZoneShape } from "../../entities/zone/types";
import {
  createZone,
  deleteZone,
  type CreateZoneInput,
  type UpdateZonePropertiesInput,
  updateZoneProperties,
  updateZonePolygon
} from "../../entities/zone/zoneMutations";
import {
  clearZonePaintBrush,
  clearSelection,
  finishBoxSelection,
  selectEntity,
  setLastZoneOpacity,
  setZoneShapeMode
} from "../../interaction/interactionState";
import type { SelectableEntityType } from "../../interaction/selection/types";
import { commitEncounterChange } from "../../store/encounterSlice";
import type { RootState } from "../../store/store";
import { CLOSE_ZONE_SHAPE_MENU_EVENT } from "../toolbar/events";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;
const CLOSE_DISTANCE = 16;
const MIN_SHAPE_SIZE = 8;
const CIRCLE_SEGMENTS = 60;
const CANVAS_BACKGROUND_COLOR = "#fffaf0";
const LOW_ZONE_OPACITY_THRESHOLD = 0.3;
const BACKGROUND_SAMPLE_COUNT = 20;

type VertexDragState = {
  hasMoved: boolean;
  polygon: LayoutPoint[];
  vertexIndex: number;
  zoneId: string;
};

type ShapeDraftState = {
  cloneSourceZoneId?: string;
  current: LayoutPoint;
  shape: Extract<ZoneShape, "rectangle" | "circle">;
  start: LayoutPoint;
};

type ZoneDragState = {
  current: LayoutPoint;
  hasMoved: boolean;
  originalPolygon: LayoutPoint[];
  start: LayoutPoint;
  zoneId: string;
};

type LocalBoxSelectionState = {
  current: LayoutPoint;
  start: LayoutPoint;
};

function distance(first: LayoutPoint, second: LayoutPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function toSvgPoint(
  event: MouseEvent<SVGSVGElement | SVGCircleElement>,
  svg: SVGSVGElement
): LayoutPoint {
  const bounds = svg.getBoundingClientRect();
  const width = bounds.width || CANVAS_WIDTH;
  const height = bounds.height || CANVAS_HEIGHT;
  const scale = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
  const renderedWidth = CANVAS_WIDTH * scale;
  const renderedHeight = CANVAS_HEIGHT * scale;
  const xOffset = (width - renderedWidth) / 2;
  const yOffset = (height - renderedHeight) / 2;

  return {
    x: (event.clientX - bounds.left - xOffset) / scale,
    y: (event.clientY - bounds.top - yOffset) / scale
  };
}

function polygonToPoints(polygon: LayoutPoint[]): string {
  return polygon.map((point) => `${point.x},${point.y}`).join(" ");
}

function isPointWithinCanvas(point: LayoutPoint): boolean {
  return (
    point.x >= 0 &&
    point.x <= CANVAS_WIDTH &&
    point.y >= 0 &&
    point.y <= CANVAS_HEIGHT
  );
}

function isPolygonWithinCanvas(polygon: LayoutPoint[]): boolean {
  return polygon.every(isPointWithinCanvas);
}

function createRectanglePolygon(start: LayoutPoint, current: LayoutPoint): LayoutPoint[] {
  return [
    start,
    { x: current.x, y: start.y },
    current,
    { x: start.x, y: current.y }
  ];
}

function createCirclePolygon(start: LayoutPoint, current: LayoutPoint): LayoutPoint[] {
  const center = {
    x: (start.x + current.x) / 2,
    y: (start.y + current.y) / 2
  };
  const radiusX = Math.abs(current.x - start.x) / 2;
  const radiusY = Math.abs(current.y - start.y) / 2;

  return Array.from({ length: CIRCLE_SEGMENTS }, (_, index) => {
    const angle = (index / CIRCLE_SEGMENTS) * Math.PI * 2;

    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY
    };
  });
}

function createShapePolygon(
  shape: Extract<ZoneShape, "rectangle" | "circle">,
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  return shape === "rectangle"
    ? createRectanglePolygon(start, current)
    : createCirclePolygon(start, current);
}

function getPaintableZoneProperties(zone: Zone): UpdateZonePropertiesInput {
  return {
    colorBorder: zone.colorBorder,
    colorFill: zone.colorFill,
    opacity: zone.opacity,
    showBorder: zone.showBorder
  };
}

function getCloneableZoneProperties(zone: Zone): Pick<
  CreateZoneInput,
  | "colorBorder"
  | "colorFill"
  | "layoutOrientation"
  | "layoutStrategy"
  | "namePosition"
  | "opacity"
  | "showBorder"
  | "showName"
  | "tags"
> {
  return {
    colorBorder: zone.colorBorder,
    colorFill: zone.colorFill,
    layoutOrientation: zone.layoutOrientation,
    layoutStrategy: zone.layoutStrategy,
    namePosition: zone.namePosition,
    opacity: zone.opacity,
    showBorder: zone.showBorder,
    showName: zone.showName,
    tags: zone.tags
  };
}

function createCirclePolygonFromBounds(bounds: ReturnType<typeof getPolygonBounds>) {
  return createCirclePolygon(
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
  );
}

function isPointInPolygon(point: LayoutPoint, polygon: LayoutPoint[]): boolean {
  return polygon.reduce((inside, current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x;

    return intersects ? !inside : inside;
  }, false);
}

function orientation(
  first: LayoutPoint,
  second: LayoutPoint,
  third: LayoutPoint
): number {
  return (
    (second.y - first.y) * (third.x - second.x) -
    (second.x - first.x) * (third.y - second.y)
  );
}

function isPointOnSegment(
  point: LayoutPoint,
  start: LayoutPoint,
  end: LayoutPoint
): boolean {
  return (
    Math.min(start.x, end.x) <= point.x &&
    point.x <= Math.max(start.x, end.x) &&
    Math.min(start.y, end.y) <= point.y &&
    point.y <= Math.max(start.y, end.y)
  );
}

function doSegmentsIntersect(
  firstStart: LayoutPoint,
  firstEnd: LayoutPoint,
  secondStart: LayoutPoint,
  secondEnd: LayoutPoint
): boolean {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);

  if (
    firstOrientation === 0 &&
    isPointOnSegment(secondStart, firstStart, firstEnd)
  ) {
    return true;
  }

  if (
    secondOrientation === 0 &&
    isPointOnSegment(secondEnd, firstStart, firstEnd)
  ) {
    return true;
  }

  if (
    thirdOrientation === 0 &&
    isPointOnSegment(firstStart, secondStart, secondEnd)
  ) {
    return true;
  }

  if (
    fourthOrientation === 0 &&
    isPointOnSegment(firstEnd, secondStart, secondEnd)
  ) {
    return true;
  }

  return (
    firstOrientation > 0 !== secondOrientation > 0 &&
    thirdOrientation > 0 !== fourthOrientation > 0
  );
}

function doBoundsOverlap(
  first: ReturnType<typeof getPolygonBounds>,
  second: ReturnType<typeof getPolygonBounds>
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function doPolygonsOverlap(first: LayoutPoint[], second: LayoutPoint[]): boolean {
  if (!doBoundsOverlap(getPolygonBounds(first), getPolygonBounds(second))) {
    return false;
  }

  const hasCrossingEdges = first.some((firstPoint, firstIndex) => {
    const firstNext = first[(firstIndex + 1) % first.length];

    return second.some((secondPoint, secondIndex) => {
      const secondNext = second[(secondIndex + 1) % second.length];

      return doSegmentsIntersect(firstPoint, firstNext, secondPoint, secondNext);
    });
  });

  return (
    hasCrossingEdges ||
    isPointInPolygon(first[0], second) ||
    isPointInPolygon(second[0], first)
  );
}

function resizeRectanglePolygon(
  polygon: LayoutPoint[],
  vertexIndex: number,
  point: LayoutPoint
): LayoutPoint[] {
  if (polygon.length !== 4) {
    return polygon.map((existingPoint, index) =>
      index === vertexIndex ? point : existingPoint
    );
  }

  const nextPolygon = [...polygon];

  if (vertexIndex === 0) {
    const opposite = polygon[2];

    nextPolygon[0] = point;
    nextPolygon[1] = { x: opposite.x, y: point.y };
    nextPolygon[2] = opposite;
    nextPolygon[3] = { x: point.x, y: opposite.y };
  }

  if (vertexIndex === 1) {
    const opposite = polygon[3];

    nextPolygon[0] = { x: opposite.x, y: point.y };
    nextPolygon[1] = point;
    nextPolygon[2] = { x: point.x, y: opposite.y };
    nextPolygon[3] = opposite;
  }

  if (vertexIndex === 2) {
    const opposite = polygon[0];

    nextPolygon[0] = opposite;
    nextPolygon[1] = { x: point.x, y: opposite.y };
    nextPolygon[2] = point;
    nextPolygon[3] = { x: opposite.x, y: point.y };
  }

  if (vertexIndex === 3) {
    const opposite = polygon[1];

    nextPolygon[0] = { x: point.x, y: opposite.y };
    nextPolygon[1] = opposite;
    nextPolygon[2] = { x: opposite.x, y: point.y };
    nextPolygon[3] = point;
  }

  return nextPolygon;
}

function resizeCirclePolygon(
  polygon: LayoutPoint[],
  handleIndex: number,
  point: LayoutPoint
): LayoutPoint[] {
  const bounds = getPolygonBounds(polygon);
  const nextBounds = { ...bounds };
  const maxX = bounds.x + bounds.width;
  const maxY = bounds.y + bounds.height;

  if (handleIndex === 0 || handleIndex === 1 || handleIndex === 7) {
    nextBounds.y = point.y;
    nextBounds.height = maxY - point.y;
  }

  if (handleIndex === 1 || handleIndex === 2 || handleIndex === 3) {
    nextBounds.width = point.x - bounds.x;
  }

  if (handleIndex === 3 || handleIndex === 4 || handleIndex === 5) {
    nextBounds.height = point.y - bounds.y;
  }

  if (handleIndex === 5 || handleIndex === 6 || handleIndex === 7) {
    nextBounds.x = point.x;
    nextBounds.width = maxX - point.x;
  }

  const normalizedBounds = {
    x:
      nextBounds.width >= 0
        ? nextBounds.x
        : nextBounds.x + nextBounds.width,
    y:
      nextBounds.height >= 0
        ? nextBounds.y
        : nextBounds.y + nextBounds.height,
    width: Math.max(Math.abs(nextBounds.width), MIN_SHAPE_SIZE),
    height: Math.max(Math.abs(nextBounds.height), MIN_SHAPE_SIZE)
  };

  return createCirclePolygonFromBounds(normalizedBounds);
}

function getZoneResizeHandles(zone: Zone, polygon: LayoutPoint[]): LayoutPoint[] {
  if (zone.shape === "circle") {
    const bounds = getPolygonBounds(polygon);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    return [
      { x: centerX, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: centerY },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: centerX, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x, y: centerY },
      { x: bounds.x, y: bounds.y }
    ];
  }

  return polygon;
}

function resizeZonePolygon(
  zone: Zone,
  polygon: LayoutPoint[],
  vertexIndex: number,
  point: LayoutPoint
): LayoutPoint[] {
  if (zone.shape === "rectangle") {
    return resizeRectanglePolygon(polygon, vertexIndex, point);
  }

  if (zone.shape === "circle") {
    return resizeCirclePolygon(polygon, vertexIndex, point);
  }

  return polygon.map((existingPoint, index) =>
    index === vertexIndex ? point : existingPoint
  );
}

function getPolygonBounds(polygon: LayoutPoint[]) {
  const xValues = polygon.map((point) => point.x);
  const yValues = polygon.map((point) => point.y);
  const x = Math.min(...xValues);
  const y = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  return {
    height: Math.max(maxY - y, 1),
    width: Math.max(maxX - x, 1),
    x,
    y
  };
}

function getBoxSelectionBounds(boxSelection: LocalBoxSelectionState) {
  return getPolygonBounds([
    boxSelection.start,
    { x: boxSelection.current.x, y: boxSelection.start.y },
    boxSelection.current,
    { x: boxSelection.start.x, y: boxSelection.current.y }
  ]);
}

function sortZoneIdsByPosition(zones: RootState["encounter"]["present"]["zones"]) {
  return [...zones.allIds].sort((firstId, secondId) => {
    const firstZone = zones.byId[firstId];
    const secondZone = zones.byId[secondId];

    if (!firstZone || !secondZone) {
      return firstId.localeCompare(secondId);
    }

    const firstBounds = getPolygonBounds(firstZone.polygon);
    const secondBounds = getPolygonBounds(secondZone.polygon);
    const horizontalDifference = firstBounds.x - secondBounds.x;

    if (horizontalDifference !== 0) {
      return horizontalDifference;
    }

    return firstBounds.y - secondBounds.y;
  });
}

function getZoneNamePosition(zone: Zone, polygon: LayoutPoint[]) {
  const bounds = getPolygonBounds(polygon);
  const inset = 10;

  if (zone.namePosition === "top-right") {
    return {
      anchor: "end" as const,
      dominantBaseline: "hanging" as const,
      x: bounds.x + bounds.width - inset,
      y: bounds.y + inset
    };
  }

  if (zone.namePosition === "bottom-right") {
    return {
      anchor: "end" as const,
      dominantBaseline: "auto" as const,
      x: bounds.x + bounds.width - inset,
      y: bounds.y + bounds.height - inset
    };
  }

  if (zone.namePosition === "bottom-left") {
    return {
      anchor: "start" as const,
      dominantBaseline: "auto" as const,
      x: bounds.x + inset,
      y: bounds.y + bounds.height - inset
    };
  }

  return {
    anchor: "start" as const,
    dominantBaseline: "hanging" as const,
    x: bounds.x + inset,
    y: bounds.y + inset
  };
}

function getReadableTextColor(backgroundColor: string): string {
  return getTextColorForLuminance(getHexLuminance(backgroundColor));
}

function getTextColorForLuminance(luminance: number): string {
  return luminance > 128 ? "#111827" : "#ffffff";
}

function getHexLuminance(backgroundColor: string): number {
  const normalizedColor = backgroundColor.replace("#", "");
  const red = Number.parseInt(normalizedColor.slice(0, 2), 16);
  const green = Number.parseInt(normalizedColor.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedColor.slice(4, 6), 16);

  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

function closeZoneShapeMenu() {
  window.dispatchEvent(new Event(CLOSE_ZONE_SHAPE_MENU_EVENT));
}

function createDeterministicSamplePoints(
  polygon: LayoutPoint[],
  sampleCount: number
): LayoutPoint[] {
  const bounds = getPolygonBounds(polygon);
  const points: LayoutPoint[] = [];
  let seed = Math.round(bounds.x * 13 + bounds.y * 17 + bounds.width * 19);

  for (let attempts = 0; points.length < sampleCount && attempts < sampleCount * 20; attempts += 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const xRatio = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const yRatio = seed / 4294967296;
    const point = {
      x: bounds.x + bounds.width * xRatio,
      y: bounds.y + bounds.height * yRatio
    };

    if (isPointInPolygon(point, polygon)) {
      points.push(point);
    }
  }

  return points.length > 0
    ? points
    : [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }];
}

export function CanvasShell() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
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
  const [zoneDraftPoints, setZoneDraftPoints] = useState<LayoutPoint[]>([]);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraftState | null>(null);
  const [vertexDrag, setVertexDrag] = useState<VertexDragState | null>(null);
  const [zoneDrag, setZoneDrag] = useState<ZoneDragState | null>(null);
  const [boxSelection, setBoxSelection] = useState<LocalBoxSelectionState | null>(
    null
  );
  const [backgroundLuminanceByZoneId, setBackgroundLuminanceByZoneId] =
    useState<Record<string, number>>({});
  const [polygonDraftBackgroundLuminance, setPolygonDraftBackgroundLuminance] =
    useState(getHexLuminance(CANVAS_BACKGROUND_COLOR));
  const suppressNextCanvasClickRef = useRef(false);
  const suppressNextCanvasClickPointRef = useRef<LayoutPoint | null>(null);
  const suppressNextEntityClickRef = useRef<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (
        event.key === "Delete" &&
        selection.selectedEntityType === "zone" &&
        selection.selectedIds.length > 0
      ) {
        event.preventDefault();

        const nextEncounter = selection.selectedIds.reduce(
          (currentEncounter, zoneId) => deleteZone(currentEncounter, zoneId),
          encounter
        );

        dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord("zone.delete", {
              zoneIds: selection.selectedIds
            }),
            nextEncounter
          })
        );
        dispatch(clearSelection());
        return;
      }

      if (
        event.key.toLowerCase() === "a" &&
        (event.ctrlKey || event.metaKey) &&
        (activeToolId === "zone" || activeToolId === "select")
      ) {
        event.preventDefault();
        dispatch(
          selectEntity({
            entityType: "zone",
            ids: encounter.zones.allIds
          })
        );
        return;
      }

      if (
        event.key === "Tab" &&
        selection.selectedEntityType === "zone" &&
        selection.selectedIds.length > 0
      ) {
        const sortedZoneIds = sortZoneIdsByPosition(encounter.zones);
        const selectedIndex = sortedZoneIds.indexOf(selection.selectedIds[0]);

        if (selectedIndex >= 0 && sortedZoneIds.length > 0) {
          event.preventDefault();
          const direction = event.shiftKey ? -1 : 1;
          const nextIndex =
            (selectedIndex + direction + sortedZoneIds.length) %
            sortedZoneIds.length;

          dispatch(
            selectEntity({
              entityType: "zone",
              ids: [sortedZoneIds[nextIndex]]
            })
          );
          return;
        }
      }

      if (event.key === "Escape" && zonePaintBrush) {
        event.preventDefault();
        dispatch(clearZonePaintBrush());
        return;
      }

      if (activeToolId !== "zone") {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        dispatch(clearZonePaintBrush());
        setShapeDraft(null);
        setZoneDraftPoints([]);
      }

      if (event.key === "1") {
        event.preventDefault();
        dispatch(setZoneShapeMode("rectangle"));
        closeZoneShapeMenu();
        setZoneDraftPoints([]);
      }

      if (event.key === "2") {
        event.preventDefault();
        dispatch(setZoneShapeMode("circle"));
        closeZoneShapeMenu();
        setZoneDraftPoints([]);
      }

      if (event.key === "3") {
        event.preventDefault();
        dispatch(setZoneShapeMode("polygon"));
        closeZoneShapeMenu();
        setShapeDraft(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeToolId,
    dispatch,
    encounter,
    selection.selectedEntityType,
    selection.selectedIds,
    zonePaintBrush
  ]);

  useEffect(() => {
    if (activeToolId !== "zone") {
      setShapeDraft(null);
      setVertexDrag(null);
      setZoneDraftPoints([]);
      setZoneDrag(null);
    }
  }, [activeToolId]);

  useEffect(() => {
    const backgroundTextZones = encounter.zones.allIds
      .map((zoneId) => encounter.zones.byId[zoneId])
      .filter(
        (zone): zone is Zone =>
          Boolean(zone) &&
          (zone.opacity < LOW_ZONE_OPACITY_THRESHOLD || zone.shape === "circle")
      );

    if (backgroundTextZones.length === 0) {
      setBackgroundLuminanceByZoneId({});
      return;
    }

    if (!backgroundImage) {
      const canvasLuminance = getHexLuminance(CANVAS_BACKGROUND_COLOR);

      setBackgroundLuminanceByZoneId(
        Object.fromEntries(
          backgroundTextZones.map((zone) => [zone.id, canvasLuminance])
        )
      );
      return;
    }

    let cancelled = false;
    const image = new Image();
    const fallbackLuminance = getHexLuminance(CANVAS_BACKGROUND_COLOR);

    image.addEventListener("error", () => {
      if (!cancelled) {
        setBackgroundLuminanceByZoneId(
          Object.fromEntries(
            backgroundTextZones.map((zone) => [zone.id, fallbackLuminance])
          )
        );
      }
    });

    image.addEventListener("load", () => {
      if (cancelled) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        return;
      }

      const imageWidth = image.naturalWidth || image.width || CANVAS_WIDTH;
      const imageHeight = image.naturalHeight || image.height || CANVAS_HEIGHT;
      const scale = Math.max(
        CANVAS_WIDTH / imageWidth,
        CANVAS_HEIGHT / imageHeight
      );
      const renderedWidth = imageWidth * scale;
      const renderedHeight = imageHeight * scale;
      const x = (CANVAS_WIDTH - renderedWidth) / 2;
      const y = (CANVAS_HEIGHT - renderedHeight) / 2;

      context.drawImage(image, x, y, renderedWidth, renderedHeight);

      const luminanceByZoneId = Object.fromEntries(
        backgroundTextZones.map((zone) => {
          const points = createDeterministicSamplePoints(
            zone.polygon,
            BACKGROUND_SAMPLE_COUNT
          );
          const luminance =
            points.reduce((total, point) => {
              const pixel = context.getImageData(
                Math.max(0, Math.min(CANVAS_WIDTH - 1, Math.floor(point.x))),
                Math.max(0, Math.min(CANVAS_HEIGHT - 1, Math.floor(point.y))),
                1,
                1
              ).data;

              return total + 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
            }, 0) / points.length;

          return [zone.id, luminance];
        })
      );

      if (!cancelled) {
        setBackgroundLuminanceByZoneId(luminanceByZoneId);
      }
    });
    image.src = backgroundImage.dataUrl;

    return () => {
      cancelled = true;
    };
  }, [backgroundImage, encounter.zones.allIds, encounter.zones.byId]);

  useEffect(() => {
    if (zoneDraftPoints.length === 0) {
      setPolygonDraftBackgroundLuminance(getHexLuminance(CANVAS_BACKGROUND_COLOR));
      return;
    }

    if (!backgroundImage) {
      setPolygonDraftBackgroundLuminance(getHexLuminance(CANVAS_BACKGROUND_COLOR));
      return;
    }

    let cancelled = false;
    const image = new Image();
    const fallbackLuminance = getHexLuminance(CANVAS_BACKGROUND_COLOR);

    image.addEventListener("error", () => {
      if (!cancelled) {
        setPolygonDraftBackgroundLuminance(fallbackLuminance);
      }
    });

    image.addEventListener("load", () => {
      if (cancelled) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        setPolygonDraftBackgroundLuminance(fallbackLuminance);
        return;
      }

      const imageWidth = image.naturalWidth || image.width || CANVAS_WIDTH;
      const imageHeight = image.naturalHeight || image.height || CANVAS_HEIGHT;
      const scale = Math.max(
        CANVAS_WIDTH / imageWidth,
        CANVAS_HEIGHT / imageHeight
      );
      const renderedWidth = imageWidth * scale;
      const renderedHeight = imageHeight * scale;
      const x = (CANVAS_WIDTH - renderedWidth) / 2;
      const y = (CANVAS_HEIGHT - renderedHeight) / 2;

      context.drawImage(image, x, y, renderedWidth, renderedHeight);

      const samplePoints =
        zoneDraftPoints.length >= 3
          ? createDeterministicSamplePoints(zoneDraftPoints, BACKGROUND_SAMPLE_COUNT)
          : zoneDraftPoints;
      const luminance =
        samplePoints.reduce((total, point) => {
          const pixel = context.getImageData(
            Math.max(0, Math.min(CANVAS_WIDTH - 1, Math.floor(point.x))),
            Math.max(0, Math.min(CANVAS_HEIGHT - 1, Math.floor(point.y))),
            1,
            1
          ).data;

          return total + 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
        }, 0) / samplePoints.length;

      if (!cancelled) {
        setPolygonDraftBackgroundLuminance(luminance);
      }
    });
    image.src = backgroundImage.dataUrl;

    return () => {
      cancelled = true;
    };
  }, [backgroundImage, zoneDraftPoints]);

  function doesZoneOverlapExisting(
    polygon: LayoutPoint[],
    ignoredZoneId?: string
  ): boolean {
    return encounter.zones.allIds.some((zoneId) => {
      const zone = encounter.zones.byId[zoneId];

      return (
        zone &&
        zone.id !== ignoredZoneId &&
        doPolygonsOverlap(polygon, zone.polygon)
      );
    });
  }

  function canCommitZonePolygon(
    polygon: LayoutPoint[],
    ignoredZoneId?: string
  ): boolean {
    return (
      isPolygonWithinCanvas(polygon) &&
      !doesZoneOverlapExisting(polygon, ignoredZoneId)
    );
  }

  function commitZoneCreate(
    polygon: LayoutPoint[],
    shape: ZoneShape,
    suppressClickPoint?: LayoutPoint,
    cloneSourceZoneId?: string
  ) {
    if (!canCommitZonePolygon(polygon)) {
      setZoneDraftPoints([]);
      return;
    }

    const zoneId = `zone-${Date.now()}`;
    const cloneSourceZone = cloneSourceZoneId
      ? encounter.zones.byId[cloneSourceZoneId]
      : undefined;
    const nextEncounter = createZone(encounter, {
      ...(cloneSourceZone ? getCloneableZoneProperties(cloneSourceZone) : {}),
      id: zoneId,
      name: `Zone ${encounter.zones.allIds.length + 1}`,
      opacity: cloneSourceZone ? cloneSourceZone.opacity : lastZoneOpacity,
      polygon,
      shape
    });

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.create", {
          ...(cloneSourceZoneId ? { cloneSourceZoneId } : {}),
          zoneId,
          polygon,
          shape
        }),
        nextEncounter
      })
    );
    dispatch(
      selectEntity({
        entityType: "zone",
        ids: [zoneId]
      })
    );
    suppressNextCanvasClickRef.current = true;
    suppressNextCanvasClickPointRef.current =
      suppressClickPoint ?? polygon[polygon.length - 1] ?? null;
    setZoneDraftPoints([]);
  }

  function getDisplayedPolygon(zone: Zone): LayoutPoint[] {
    if (zoneDrag?.zoneId === zone.id) {
      const offset = {
        x: zoneDrag.current.x - zoneDrag.start.x,
        y: zoneDrag.current.y - zoneDrag.start.y
      };

      return zoneDrag.originalPolygon.map((point) => ({
        x: point.x + offset.x,
        y: point.y + offset.y
      }));
    }

    return vertexDrag?.zoneId === zone.id ? vertexDrag.polygon : zone.polygon;
  }

  const polygonDraftColor = getTextColorForLuminance(
    polygonDraftBackgroundLuminance
  );

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    const target = event.target as Element;
    const entityElement = target.closest<SVGElement>("[data-entity-id]");
    const entityId = entityElement?.dataset.entityId;
    const entityType = entityElement?.dataset
      .entityType as SelectableEntityType | undefined;

    if (suppressNextEntityClickRef.current === entityId) {
      suppressNextEntityClickRef.current = null;
      suppressNextCanvasClickRef.current = false;
      suppressNextCanvasClickPointRef.current = null;
      return;
    }

    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false;
      const suppressedPoint = suppressNextCanvasClickPointRef.current;
      suppressNextCanvasClickPointRef.current = null;

      if (
        !entityId &&
        suppressedPoint &&
        distance(toSvgPoint(event, event.currentTarget), suppressedPoint) <= 1
      ) {
        return;
      }
    }

    if (event.detail > 1 || vertexDrag || zoneDrag || shapeDraft || boxSelection) {
      return;
    }

    if (zonePaintBrush) {
      if (!entityId || entityType !== "zone") {
        return;
      }

      const sourceZone = encounter.zones.byId[zonePaintBrush.sourceZoneId];

      if (!sourceZone) {
        dispatch(clearZonePaintBrush());
        return;
      }

      const paintProperties = getPaintableZoneProperties(sourceZone);
      const nextEncounter = updateZoneProperties(
        encounter,
        entityId,
        paintProperties
      );

      if (nextEncounter !== encounter) {
        dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord("zone.paintColors", {
              properties: paintProperties,
              sourceZoneId: sourceZone.id,
              zoneId: entityId
            }),
            nextEncounter
          })
        );
        dispatch(setLastZoneOpacity(sourceZone.opacity));
      }
      return;
    }

    if (!entityId && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      return;
    }

    if (!entityId && activeToolId === "zone" && zoneShapeMode === "polygon") {
      dispatch(clearSelection());
      closeZoneShapeMenu();
      const nextPoint = toSvgPoint(event, event.currentTarget);

      if (!isPointWithinCanvas(nextPoint)) {
        return;
      }

      const startPoint = zoneDraftPoints[0];

      if (
        startPoint &&
        zoneDraftPoints.length >= 3 &&
        distance(startPoint, nextPoint) <= CLOSE_DISTANCE
      ) {
        commitZoneCreate(zoneDraftPoints, "polygon");
        return;
      }

      const nextPoints = [...zoneDraftPoints, nextPoint];

      if (
        (nextPoints.length >= 3 && !isPolygonWithinCanvas(nextPoints)) ||
        doesZoneOverlapExisting(nextPoints)
      ) {
        return;
      }

      setZoneDraftPoints(nextPoints);
      return;
    }

    if (!entityId || !entityType) {
      dispatch(clearSelection());
      return;
    }

    dispatch(
      selectEntity({
        entityType,
        ids: [entityId],
        toggle: event.shiftKey || event.ctrlKey || event.metaKey
      })
    );
  }

  function handleCanvasDoubleClick(event: MouseEvent<SVGSVGElement>) {
    if (activeToolId !== "zone" || vertexDrag || zoneShapeMode !== "polygon") {
      return;
    }

    const point = toSvgPoint(event, event.currentTarget);
    const polygon = [...zoneDraftPoints, point];

    if (polygon.length >= 3 && canCommitZonePolygon(polygon)) {
      commitZoneCreate(polygon, "polygon");
    }
  }

  function handleCanvasContextMenu(event: MouseEvent<SVGSVGElement>) {
    if (zonePaintBrush) {
      event.preventDefault();
      dispatch(clearZonePaintBrush());
      return;
    }

    if (
      activeToolId === "zone" &&
      zoneShapeMode === "polygon" &&
      zoneDraftPoints.length > 0
    ) {
      event.preventDefault();
      setZoneDraftPoints((points) => points.slice(0, -1));
    }
  }

  function handleCanvasMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (shapeDraft) {
      setShapeDraft({
        ...shapeDraft,
        current: toSvgPoint(event, event.currentTarget)
      });
      return;
    }

    if (boxSelection) {
      setBoxSelection({
        ...boxSelection,
        current: toSvgPoint(event, event.currentTarget)
      });
      return;
    }

    if (zoneDrag) {
      const current = toSvgPoint(event, event.currentTarget);

      setZoneDrag({
        ...zoneDrag,
        current,
        hasMoved: zoneDrag.hasMoved || distance(zoneDrag.start, current) >= 1
      });
      return;
    }

    if (!vertexDrag) {
      return;
    }

    const point = toSvgPoint(event, event.currentTarget);
    const zone = encounter.zones.byId[vertexDrag.zoneId];

    if (!zone) {
      setVertexDrag(null);
      return;
    }

    const polygon = resizeZonePolygon(
      zone,
      vertexDrag.polygon,
      vertexDrag.vertexIndex,
      point
    );

    setVertexDrag({
      ...vertexDrag,
      hasMoved: vertexDrag.hasMoved || distance(vertexDrag.polygon[vertexDrag.vertexIndex], point) >= 1,
      polygon
    });
  }

  function handleCanvasMouseUp() {
    if (shapeDraft) {
      const polygon = createShapePolygon(
        shapeDraft.shape,
        shapeDraft.start,
        shapeDraft.current
      );

      if (distance(shapeDraft.start, shapeDraft.current) >= MIN_SHAPE_SIZE) {
        commitZoneCreate(
          polygon,
          shapeDraft.shape,
          shapeDraft.current,
          shapeDraft.cloneSourceZoneId
        );
      }

      setShapeDraft(null);
      return;
    }

    if (boxSelection) {
      const bounds = getBoxSelectionBounds(boxSelection);
      const selectedZoneIds = encounter.zones.allIds.filter((zoneId) => {
        const zone = encounter.zones.byId[zoneId];

        return zone && doBoundsOverlap(bounds, getPolygonBounds(zone.polygon));
      });

      dispatch(
        finishBoxSelection({
          additive: true,
          entityType: "zone",
          ids: selectedZoneIds
        })
      );
      setBoxSelection(null);
      suppressNextCanvasClickRef.current = true;
      return;
    }

    if (zoneDrag) {
      if (zoneDrag.hasMoved) {
        const nextPolygon = getDisplayedPolygon(
          encounter.zones.byId[zoneDrag.zoneId]
        );

        if (!canCommitZonePolygon(nextPolygon, zoneDrag.zoneId)) {
          setZoneDrag(null);
          return;
        }

        const nextEncounter = updateZonePolygon(
          encounter,
          zoneDrag.zoneId,
          nextPolygon
        );

        dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord("zone.move", {
              polygon: nextPolygon,
              zoneId: zoneDrag.zoneId
            }),
            nextEncounter
          })
        );
        dispatch(
          selectEntity({
            entityType: "zone",
            ids: [zoneDrag.zoneId]
          })
        );
      }

      setZoneDrag(null);
      return;
    }

    if (!vertexDrag) {
      return;
    }

    const resizedZone = encounter.zones.byId[vertexDrag.zoneId];
    const resizeHandles = resizedZone
      ? getZoneResizeHandles(resizedZone, vertexDrag.polygon)
      : [];

    suppressNextCanvasClickRef.current = true;
    suppressNextCanvasClickPointRef.current =
      resizeHandles[vertexDrag.vertexIndex] ?? null;

    if (!vertexDrag.hasMoved) {
      setVertexDrag(null);
      return;
    }

    if (!canCommitZonePolygon(vertexDrag.polygon, vertexDrag.zoneId)) {
      setVertexDrag(null);
      return;
    }

    const nextEncounter = updateZonePolygon(
      encounter,
      vertexDrag.zoneId,
      vertexDrag.polygon
    );

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.reshape", {
          polygon: vertexDrag.polygon,
          zoneId: vertexDrag.zoneId
        }),
        nextEncounter
      })
    );
    dispatch(
      selectEntity({
        entityType: "zone",
        ids: [vertexDrag.zoneId]
      })
    );
    setVertexDrag(null);
  }

  function handleCanvasMouseDown(event: MouseEvent<SVGSVGElement>) {
    if (zonePaintBrush) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const target = event.target as Element;
    const entityElement = target.closest<SVGElement>("[data-entity-id]");
    const entityId = entityElement?.dataset.entityId;
    const entityType = entityElement?.dataset
      .entityType as SelectableEntityType | undefined;
    const point = toSvgPoint(event, event.currentTarget);

    if (
      !entityId &&
      event.shiftKey &&
      (activeToolId === "zone" || activeToolId === "select")
    ) {
      event.preventDefault();
      closeZoneShapeMenu();
      setBoxSelection({
        current: point,
        start: point
      });
      return;
    }

    if (activeToolId !== "zone") {
      return;
    }

    if (entityType === "zone" && entityId && encounter.zones.byId[entityId]) {
      closeZoneShapeMenu();
      dispatch(
        selectEntity({
          entityType: "zone",
          ids: [entityId],
          toggle: event.shiftKey || event.ctrlKey || event.metaKey
        })
      );
      suppressNextCanvasClickRef.current = true;
      suppressNextEntityClickRef.current = entityId;
      if (event.ctrlKey || event.metaKey) {
        setZoneDraftPoints([]);
        return;
      }
      setZoneDraftPoints([]);
      setZoneDrag({
        current: point,
        hasMoved: false,
        originalPolygon: encounter.zones.byId[entityId].polygon,
        start: point,
        zoneId: entityId
      });
      return;
    }

    if (!entityId && zoneShapeMode !== "polygon") {
      event.preventDefault();
      closeZoneShapeMenu();
      const cloneSourceZoneId =
        (event.ctrlKey || event.metaKey) &&
        selection.selectedEntityType === "zone"
          ? selection.selectedIds[0]
          : undefined;

      dispatch(clearSelection());
      setShapeDraft({
        cloneSourceZoneId,
        current: point,
        shape: zoneShapeMode,
        start: point
      });
    }
  }

  return (
    <section
      aria-label="Encounter canvas"
      className="relative min-h-0 overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm"
      role="main"
    >
      <svg
        aria-label="SVG encounter workspace"
        className="h-full min-h-0 w-full bg-[#fffaf0]"
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
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
              <>
                <rect fill="#fffaf0" height="640" width="960" />
                {backgroundImage ? (
                  <image
                    aria-label="Canvas background image"
                    height="640"
                    href={backgroundImage.dataUrl}
                    preserveAspectRatio="xMidYMid slice"
                    width="960"
                    x="0"
                    y="0"
                  />
                ) : null}
              </>
            ) : null}
            {layer.id === "zones"
              ? encounter.zones.allIds.map((zoneId) => {
                  const zone = encounter.zones.byId[zoneId];

                  if (!zone) {
                    return null;
                  }

                  const polygon = getDisplayedPolygon(zone);
                  const selected =
                    selection.selectedEntityType === "zone" &&
                    selection.selectedIds.includes(zone.id);
                  const resizeHandles = getZoneResizeHandles(zone, polygon);
                  const namePosition = getZoneNamePosition(zone, polygon);
                  const zoneNameTextColor =
                    zone.shape === "circle" ||
                    zone.opacity < LOW_ZONE_OPACITY_THRESHOLD
                      ? getTextColorForLuminance(
                          backgroundLuminanceByZoneId[zone.id] ??
                            getHexLuminance(CANVAS_BACKGROUND_COLOR)
                        )
                      : getReadableTextColor(zone.colorFill);

                  return (
                    <g key={zone.id}>
                      <polygon
                        aria-label={zone.name}
                        className="cursor-pointer"
                        data-entity-id={zone.id}
                        data-entity-type="zone"
                        fill={zone.colorFill}
                        fillOpacity={zone.opacity}
                        points={polygonToPoints(polygon)}
                        stroke={zone.showBorder ? zone.colorBorder : "transparent"}
                        strokeWidth={zone.showBorder ? 2 : 0}
                      />
                      {selected ? (
                        <polygon
                          className="pointer-events-none fill-none stroke-canvas-ink stroke-2"
                          points={polygonToPoints(polygon)}
                          strokeDasharray="8 8"
                        />
                      ) : null}
                      {zone.showName ? (
                        <text
                          className="pointer-events-none text-xs font-bold"
                          dominantBaseline={namePosition.dominantBaseline}
                          fill={zoneNameTextColor}
                          textAnchor={namePosition.anchor}
                          x={namePosition.x}
                          y={namePosition.y}
                        >
                          {zone.name}
                        </text>
                      ) : null}
                      {selected && activeToolId === "zone"
                        ? resizeHandles.map((point, vertexIndex) => (
                            <circle
                              key={`${zone.id}-${vertexIndex}`}
                              aria-label={`${zone.name} vertex ${vertexIndex + 1}`}
                              className="cursor-move fill-canvas-ink stroke-white stroke-2"
                              cx={point.x}
                              cy={point.y}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                closeZoneShapeMenu();
                                suppressNextCanvasClickRef.current = true;
                                setVertexDrag({
                                  hasMoved: false,
                                  polygon,
                                  vertexIndex,
                                  zoneId: zone.id
                                });
                              }}
                              r="6"
                            />
                          ))
                        : null}
                    </g>
                  );
                })
              : null}
            {layer.id === "uiOverlays"
              ? [
                  zoneDraftPoints.length > 0 ? (
                    <g key="zone-draft" aria-label="Zone draft">
                      <polyline
                        className="fill-none stroke-2"
                        points={polygonToPoints(zoneDraftPoints)}
                        stroke={polygonDraftColor}
                        strokeDasharray="8 8"
                      />
                      {zoneDraftPoints.map((point, index) => (
                        <circle
                          key={`${point.x}-${point.y}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          fill={polygonDraftColor}
                          r={index === 0 ? 6 : 4}
                        />
                      ))}
                    </g>
                  ) : null,
                  shapeDraft ? (
                    <polygon
                      key="zone-shape-draft"
                      aria-label={`${zoneShapeMode} zone draft`}
                      className="fill-green-200/40 stroke-canvas-ink stroke-2"
                      points={polygonToPoints(
                        createShapePolygon(
                          shapeDraft.shape,
                          shapeDraft.start,
                          shapeDraft.current
                        )
                      )}
                      strokeDasharray="8 8"
                    />
                  ) : null,
                  boxSelection ? (
                    <rect
                      key="zone-box-selection"
                      aria-label="Zone box selection"
                      className="fill-blue-200/20 stroke-canvas-ink stroke-2"
                      height={getBoxSelectionBounds(boxSelection).height}
                      strokeDasharray="6 6"
                      width={getBoxSelectionBounds(boxSelection).width}
                      x={getBoxSelectionBounds(boxSelection).x}
                      y={getBoxSelectionBounds(boxSelection).y}
                    />
                  ) : null
                ]
              : null}
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-canvas-line bg-canvas-panel/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-canvas-muted">
        {activeToolId === "zone"
          ? `Zone shape: ${zoneShapeMode}`
          : "Canvas scaffold"}
      </div>
    </section>
  );
}
