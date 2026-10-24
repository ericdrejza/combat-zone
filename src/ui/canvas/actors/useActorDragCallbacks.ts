import { useRef } from 'react';
import type { PanInfo } from 'motion/react';
import type { LayoutPoint } from '@core/layout/types';

type MotionPointerEvent = MouseEvent | TouchEvent | PointerEvent;
export type ActorDragCallbacks = {
  onDragStart?: (event: MotionPointerEvent) => void;
  onDrag?: (point: LayoutPoint) => void;
  onDragEnd?: (event: MotionPointerEvent) => void;
};

/** Bind movement to one pointer gesture, independent of layout updates and replayed Motion frames. */
export function useActorDragCallbacks(origin: LayoutPoint, callbacks: ActorDragCallbacks) {
  const gesture = useRef<{
    origin: LayoutPoint;
    pointerOrigin: LayoutPoint;
    startedAt: number;
    lastEvent?: MotionPointerEvent;
    lastTime: number;
  }>();

  return {
    onDragStart(event: MotionPointerEvent, info: PanInfo) {
      if (gesture.current && event.timeStamp < gesture.current.startedAt) return;
      gesture.current = {
        origin: { ...origin },
        // Motion starts after its threshold; retain the original pointer-down point.
        pointerOrigin: { x: info.point.x - info.offset.x, y: info.point.y - info.offset.y },
        startedAt: event.timeStamp,
        lastTime: event.timeStamp
      };
      callbacks.onDragStart?.(event);
    },
    onDrag(event: MotionPointerEvent, info: PanInfo) {
      const current = gesture.current;
      // PanSession replays the last event every frame. Its offset can be rebased
      // during layout measurement, and old queued callbacks can arrive after a pivot.
      if (!current || event === current.lastEvent || event.timeStamp < current.startedAt || event.timeStamp < current.lastTime) return;
      current.lastEvent = event;
      current.lastTime = event.timeStamp;
      callbacks.onDrag?.({
        x: current.origin.x + info.point.x - current.pointerOrigin.x,
        y: current.origin.y + info.point.y - current.pointerOrigin.y
      });
    },
    onDragEnd(event: MotionPointerEvent) {
      if (!gesture.current || event.timeStamp < gesture.current.startedAt) return;
      gesture.current = undefined;
      callbacks.onDragEnd?.(event);
    }
  };
}
