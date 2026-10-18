import { runEncounterOperation } from "@core/history/encounterOperations";
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { LayoutPoint } from '@core/layout/types';
import { translateSnappedZone } from '@core/movement/zoneVertexSnapping';
import type { CanvasInteractionState, ZoneDragState } from '@ui/canvas/canvasInteractionTypes';
import { toSvgPoint } from '@ui/canvas/zones/zoneGeometry';
import { TOUCH_NAVIGATION_START_EVENT } from '@ui/canvas/useCanvasTouchGestures';
import { handleZoneMouseUp } from './zoneMouseUp';
import { rebaseZoneActorPlacements } from '@ui/canvas/actors/rebaseZoneActorPlacements';

/** New gestures own their visible origin and invalidate older pending drops. */
export function useZoneMoveGesture(input: CanvasInteractionState) {
  const latest = useRef(input), cleanup = useRef<() => void>();
  useLayoutEffect(() => { latest.current = input; });
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => { if (input.activeToolId !== 'zone') cleanup.current?.(); }, [input.activeToolId]);

  return (zoneId: string, point: LayoutPoint, element: SVGElement | undefined, pointerType?: string) => {
    cleanup.current?.();
    const { canvasRef, zoneGestureRevisionRef } = latest.current;
    const encounter = latest.current.dispatch((_dispatch, getState) => getState().encounter.present);
    const zone = encounter.zones.byId[zoneId], svg = canvasRef.current;
    if (!zone || !svg) return;
    const revision = ++zoneGestureRevisionRef.current;
    const pending = latest.current.zoneDrag;
    const releasedResize = latest.current.pendingZoneReshapeRef?.current;
    const pendingResize = releasedResize?.encounterId === encounter.id ? releasedResize : null;
    const originalPolygon = pendingResize?.zoneId === zoneId ? pendingResize.polygon
      : pending?.zoneId === zoneId && pending.previewPolygon ? pending.previewPolygon : zone.polygon;
    latest.current.setVertexDrag(null);
    let visible = originalPolygon[0];
    const coordinates = element?.getAttribute('points')?.trim().split(/[\s,]+/).map(Number);
    const rootMatrix = svg.getScreenCTM?.(), matrix = (element as SVGGraphicsElement | undefined)?.getScreenCTM?.();
    if (coordinates && coordinates.length >= 2 && rootMatrix && matrix) {
      const mapped = new DOMPoint(coordinates[0], coordinates[1]).matrixTransform(matrix).matrixTransform(rootMatrix.inverse());
      visible = { x: mapped.x, y: mapped.y };
    }
    const offset = { x: visible.x - originalPolygon[0].x, y: visible.y - originalPolygon[0].y };
    let draft: ZoneDragState = { gestureId: revision, zoneId, originalPolygon, sourcePolygon: zone.polygon,
      start: point, current: { x: point.x + offset.x, y: point.y + offset.y }, hasMoved: false, phase: 'dragging' };
    latest.current.setZoneDrag(draft);
    let active = true;
    // Accept the released resize without allowing it to replace this gesture.
    if (pendingResize) void pendingResize.completion.then(base => {
      if (!active || zoneGestureRevisionRef.current !== revision || !base?.zones.byId[zoneId]) return;
      const polygon = base.zones.byId[zoneId].polygon;
      draft = { ...draft, originalPolygon: polygon, sourcePolygon: polygon };
      latest.current.setZoneDrag(draft);
    });
    const move = (event: globalThis.MouseEvent | globalThis.PointerEvent) => {
      if (!active || zoneGestureRevisionRef.current !== revision) return;
      const next = toSvgPoint(event, svg);
      draft = { ...draft, current: { x: next.x + offset.x, y: next.y + offset.y },
        hasMoved: draft.hasMoved || Math.hypot(next.x - point.x, next.y - point.y) >= 1 };
      latest.current.setZoneDrag(draft);
    };
    const cancel = () => { remove(); if (zoneGestureRevisionRef.current === revision) { ++zoneGestureRevisionRef.current; latest.current.setZoneDrag(null); } };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const up = (event: globalThis.MouseEvent | globalThis.PointerEvent) => {
      if (!active || event.button !== 0) return;
      remove();
      if (zoneGestureRevisionRef.current !== revision) return;
      const current = latest.current;
      if (draft.hasMoved) {
        current.suppressNextCanvasClickRef.current = true;
        current.suppressNextCanvasClickUnconditionallyRef.current = true;
      }
      if (!draft.hasMoved && pending?.zoneId === zoneId && pending.previewPolygon) {
        draft = { ...draft, hasMoved: true, current: draft.start };
      }
      const finish = (base?: typeof encounter | null) => current.dispatch((_dispatch, getState) => {
        if (zoneGestureRevisionRef.current !== revision) return;
        const encounter = getState().encounter.present;
        if (base === null || encounter.id !== current.encounter.id || (base && encounter !== base)) {
          latest.current.setZoneDrag(null); return;
        }
        const zone = encounter.zones.byId[zoneId];
        if (!zone) { latest.current.setZoneDrag(null); return; }
        if (pendingResize) draft = { ...draft, originalPolygon: zone.polygon, sourcePolygon: zone.polygon };
        const rendered = latest.current;
        const renderedZone = rendered.encounter.zones.byId[zoneId];
        // Redux can accept a resize before React publishes the matching render.
        // Rebase that render's frozen Actor points before finalizing this move.
        const actorRenderPlacements = renderedZone && encounter.movementRules.zoneLocked
          ? rebaseZoneActorPlacements(rendered.actorRenderPlacements, zoneId, renderedZone.polygon, zone.polygon)
          : rendered.actorRenderPlacements;
        handleZoneMouseUp({ ...rendered, encounter, actorRenderPlacements, zoneDrag: draft,
          getDisplayedPolygon: candidate => translateSnappedZone(encounter,
            { ...candidate, polygon: draft.originalPolygon }, { x: draft.current.x - draft.start.x, y: draft.current.y - draft.start.y }) });
      });
      if (pendingResize) {
        const previewPolygon = translateSnappedZone(current.encounter, { ...zone, polygon: draft.originalPolygon },
          { x: draft.current.x - draft.start.x, y: draft.current.y - draft.start.y });
        latest.current.setZoneDrag({ ...draft, phase: 'validating', previewPolygon });
        void runEncounterOperation(() => pendingResize.completion.then(finish, () => finish(null)));
      } else finish();
    };
    const moveEvent = pointerType && pointerType !== 'mouse' ? 'pointermove' : 'mousemove';
    const upEvent = pointerType && pointerType !== 'mouse' ? 'pointerup' : 'mouseup';
    function remove() {
      active = false;
      window.removeEventListener(moveEvent, move);
      window.removeEventListener(upEvent, up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel);
      window.removeEventListener(TOUCH_NAVIGATION_START_EVENT, cancel);
    }
    cleanup.current = remove;
    window.addEventListener(moveEvent, move);
    window.addEventListener(upEvent, up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    window.addEventListener(TOUCH_NAVIGATION_START_EVENT, cancel);
  };
}
