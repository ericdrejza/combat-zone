import { useEffect } from 'react';
import { matchesKeybind } from '@ui/keybinds';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import type { FocusController } from './FocusLightContext';
import type { FocusPreferences } from './focusPreferences';

/** Own one GM input stream; no keyboard or pointer listeners are attached to player output. */
export function useFocusInput(controller: FocusController, binding: string, activation: FocusPreferences['activation'], encounterId: string) {
  useEffect(() => {
    let heldKey: string | null = null;
    let suppressedGesture = false;
    const activate = (active: boolean) => {
      controller.active = active;
      if (active) document.documentElement.dataset.canvasFocus = 'true';
      else { delete document.documentElement.dataset.canvasFocus; heldKey = null; }
    };
    const reset = () => { activate(false); controller.pointer = null; controller.buttons = 0; };
    reset();
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || ignoreShortcut(event, true, true)) return;
      if (event.key === 'Escape' && controller.active) { activate(false); event.preventDefault(); return; }
      if (!matchesKeybind(event, binding) || controller.buttons) return;
      event.preventDefault();
      activate(activation === 'hold' || !controller.active);
      if (controller.active) heldKey = event.code || event.key.toLowerCase();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (activation !== 'hold' || !controller.active) return;
      const modifier = ({ Control: 'ctrl', Meta: 'meta', Alt: 'alt', Shift: 'shift' } as Record<string, string>)[event.key];
      if ((event.code || event.key.toLowerCase()) === heldKey || (modifier && binding.includes(`${modifier}+`))) activate(false);
    };
    const surface = (event: Event) => {
      const target = event.target as Element | null;
      const element = target?.nodeType === 1 ? target.closest('[data-focus-surface]') : null;
      return element && controller.surfaces.has(element) ? element : null;
    };
    const sample = (event: MouseEvent) => {
      const element = surface(event);
      controller.buttons = event.buttons;
      controller.pointer = element ? { element, point: { x: event.clientX, y: event.clientY } } : null;
      if (element && controller.active && event.type !== 'pointerdown') event.stopImmediatePropagation();
    };
    const block = (event: Event) => {
      if (!surface(event)) return;
      if (event.type === 'pointerdown' || event.type === 'mousedown') suppressedGesture = controller.active;
      if (!controller.active && !(suppressedGesture && event.type === 'click')) return;
      if (event.type === 'click') suppressedGesture = false;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const up = (event: MouseEvent) => { controller.buttons = event.buttons; };
    const focus = (event: FocusEvent) => { if (ignoreShortcut(event, true, true)) activate(false); };
    const visibility = () => { if (document.hidden) reset(); };
    const leave = (event: MouseEvent) => { if (!event.relatedTarget) controller.pointer = null; };
    const blocked = ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'dragstart', 'dragover', 'drop'] as const;
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);
    window.addEventListener('pointermove', sample, true);
    window.addEventListener('mousemove', sample, true);
    window.addEventListener('pointerdown', sample, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('mouseup', up, true);
    window.addEventListener('mouseout', leave);
    window.addEventListener('focusin', focus);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    blocked.forEach(type => window.addEventListener(type, block, true));
    return () => {
      reset();
      window.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('keyup', keyUp, true);
      window.removeEventListener('pointermove', sample, true);
      window.removeEventListener('mousemove', sample, true);
      window.removeEventListener('pointerdown', sample, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('mouseup', up, true);
      window.removeEventListener('mouseout', leave);
      window.removeEventListener('focusin', focus);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
      blocked.forEach(type => window.removeEventListener(type, block, true));
    };
  }, [controller, binding, activation, encounterId]);
}
