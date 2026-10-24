import { focusAtZoom, focusImageBox, isImageFocus, moveFocus, sameImageFocus } from "@core/assets/imageFocus";

it.each([{ width: 1200, height: 600 }, { width: 600, height: 1200 }, { width: 600, height: 600 }])("keeps a square source crop at every zoom for %j", dimensions => {
  for (const zoom of [1, 2, 4]) {
    const focus = focusAtZoom(dimensions, zoom);
    expect(focus.width * dimensions.width).toBeCloseTo(focus.height * dimensions.height);
    expect(Math.max(focus.width, focus.height)).toBeCloseTo(1 / zoom);
    expect(isImageFocus(focus)).toBe(true);
    expect(isImageFocus(moveFocus(focus, 100, -100))).toBe(true);
  }
});

it("preserves the focus center during zoom and clamps panning at the source edges", () => {
  const dimensions = { width: 1200, height: 600 };
  const centered = focusAtZoom(dimensions, 2);
  expect(centered).toEqual({ x: 0.375, y: 0.25, width: 0.25, height: 0.5 });
  const dragged = moveFocus(centered, 0.25, -0.25);
  expect(dragged).toEqual({ ...centered, x: 0.3125, y: 0.375 });
  const zoomed = focusAtZoom(dimensions, 4, dragged);
  expect(zoomed.x + zoomed.width / 2).toBeCloseTo(dragged.x + dragged.width / 2);
  expect(moveFocus(centered, 100, 100)).toMatchObject({ x: 0, y: 0 });
  expect(moveFocus(centered, -100, -100)).toMatchObject({ x: 0.75, y: 0.5 });
  expect(focusImageBox(centered)).toEqual({ x: -1.5, y: -0.5, width: 4, height: 2 });
  expect(sameImageFocus(centered, { ...centered })).toBe(true);
  expect(sameImageFocus(centered, undefined)).toBe(false);
});

it.each([null, {}, { x: -0.1, y: 0, width: 1, height: 1 }, { x: 0.9, y: 0, width: 0.5, height: 0.5 },
  { x: 0, y: 0, width: 0, height: 1 }, { x: NaN, y: 0, width: 1, height: 1 },
  { x: 0, y: 0, width: 0.1, height: 0.1 }])("rejects invalid or out-of-range focus %j", focus => {
  expect(isImageFocus(focus)).toBe(false);
});
