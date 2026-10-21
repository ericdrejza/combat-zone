import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { PointerEvent } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { RulerDraft, RulerOptions } from '@core/measurement/types';
import { snapRulerOrigin, rulerSnapEnabled } from '@core/measurement/areaGeometry';
import { snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { lockRulerDraft, setRulerDraft, startRulerDraft, updateRulerPoint } from '@interaction/interactionState';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import { toSvgPoint } from '@ui/canvas/zones/zoneGeometry';
import { TOUCH_NAVIGATION_START_EVENT } from '@ui/canvas/useCanvasTouchGestures';
import { LOCK_RULER_EVENT } from './rulerEvents';

type Input = { encounter: EncounterState; active: boolean; options: RulerOptions; draft: RulerDraft | null; editingId: string | null };
export function useRulerInteraction(input: Input) {
  const dispatch = useDispatch(), current = useRef(input); current.current = input;
  const [hover, setHover] = useState<LayoutPoint | null>(null), hoverRef = useRef<LayoutPoint | null>(null);
  const edit = useRef<{ id: string | null; index: number; start: LayoutPoint; moved: boolean } | null>(null);
  function pointer(event: React.MouseEvent<SVGElement>) { return toSvgPoint(event, event.currentTarget.ownerSVGElement!); }
  function normalize(p: LayoutPoint, index: number) {
    if (index === 0) return snapRulerOrigin(input.encounter, p, input.options);
    return rulerSnapEnabled(input.encounter, input.options) && input.options.shape === 'path' ? snapToGrid(resolveGridGeometry(input.encounter.grid), p, 'medium') : p;
  }
  function preview(point: LayoutPoint | null) { hoverRef.current = point; setHover(point); }
  function pickUpLastPoint(point?: LayoutPoint) {
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
  useEffect(() => {
    function clear() { edit.current = null; hoverRef.current = null; setHover(null); dispatch(setRulerDraft(null)); }
    function lock() {
      const { active, draft } = current.current;
      if (!active || !draft) return;
      const points = [...draft.points];
      if (points.length < 2) return;
      dispatch(lockRulerDraft(points)); hoverRef.current = null; setHover(null); edit.current = null;
    }
    const key = (event: KeyboardEvent) => {
      if (!current.current.active || ignoreShortcut(event)) return;
      if (event.key === 'Escape') { event.preventDefault(); clear(); }
      else if (event.code === 'Space' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) { event.preventDefault(); event.stopImmediatePropagation(); lock(); }
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener(LOCK_RULER_EVENT, lock);
    window.addEventListener(TOUCH_NAVIGATION_START_EVENT, clear);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener(LOCK_RULER_EVENT, lock); window.removeEventListener(TOUCH_NAVIGATION_START_EVENT, clear); };
  }, [dispatch]);
  useEffect(() => { preview(null); edit.current = null; }, [input.active, input.encounter.id, input.options.shape, input.editingId]);
  const canvas = {
    onPointerDown(event: PointerEvent<SVGElement>) {
      if (event.button !== 0) return;
      event.stopPropagation(); event.preventDefault();
      const point = normalize(pointer(event), input.draft?.points.length ?? 0);
      if (input.editingId && input.options.shape !== 'path' && input.draft && input.draft.points.length >= 2) return;
      if (input.options.shape === 'path' && input.draft && !input.draft.complete) dispatch(setRulerDraft({ points: [...input.draft.points, point], complete: false }));
      else if (input.draft && !input.draft.complete) dispatch(setRulerDraft({ points: [input.draft.points[0], point], complete: true }));
      else dispatch(startRulerDraft({ points: [snapRulerOrigin(input.encounter, point, input.options)], complete: false }));
      preview(null);
    },
    onPointerMove(event: PointerEvent<SVGElement>) { if (event.buttons & 2) return; event.stopPropagation(); preview(normalize(pointer(event), input.draft?.points.length ?? 0)); },
    onPointerLeave() { preview(null); },
    onContextMenu,
    onPointerCancel() { edit.current = null; preview(null); dispatch(setRulerDraft(null)); }
  };
  function pointHandlers(id: string | null, index: number) {
    return {
      onPointerDown(event: PointerEvent<SVGCircleElement>) {
        if (event.button !== 0) return;
        event.stopPropagation(); event.preventDefault(); edit.current = { id, index, start: { x: event.clientX, y: event.clientY }, moved: false }; preview(null); event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event: PointerEvent<SVGCircleElement>) {
        if (event.buttons & 2) return;
        event.stopPropagation(); if (edit.current?.index === index && edit.current.id === id) {
          if (Math.hypot(event.clientX - edit.current.start.x, event.clientY - edit.current.start.y) >= 3) edit.current.moved = true;
          if (edit.current.moved) dispatch(updateRulerPoint({ id, index, point: normalize(pointer(event), index) }));
        }
      },
      onPointerUp(event: PointerEvent<SVGCircleElement>) {
        if (event.button !== 0) return;
        event.stopPropagation(); const clicked = edit.current && !edit.current.moved; edit.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId);
        const draft = current.current.draft;
        if (clicked && index === 1 && draft?.points.length === 2) {
          const point = normalize(pointer(event), 1);
          dispatch(setRulerDraft({ points: [draft.points[0]], complete: false })); preview(point);
        }
      },
      onPointerCancel() { edit.current = null; },
      onContextMenu
    };
  }
  return { hover, canvas, pointHandlers, pickUpLastPoint };
}
