import { EdgeArrowMarkers } from "./EdgeArrowMarkers";
import { useEdgeRouteMotion } from "./useEdgeRouteMotion";
import type { PathSpace } from "@entities/edge/edgePathCollision";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { getCardinalPathArrowAngle } from "@entities/edge/edgeBoundaryGeometry";
import { motion, useMotionValueEvent } from "motion/react";
import { useCallback, useLayoutEffect, useState } from "react";

import type { LayoutPoint } from "@core/layout/types";
import { SelectionOutline, type SelectionOutlineMode } from "@core/rendering/SelectionOutline";
import { useEdgeRouteEditing } from "./useEdgeRouteEditing";
import type { EdgeRoutePreferences } from "@entities/edge/types";
import type { Edge } from "@entities/edge/types";
import { EdgeBadges } from "./EdgeBadges";

type Props = {
  gridAligned?: boolean;
  routePending?: boolean;
  editable: boolean;
  getPath: (preferences: EdgeRoutePreferences) => string | undefined;
  baselineData: string;
  curvaturePolygons: LayoutPoint[][];
  curveSpace: PathSpace;
  edge: Edge;
  pathData: string;
  edgeColor: string;
  dash?: string;
  markerStart?: string;
  fromName: string;
  toName: string;
  preview: boolean;
  selected: boolean;
  selectionMode: SelectionOutlineMode;
  badgeFraction: number;
  fallbackBadgePoint?: LayoutPoint;
};

