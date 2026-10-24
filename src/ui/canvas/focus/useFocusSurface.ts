import { useContext, useEffect, useRef, type RefObject } from 'react';
import { FocusLightContext, type FocusMapper } from './FocusLightContext';

/** Register input geometry without making pointer movement rerender the canvas. */
export function useFocusSurface(ref: RefObject<Element>, map: FocusMapper) {
  const controller = useContext(FocusLightContext)?.controller;
  const latest = useRef(map);
  latest.current = map;
  useEffect(() => {
    const element = ref.current;
    if (!element || !controller) return;
    controller.surfaces.set(element, (point, surface) => latest.current(point, surface));
    return () => {
      controller.surfaces.delete(element);
      if (controller.pointer?.element === element) controller.pointer = null;
    };
  }, [controller, ref]);
}
