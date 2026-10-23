import { animate } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { useMotionPreference } from '@ui/motion_preferences/MotionPreferenceProvider';

/** Only the owning scroll area moves; clipping ancestors limit how much of the picker fits. */
export function expandedPickerScrollTarget(picker: HTMLElement): { scroller: HTMLElement; top: number } | null {
  const view = picker.ownerDocument.defaultView;
  if (!view) return null;
  const viewport = view.visualViewport;
  let top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? view.innerHeight);
  let scroller: HTMLElement | null = null;
  for (let parent = picker.parentElement; parent; parent = parent.parentElement) {
    const overflow = view.getComputedStyle(parent).overflowY;
    if (!/^(auto|scroll|overlay|hidden|clip)$/.test(overflow)) continue;
    const bounds = parent.getBoundingClientRect();
    const innerTop = bounds.top + parent.clientTop;
    top = Math.max(top, innerTop); bottom = Math.min(bottom, innerTop + parent.clientHeight);
    if (!scroller && /^(auto|scroll|overlay)$/.test(overflow) && parent.scrollHeight > parent.clientHeight) scroller = parent;
  }
  const bounds = picker.getBoundingClientRect(), available = bottom - top;
  if (!scroller || available <= 0 || bounds.height <= 0) return null;
  const delta = bounds.height > available || bounds.top < top ? bounds.top - top : Math.max(0, bounds.bottom - bottom);
  const target = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + delta));
  return Math.abs(target - scroller.scrollTop) > 0.5 ? { scroller, top: target } : null;
}

/** Reveal newly expanded palettes without repeatedly scrolling during color adjustments. */
export function useExpandedPickerReveal(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const { animationsDisabled } = useMotionPreference();
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const target = expandedPickerScrollTarget(ref.current);
    if (!target) return;
    const { scroller, top } = target;
    if (animationsDisabled) { scroller.scrollTop = top; return; }
    const animation = animate(scroller.scrollTop, top, { duration: 0.18, ease: 'easeOut', onUpdate: value => { scroller.scrollTop = value; } });
    const stop = () => animation.stop();
    scroller.addEventListener('wheel', stop, { passive: true });
    scroller.addEventListener('touchstart', stop, { passive: true });
    return () => { stop(); scroller.removeEventListener('wheel', stop); scroller.removeEventListener('touchstart', stop); };
  }, [open, animationsDisabled]);
  return ref;
}
