import { fireEvent, render, screen } from '@testing-library/react';
import * as motion from 'motion/react';
import * as motionPreferences from '@ui/motion_preferences/MotionPreferenceProvider';
import { ColorPicker } from '@ui/controls/ColorPicker';
import { expandedPickerScrollTarget } from '@ui/controls/useExpandedPickerReveal';

function bounds(top: number, height: number): DOMRect {
  return { top, bottom: top + height, left: 0, right: 250, width: 250, height, x: 0, y: top, toJSON() {} };
}
function scrollArea(element: HTMLElement, top = 100, height = 400, content = 1200) {
  element.style.overflowY = 'auto';
  element.getBoundingClientRect = () => bounds(top, height);
  Object.defineProperties(element, { clientHeight: { configurable: true, value: height }, scrollHeight: { configurable: true, value: content } });
  element.scrollTop = 40;
}
function setup(top: number, height: number) {
  const onChange = vi.fn();
  const view = render(<div data-testid="outer"><div data-testid="panel"><ColorPicker label="Fill color" value="#123456" fallbackColor="#ffffff" onChange={onChange} /></div></div>);
  const panel = screen.getByTestId('panel'); scrollArea(panel);
  const opener = screen.getByRole('button', { name: 'Fill color' });
  // The palette root persists while its expanded children are mounted.
  const picker = opener.parentElement!;
  picker.getBoundingClientRect = () => bounds(top, height);
  const stop = vi.fn();
  const animate = vi.spyOn(motion, 'animate').mockImplementation(((from: number, to: number, options: { onUpdate: (value: number) => void }) => {
    options.onUpdate(to); return { stop };
  }) as unknown as typeof motion.animate);
  return { ...view, panel, opener, picker, onChange, animate, stop };
}
afterEach(() => vi.restoreAllMocks());

it('reveals the complete expanded picker with only the necessary panel scroll', () => {
  const { panel, opener, animate, onChange } = setup(450, 300);
  expect(panel.scrollTop).toBe(40);
  fireEvent.click(opener);
  expect(panel.scrollTop).toBe(290); expect(animate).toHaveBeenCalledOnce();
  expect(opener).toHaveAttribute('aria-expanded', 'true'); expect(onChange).not.toHaveBeenCalled();
});
it('aligns the top when the picker is taller than the visible panel', () => {
  const { panel, opener } = setup(450, 600);
  fireEvent.click(opener); expect(panel.scrollTop).toBe(390);
});
it('does not scroll a picker that is already completely visible', () => {
  const { panel, opener, animate } = setup(150, 300);
  fireEvent.click(opener); expect(panel.scrollTop).toBe(40); expect(animate).not.toHaveBeenCalled();
});
it('reveals a picker clipped above the scroll area', () => {
  const { panel, opener } = setup(80, 300);
  fireEvent.click(opener); expect(panel.scrollTop).toBe(20);
});
it('does not restart reveal scrolling during color changes, and stops it on collapse', () => {
  const { opener, animate, stop } = setup(450, 300);
  fireEvent.click(opener);
  fireEvent.change(screen.getByRole('slider', { name: 'Fill color hue' }), { target: { value: '120' } });
  expect(animate).toHaveBeenCalledOnce();
  fireEvent.click(opener); expect(stop).toHaveBeenCalled();
});
it('stops automatic scrolling when the user scrolls or touches the panel', () => {
  const { panel, opener, stop } = setup(450, 300);
  fireEvent.click(opener); fireEvent.wheel(panel); expect(stop).toHaveBeenCalledOnce();
  fireEvent.touchStart(panel); expect(stop).toHaveBeenCalledTimes(2);
});
it('respects a clipping ancestor when deciding whether the whole picker fits', () => {
  const { panel, picker, opener } = setup(450, 300);
  const outer = screen.getByTestId('outer'); outer.style.overflowY = 'hidden';
  outer.getBoundingClientRect = () => bounds(150, 200);
  Object.defineProperty(outer, 'clientHeight', { value: 200 });
  expect(expandedPickerScrollTarget(picker)).toEqual({ scroller: panel, top: 340 });
  fireEvent.click(opener); expect(panel.scrollTop).toBe(340);
});
it('does not scroll unrelated ancestors when no owning scroll area exists', () => {
  const { panel, picker, opener, animate } = setup(450, 300);
  panel.style.overflowY = 'visible';
  expect(expandedPickerScrollTarget(picker)).toBeNull();
  fireEvent.click(opener); expect(animate).not.toHaveBeenCalled();
});
it('clamps the target to the panel scroll range', () => {
  const { panel, picker } = setup(900, 300);
  scrollArea(panel, 100, 400, 600);
  expect(expandedPickerScrollTarget(picker)).toEqual({ scroller: panel, top: 200 });
});

it('reveals immediately when animations are disabled', () => {
  vi.spyOn(motionPreferences, 'useMotionPreference').mockReturnValue({ animationsDisabled: true, systemPrefersReducedMotion: true, enableAnimations: () => undefined });
  const { panel, opener, animate } = setup(450, 300);
  fireEvent.click(opener); expect(panel.scrollTop).toBe(290); expect(animate).not.toHaveBeenCalled();
});
