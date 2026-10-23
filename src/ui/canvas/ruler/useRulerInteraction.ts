import { coneAngleHandle, draggedConeAngle, type ConeAngleHandleGeometry } from '@core/measurement/coneAngleHandle';
import type { RootState } from '@store/store';
import { selectRulerDraft } from '@interaction/rulerState';
import { useRulerDragFrame } from './useRulerDragFrame';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import type { PointerEvent } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { RulerDraft, RulerOptions } from '@core/measurement/types';
import { snapRulerOrigin, rulerSnapEnabled } from '@core/measurement/areaGeometry';
import { gridToWorld, worldToGrid, snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { lockRulerDraft, setRulerDraft, startRulerDraft, updateRulerPoint, setRulerOptions } from '@interaction/interactionState';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import { toSvgPoint } from '@ui/canvas/zones/zoneGeometry';
import { TOUCH_NAVIGATION_START_EVENT } from '@ui/canvas/useCanvasTouchGestures';
import { LOCK_RULER_EVENT, REMOVE_RULER_POINT_EVENT, CLEAR_RULER_POINTS_EVENT } from './rulerEvents';

type Input = { encounter: EncounterState; active: boolean; options: RulerOptions; draft: RulerDraft | null; editingId: string | null };
const CONE_ANGLE_HANDLE = -1;
type PointEdit = {
  id: string | null; index: number; pointerId: number;
  history: RootState['encounter']; cone: ConeAngleHandleGeometry | null;
  lastAngle?: number; lastPoint: LayoutPoint;
  start: LayoutPoint; anchor: LayoutPoint; moved: boolean; points: LayoutPoint[];
};
export function useRulerInteraction(input: Input) {
  const store = useStore<RootState>();
  const { schedule, flush, cancel } = useRulerDragFrame();
  const [directManipulation, setDirectManipulation] = useState(false);
  const dispatch = useDispatch(), current = useRef(input); current.current = input;
  const [hover, setHover] = useState<LayoutPoint | null>(null), hoverRef = useRef<LayoutPoint | null>(null);
  const edit = useRef<PointEdit | null>(null);
  function pointer(event: React.MouseEvent<SVGElement>) { return toSvgPoint(event, event.currentTarget.ownerSVGElement!); }
  function normalize(p: LayoutPoint, index: number) {
    if (index === 0) return snapRulerOrigin(input.encounter, p, input.options);
    return rulerSnapEnabled(input.encounter, input.options) && input.options.shape === 'path' ? snapToGrid(resolveGridGeometry(input.encounter.grid), p, 'medium') : p;
  }
  function preview(point: LayoutPoint | null) { hoverRef.current = point; setHover(point); }
  function pickUpLastPoint(point?: LayoutPoint) {
    cancel(); setDirectManipulation(false);
    const draft = current.current.draft;
    if (!draft?.points.length) return;
    const remaining = draft.points.slice(0, -1), last = draft.points.at(-1)!;
    edit.current = null;
    dispatch(setRulerDraft(remaining.length ? { points: remaining, complete: false } : null));
    preview(remaining.length ? point ?? hoverRef.current ?? last : null);
  }
  function onContextMenu(event: React.MouseEvent<SVGElement>) {
    event.preventDefault(); event.stopPropagation();
    pickUpLastPoint(normalize(pointer(event), Math.max(1, (current.current.draft?.points.length ?? 1) - 1)));
  }
  function lock() {
    flush();
    const { active } = current.current, draft = selectRulerDraft(store.getState());
    if (!active || !draft || draft.points.length < 2) return;
    dispatch(lockRulerDraft([...draft.points])); preview(null); edit.current = null; setDirectManipulation(false);
  }
  useEffect(() => {
    function clear() { cancel(); setDirectManipulation(false); edit.current = null; hoverRef.current = null; setHover(null); dispatch(setRulerDraft(null)); }
    const key = (event: KeyboardEvent) => {
      if (!current.current.active || ignoreShortcut(event)) return;
      if (event.key === 'Escape') { event.preventDefault(); clear(); }
      else if (event.code === 'Space' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) { event.preventDefault(); event.stopImmediatePropagation(); lock(); }
    };
    window.addEventListener('keydown', key, true);
    const remove = () => pickUpLastPoint();
    window.addEventListener(REMOVE_RULER_POINT_EVENT, remove);
    window.addEventListener(CLEAR_RULER_POINTS_EVENT, clear);
    window.addEventListener(LOCK_RULER_EVENT, lock);
    window.addEventListener(TOUCH_NAVIGATION_START_EVENT, clear);
    return () => { window.removeEventListener(REMOVE_RULER_POINT_EVENT, remove); window.removeEventListener(CLEAR_RULER_POINTS_EVENT, clear); window.removeEventListener('keydown', key, true); window.removeEventListener(LOCK_RULER_EVENT, lock); window.removeEventListener(TOUCH_NAVIGATION_START_EVENT, clear); };
  }, [dispatch, cancel, flush, store]);
  useEffect(() => { cancel(); setDirectManipulation(false); preview(null); edit.current = null; }, [input.active, input.encounter.id, input.options.shape, input.editingId, input.draft === null, cancel]);
  const canvas = {
    onPointerDown(event: PointerEvent<SVGElement>) {
      if (event.button !== 0) return;
      event.stopPropagation(); event.preventDefault();
      const point = normalize(pointer(event), input.draft?.points.length ?? 0);
      if (input.draft && input.draft.points.length >= 2) {
        const svg = event.currentTarget.ownerSVGElement;
        const matrix = svg?.getScreenCTM?.();
        const nearPoint = input.draft.points.some(p => {
          if (!matrix) return Math.hypot(p.x - point.x, p.y - point.y) <= 12;
          const x = matrix.a * p.x + matrix.c * p.y + matrix.e;
          const y = matrix.b * p.x + matrix.d * p.y + matrix.f;
          return Math.hypot(x - event.clientX, y - event.clientY) <= 12;
        });
        if (input.options.shape !== 'path' || nearPoint) { lock(); return; }
      }
      if (input.options.shape === 'path' && input.draft && !input.draft.complete) dispatch(setRulerDraft({ points: [...input.draft.points, point], complete: false }));
      else if (input.draft && !input.draft.complete) dispatch(setRulerDraft({ points: [input.draft.points[0], point], complete: true }));
      else dispatch(startRulerDraft({ points: [snapRulerOrigin(input.encounter, point, input.options)], complete: false }));
      preview(null);
    },
    onPointerMove(event: PointerEvent<SVGElement>) { if (event.buttons & 2) return; event.stopPropagation(); preview(normalize(pointer(event), input.draft?.points.length ?? 0)); },
    onPointerLeave() { preview(null); },
    onContextMenu,
    onPointerCancel() { cancel(); setDirectManipulation(false); edit.current = null; preview(null); dispatch(setRulerDraft(null)); }
  };
  function pointHandlers(id: string | null, index: number) {
    function move(event: PointerEvent<SVGCircleElement>) {
      if (event.buttons & 2) return;
      event.stopPropagation(); if (edit.current?.index === index && edit.current.id === id && edit.current.pointerId === event.pointerId) {
        if (Math.hypot(event.clientX - edit.current.start.x, event.clientY - edit.current.start.y) >= 3) edit.current.moved = true;
        if (edit.current.moved) {
          const point = normalize(pointer(event), index);
          if (index === CONE_ANGLE_HANDLE && edit.current.cone) {
            const gesture = edit.current;
            const angle = draggedConeAngle(current.current.encounter, gesture.cone!, gesture.anchor, pointer(event));
            if (angle === (gesture.lastAngle ?? gesture.cone!.angle)) return;
            gesture.lastAngle = angle; setDirectManipulation(true);
            schedule(() => {
              if (edit.current === gesture && store.getState().encounter === gesture.history) dispatch(setRulerOptions({ angle }));
            });
          } else if (index === 0 && current.current.options.shape === 'circle' && edit.current.points.length >= 2) {
            const gesture = edit.current;
            if (Math.hypot(point.x - gesture.lastPoint.x, point.y - gesture.lastPoint.y) < 1e-6) return;
            gesture.lastPoint = point;
            setDirectManipulation(true);
            schedule(() => {
              if (edit.current !== gesture || store.getState().encounter !== gesture.history) return;
              // Translate the frozen baseline, never the previous frame, to preserve radius.
              const grid = resolveGridGeometry(current.current.encounter.grid);
              const anchor = worldToGrid(grid, gesture.anchor), target = worldToGrid(grid, point);
              const points = gesture.points.map(p => {
                const local = worldToGrid(grid, p);
                return gridToWorld(grid, { x: local.x + target.x - anchor.x, y: local.y + target.y - anchor.y });
              });
              dispatch(setRulerDraft({ points, complete: true }));
            });
          } else {
            const gesture = edit.current, baseline = gesture.points[index];
            if (!baseline) return;
            const grid = resolveGridGeometry(current.current.encounter.grid);
            const anchor = worldToGrid(grid, gesture.anchor), target = worldToGrid(grid, pointer(event));
            const origin = worldToGrid(grid, baseline);
            // Preserve the grab offset, including handles displayed away from their stored point.
            const next = normalize(gridToWorld(grid, { x: origin.x + target.x - anchor.x, y: origin.y + target.y - anchor.y }), index);
            if (Math.hypot(next.x - gesture.lastPoint.x, next.y - gesture.lastPoint.y) < 1e-6) return;
            gesture.lastPoint = next; setDirectManipulation(true);
            schedule(() => {
              if (edit.current === gesture && store.getState().encounter === gesture.history) dispatch(updateRulerPoint({ id, index, point: next }));
            });
          }
        }
      }
    }
    return {
      onPointerDown(event: PointerEvent<SVGCircleElement>) {
        if (event.button !== 0) return;
        event.stopPropagation(); event.preventDefault(); cancel();
        const anchor = index === 0 && current.current.options.shape === 'circle' ? normalize(pointer(event), index) : pointer(event);
        const cone = index === CONE_ANGLE_HANDLE ? coneAngleHandle(current.current.encounter, current.current.draft?.points ?? [], current.current.options) : null;
        edit.current = { id, index, cone, pointerId: event.pointerId, history: store.getState().encounter, lastPoint: current.current.draft?.points[index] ?? anchor,
          start: { x: event.clientX, y: event.clientY }, anchor, moved: false,
          points: current.current.draft?.points.map(p => ({ ...p })) ?? [] };
        preview(null); event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: move,
      onPointerUp(event: PointerEvent<SVGCircleElement>) {
        if (event.button !== 0 || edit.current?.pointerId !== event.pointerId) return;
        if (edit.current.moved) move(event);
        flush(); setDirectManipulation(false);
        event.stopPropagation(); const clicked = edit.current && !edit.current.moved; edit.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId);
        const draft = current.current.draft;
        if (clicked && (draft?.points.length ?? 0) >= 2) lock();
      },
      onPointerCancel() { cancel(); setDirectManipulation(false); edit.current = null; },
      onContextMenu
    };
  }
  return { hover, canvas, pointHandlers, coneAngleHandlers: (id: string | null) => pointHandlers(id, CONE_ANGLE_HANDLE), pickUpLastPoint, directManipulation };
}
