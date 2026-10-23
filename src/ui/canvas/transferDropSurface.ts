/** Hit-test overlays before converting a pointer release into a canvas mutation. */
export function transferDropSurface(
  event: { clientX: number; clientY: number; target: EventTarget | null },
  svg: SVGSVGElement
): "canvas" | "zoneless" | "outside" {
  const hit = svg.ownerDocument.elementFromPoint?.(event.clientX, event.clientY);
  const target = hit ?? (event.target instanceof Element ? event.target : null);
  if (target?.closest('[data-drop-target="zoneless-actors"]')) return "zoneless";
  // Ignore pointer capture targets when real hit-testing is available.
  if (hit && !svg.contains(hit)) return "outside";
  return "canvas";
}
