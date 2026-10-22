import { act, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";

import { useCanvasZoom } from "@ui/canvas/useCanvasZoom";

function setup() {
  const element = document.createElement("div");
  element.scrollLeft = 200;
  element.scrollTop = 100;
  const painted: { zoom: number; left: number; top: number }[] = [];
  const options = {
    canvasSize: { width: 2000, height: 2000 },
    viewportElement: element,
    getViewportSize: () => ({ width: 500, height: 500 })
  };
  const hook = renderHook(() => {
    const zoom = useCanvasZoom(options);
    // A consumer's layout effect observes the final geometry before browser paint.
    useLayoutEffect(() => {
      painted.push({ zoom: zoom.zoom, left: element.scrollLeft, top: element.scrollTop });
    }, [zoom.zoom]);
    return zoom;
  });
  return { ...hook, element, painted };
}

it("commits wheel zoom and pointer-preserving scroll together before paint", () => {
  const { result, painted } = setup();
  act(() => result.current.zoomByWheelAtPoint(-100, { x: 150, y: 200 }));
  expect(painted.at(-1)?.zoom).toBe(1.1);
  expect(painted.at(-1)?.left).toBeCloseTo(235);
  expect(painted.at(-1)?.top).toBeCloseTo(130);
});

it("preserves the pointer anchor across wheel events batched before a render", () => {
  const { result, element } = setup();
  act(() => {
    for (let i = 0; i < 3; i++) result.current.zoomByWheelAtPoint(-100, { x: 150, y: 200 });
  });
  expect(result.current.zoom).toBe(1.3);
  expect(element.scrollLeft).toBeCloseTo(305);
  expect(element.scrollTop).toBeCloseTo(190);
  act(() => {
    for (let i = 0; i < 3; i++) result.current.zoomByWheelAtPoint(100, { x: 150, y: 200 });
  });
  expect(result.current.zoom).toBe(1);
  expect(element.scrollLeft).toBeCloseTo(200);
  expect(element.scrollTop).toBeCloseTo(100);
});

it("preserves the center across rapid button commands and respects zoom bounds", () => {
  const { result, element } = setup();
  act(() => {
    result.current.setCenteredZoom(1.1);
    result.current.setCenteredZoom(1.2);
  });
  expect(element.scrollLeft).toBeCloseTo(290);
  expect(element.scrollTop).toBeCloseTo(170);
  act(() => result.current.setCenteredZoom(10));
  expect(result.current.zoom).toBe(4);
  act(() => result.current.zoomByWheelAtPoint(-100, { x: 150, y: 200 }));
  expect(result.current.zoom).toBe(4);
  act(() => result.current.setCenteredZoom(0));
  expect(result.current.zoom).toBe(0.2);
});

it("keeps explicit touch anchors and temporary zoom restoration working", () => {
  const { result, element } = setup();
  act(() => result.current.setZoomAtPoint(2, { x: 150, y: 200 }, { x: 300, y: 250 }));
  expect(element.scrollLeft).toBe(450);
  expect(element.scrollTop).toBe(300);
  let release = () => {};
  act(() => { release = result.current.beginTemporaryMaxZoom(); });
  expect(result.current.zoom).toBe(4);
  act(() => release());
  expect(result.current.zoom).toBe(2);
  act(() => { release = result.current.beginTemporaryMaxZoom(); });
  act(() => result.current.zoomByWheelAtPoint(100, { x: 150, y: 200 }));
  act(() => release());
  expect(result.current.zoom).toBe(3.9);
});