/** Badges follow the rendered path, including its curvature and geometry animation. */
export function EdgeRouteVisual({ edge, pathData, edgeColor, dash, markerStart, fromName, toName, preview, selected, selectionMode, badgeFraction, fallbackBadgePoint, editable, getPath, baselineData, curvaturePolygons, curveSpace, gridAligned, routePending = false }: Props) {
  const { edgeThickness } = useInterfacePreferences();
  const strokeWidth = edgeThickness + (selected ? 1 : 0);
  const editing = useEdgeRouteEditing({ edge, enabled: editable, getPath, baselineData, curvaturePolygons, curveSpace });
  const displayedPath = editing.pathData ?? pathData;
  const animatedPath = useEdgeRouteMotion(displayedPath, editing.dragging, routePending);
  // Keep a curve's midpoint handle accessible when its badge uses the same midpoint.
  const displayedBadgeFraction = editing.editable && edge.shape === "curved" ? Math.min(0.85, badgeFraction + 0.15) : badgeFraction;
  const [badgePoint, setBadgePoint] = useState<LayoutPoint>();
  const updateBadge = useCallback((data: string) => {
    // Motion's update runs before it writes the next d attribute to the DOM.
    // Measure the supplied geometry rather than the previous frame's path.
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", data);
    // Some DOM environments do not expose SVG geometry measurement.
    if (!path?.getTotalLength || !path.getPointAtLength) return;
    const position = path.getPointAtLength(path.getTotalLength() * displayedBadgeFraction);
    setBadgePoint(current => current?.x === position.x && current.y === position.y
      ? current : { x: position.x, y: position.y });
  }, [displayedBadgeFraction]);
  useMotionValueEvent(animatedPath, "change", updateBadge);
  useLayoutEffect(() => updateBadge(animatedPath.get()), [animatedPath, updateBadge]);
  const point = badgePoint ?? fallbackBadgePoint;

  const coordinates = edge.shape === "rightAngled" ? displayedPath.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [] : [];
  const arrowAngle = (direction: LayoutPoint) => gridAligned ? Math.atan2(direction.y, direction.x) * 180 / Math.PI : getCardinalPathArrowAngle(direction);
  const endAngle = coordinates.length >= 4 ? arrowAngle({ x: coordinates.at(-2)! - coordinates.at(-4)!, y: coordinates.at(-1)! - coordinates.at(-3)! }) : "auto";
  const startAngle = coordinates.length >= 4 ? arrowAngle({ x: coordinates[0] - coordinates[2], y: coordinates[1] - coordinates[3] }) : "auto-start-reverse";
  return <>
    <EdgeArrowMarkers id={edge.id} color={edgeColor} thickness={edgeThickness} startAngle={startAngle} endAngle={endAngle} />
    <SelectionOutline mode={selected && !preview ? selectionMode : "static"} pointerEvents="auto">
      <g opacity={preview ? 0.6 : 1}>
      <motion.path
        d={animatedPath}
        aria-label={`${edge.directionality} edge from ${fromName} to ${toName}`}
        className={`${preview ? "pointer-events-none" : "cursor-pointer"} fill-none`}
        data-entity-id={preview ? undefined : edge.id}
        data-entity-type={preview ? undefined : "edge"}
        initial={false}
        markerEnd={`url(#edge-arrow-end-${edge.id})`}
        markerStart={markerStart}
        stroke={edgeColor}
        strokeDasharray={dash}
        strokeWidth={strokeWidth}
      />
      </g>
    </SelectionOutline>
    {!preview ? <motion.path className="cursor-pointer fill-none stroke-transparent" d={animatedPath} data-entity-id={edge.id} data-entity-type="edge" strokeWidth={Math.max(14, strokeWidth + 8)}
      onClick={editing.click}
      onPointerDown={event => editing.begin(event)} onPointerMove={editing.move}
      onPointerUp={event => editing.end(event)} onPointerCancel={event => editing.end(event, true)} onLostPointerCapture={event => editing.end(event, true)}
      onMouseDown={event => { if (editing.editable) event.stopPropagation(); }}
      style={{ touchAction: editing.editable ? "none" : undefined }} /> : null}
    {point && !preview ? <motion.g initial={false} animate={{ x: point.x, y: point.y }} transition={{ duration: 0 }}>
      <EdgeBadges edge={edge} edgeColor={edgeColor} point={{ x: 0, y: 0 }} />
    </motion.g> : null}
    {editing.editable ? editing.handles.map((handle, index) => <g key={index}
      data-touch-tooltip-label={`Drag to adjust curvature (${editing.curvaturePercent}%)`} aria-label={`Curve adjustment ${index + 1}: ${editing.curvaturePercent}%`}
      className="group cursor-grab focus-visible:outline-none" tabIndex={0}
      data-entity-id={edge.id} data-entity-type="edge" onClick={editing.click}
      onPointerDown={event => editing.begin(event, handle)} onPointerMove={editing.move}
      onPointerUp={event => editing.end(event)} onPointerCancel={event => editing.end(event, true)} onLostPointerCapture={event => editing.end(event, true)}
      onMouseDown={event => event.stopPropagation()} style={{ touchAction: "none" }}>
      <title>{`Drag to adjust curvature (${editing.curvaturePercent}%)`}</title>
      <motion.text initial={false} animate={{ x: handle.point.x, y: handle.point.y - 14 }} transition={{ duration: 0 }}
        className="pointer-events-none fill-canvas-ink stroke-canvas-panel text-[10px] font-semibold"
        strokeWidth={2} style={{ paintOrder: "stroke" }} textAnchor="middle" aria-label="Curvature percentage">{editing.curvaturePercent}%</motion.text>
      <motion.polygon initial={false} transition={{ duration: 0 }} animate={{ points: `${handle.point.x},${handle.point.y - 6} ${handle.point.x + 6},${handle.point.y} ${handle.point.x},${handle.point.y + 6} ${handle.point.x - 6},${handle.point.y}` }}
        className="fill-canvas-panel stroke-canvas-ink group-hover:fill-canvas-muted group-focus-visible:fill-canvas-muted" strokeWidth={2} />
      <motion.circle initial={false} transition={{ duration: 0 }} animate={{ cx: handle.point.x, cy: handle.point.y }} r={12} fill="transparent" />
    </g>) : null}
  </>;
}
