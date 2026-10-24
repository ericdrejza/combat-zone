import { useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useAnimationFrame, useMotionValue } from 'motion/react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import type { LayoutPoint } from '@core/layout/types';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { useMotionPreference } from '@ui/motion_preferences/MotionPreferenceProvider';
import { useKeybinds } from '@ui/keybinds';
import { FocusLightContext, type FocusController } from './FocusLightContext';
import { advanceFocusTrail, focusTrailPath } from './focusTrail';
import { useFocusInput } from './useFocusInput';

/** One Motion clock drives the GM pointer and every projection without frame-by-frame React updates. */
export function FocusLightProvider({ children }: PropsWithChildren) {
  const { preferences: { focus } } = useCanvasPreferences();
  const { animationsDisabled } = useMotionPreference();
  const { bindings } = useKeybinds();
  const encounterId = useSelector((state: RootState) => state.encounter.present.id);
  const [controller] = useState<FocusController>(() => ({ active: false, buttons: 0, pointer: null, surfaces: new Map() }));
  const x = useMotionValue(0), y = useMotionValue(0), visible = useMotionValue(false), trail = useMotionValue('');
  const points = useRef<LayoutPoint[]>([]);
  useFocusInput(controller, bindings['canvas.focus'], focus.activation, encounterId);
  useAnimationFrame((_time, delta) => {
    const pointer = controller.pointer;
    const point = controller.active && pointer ? controller.surfaces.get(pointer.element)?.(pointer.point, pointer.element) : null;
    if (!point) { visible.set(false); points.current = []; trail.set(''); return; }
    x.set(point.x); y.set(point.y);
    if (!points.current.length || animationsDisabled) points.current = Array.from({ length: 8 }, () => ({ ...point }));
    points.current = advanceFocusTrail(points.current, point, delta, focus.tailLength * 100);
    trail.set(animationsDisabled || focus.tailLength === 0 ? '' : focusTrailPath(point, points.current));
    visible.set(true);
  });
  const value = useMemo(() => ({ controller, x, y, visible, trail, preferences: focus }), [controller, x, y, visible, trail, focus]);
  return <FocusLightContext.Provider value={value}>{children}</FocusLightContext.Provider>;
}
