import { createContext } from 'react';
import type { MotionValue } from 'motion/react';
import type { LayoutPoint } from '@core/layout/types';
import type { FocusPreferences } from './focusPreferences';

export type FocusMapper = (point: LayoutPoint, element: Element) => LayoutPoint | null;
export type FocusController = {
  active: boolean;
  buttons: number;
  pointer: { element: Element; point: LayoutPoint } | null;
  surfaces: Map<Element, FocusMapper>;
};
export type FocusLight = {
  controller: FocusController;
  x: MotionValue<number>; y: MotionValue<number>;
  visible: MotionValue<boolean>; trail: MotionValue<string>;
  preferences: FocusPreferences;
};
export const FocusLightContext = createContext<FocusLight | null>(null);
