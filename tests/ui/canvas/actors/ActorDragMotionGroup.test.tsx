import { act, renderHook } from '@testing-library/react';
import type { PanInfo } from 'motion/react';
import { useActorDragCallbacks } from '@ui/canvas/actors/useActorDragCallbacks';

function pointer(time: number) {
  const event = new MouseEvent('pointermove');
  Object.defineProperty(event, 'timeStamp', { value: time });
  return event;
}

function pan(x: number, y: number, offsetX: number, offsetY: number): PanInfo {
  return { point: { x, y }, offset: { x: offsetX, y: offsetY }, delta: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
}

it('does not feed repeated frames or rebased offsets back into actor state across many pivots', () => {
  const onDrag = vi.fn();
  const callbacks = { onDrag };
  const { result, rerender } = renderHook(origin => useActorDragCallbacks(origin, callbacks), {
    initialProps: { x: 100, y: 100 }
  });
  const start = pointer(1);
  act(() => result.current.onDragStart(start, pan(1010, 1005, 10, 5)));
  for (let i = 1; i <= 50; i++) {
    const event = pointer(i + 1);
    const x = 1010 + i, y = 1005 + i * 2;
    act(() => result.current.onDrag(event, pan(x, y, i + 10, i * 2 + 5)));
    // A pivot/layout update can recreate the callbacks and change placement inputs.
    rerender({ x: 100 + i, y: 100 + i * 2 });
    act(() => {
      result.current.onDrag(event, pan(x, y, 2 * i + 20, 4 * i + 10));
      result.current.onDrag(event, pan(x, y, i + 10, i * 2 + 5));
    });
    expect(onDrag).toHaveBeenCalledTimes(i);
    expect(onDrag).toHaveBeenLastCalledWith({ x: 110 + i, y: 105 + i * 2 });
  }
});

it('ignores old queued movement, closes on release, and starts the next gesture from its own origin', () => {
  const onDrag = vi.fn(), onDragEnd = vi.fn();
  const { result, rerender } = renderHook(origin => useActorDragCallbacks(origin, { onDrag, onDragEnd }), {
    initialProps: { x: 100, y: 100 }
  });
  act(() => result.current.onDragStart(pointer(10), pan(50, 50, 0, 0)));
  act(() => result.current.onDrag(pointer(20), pan(80, 70, 30, 20)));
  act(() => result.current.onDrag(pointer(15), pan(60, 60, 10, 10)));
  expect(onDrag).toHaveBeenCalledTimes(1);
  act(() => result.current.onDragEnd(pointer(21)));
  act(() => result.current.onDrag(pointer(22), pan(90, 90, 40, 40)));
  expect(onDrag).toHaveBeenCalledTimes(1);
  expect(onDragEnd).toHaveBeenCalledTimes(1);
  rerender({ x: 300, y: 200 });
  act(() => result.current.onDragStart(pointer(30), pan(500, 500, 0, 0)));
  act(() => result.current.onDrag(pointer(20), pan(80, 70, 30, 20)));
  act(() => result.current.onDrag(pointer(31), pan(520, 510, 100, 100)));
  expect(onDrag).toHaveBeenCalledTimes(2);
  expect(onDrag).toHaveBeenLastCalledWith({ x: 320, y: 210 });
});
