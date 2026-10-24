import { fireEvent, render, screen } from '@testing-library/react';
import { useProjectionInput } from '@ui/player_view/useProjectionInput';
import type { usePlayerCamera } from '@ui/player_view/usePlayerCamera';

function setup(interactive = true) {
  const panBy = vi.fn(), zoomAt = vi.fn(), zoomBy = vi.fn(), stopPanAnimation = vi.fn();
  const camera = { region: { x: 0, y: 0, width: 800, height: 600 }, panBy, zoomAt, zoomBy,
    viewport: { zoom: 1, panEnabled: true, stopPanAnimation } } as unknown as ReturnType<typeof usePlayerCamera>;
  function View() {
    const ref = useProjectionInput(camera, { width: 800, height: 600 }, interactive);
    return <div ref={ref} data-testid="projection" />;
  }
  render(<View />);
  const element = screen.getByTestId('projection');
  element.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  return { element, panBy, zoomAt, zoomBy };
}

it('pans with right drag and wheel, and zooms around the Ctrl-wheel canvas point', () => {
  const { element, panBy, zoomBy } = setup();
  fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(element, { pointerId: 1, pointerType: 'mouse', clientX: 180, clientY: 190 });
  expect(panBy).toHaveBeenLastCalledWith(20, 10);
  fireEvent.pointerUp(element, { pointerId: 1 });
  fireEvent.wheel(element, { deltaY: 30, shiftKey: true });
  expect(panBy).toHaveBeenLastCalledWith(30, 0);
  fireEvent.wheel(element, { deltaY: -50, ctrlKey: true, clientX: 250, clientY: 300 });
  expect(zoomBy).toHaveBeenLastCalledWith(0.1, expect.objectContaining({ x: 250, y: 300 }));
});

it('keeps the initial midpoint anchored through two-finger pan and pinch, then clears cancelled pointers', () => {
  const { element, zoomAt, panBy } = setup();
  fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 200 });
  fireEvent.pointerDown(element, { pointerId: 2, pointerType: 'touch', clientX: 400, clientY: 200 });
  fireEvent.pointerMove(element, { pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 200 });
  expect(zoomAt).toHaveBeenLastCalledWith(1.1, expect.objectContaining({ x: 300, y: 200 }), expect.objectContaining({ x: 290, y: 200 }));
  expect(panBy).not.toHaveBeenCalled();
  fireEvent.pointerCancel(element, { pointerId: 1, pointerType: 'touch' });
  zoomAt.mockClear();
  fireEvent.pointerMove(element, { pointerId: 2, pointerType: 'touch', clientX: 500, clientY: 200 });
  expect(zoomAt).not.toHaveBeenCalled();
});

it('does not navigate from player output', () => {
  const { element, zoomAt, zoomBy, panBy } = setup(false);
  fireEvent.wheel(element, { deltaY: 50, ctrlKey: true });
  fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(element, { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 200 });
  expect(zoomAt).not.toHaveBeenCalled(); expect(zoomBy).not.toHaveBeenCalled(); expect(panBy).not.toHaveBeenCalled();
});
