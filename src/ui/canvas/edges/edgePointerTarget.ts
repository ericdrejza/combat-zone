type PointerTargetEvent = {
  clientX: number;
  clientY: number;
  pointerType?: string;
  target: EventTarget | null;
};

function zoneIdFromElement(element: Element | null): string | undefined {
  return element
    ?.closest<SVGElement>('[data-entity-type="zone"]')
    ?.dataset.entityId;
}

/**
 * Touch pointers are implicitly captured by their press target, so their event
 * target does not follow the finger. Hit-test the viewport coordinates to find
 * the Zone physically below a touch or pen drag instead.
 */
export function getPointerTargetZoneId(event: PointerTargetEvent): string | undefined {
  if (event.pointerType && event.pointerType !== 'mouse') {
    const elementsAtPoint = document.elementsFromPoint?.(
      event.clientX,
      event.clientY
    );
    const physicalZoneId = elementsAtPoint
      ?.map((element) => zoneIdFromElement(element))
      .find((zoneId): zoneId is string => Boolean(zoneId));

    if (physicalZoneId) return physicalZoneId;

    const topElement = document.elementFromPoint?.(event.clientX, event.clientY);
    const topZoneId = zoneIdFromElement(topElement);
    if (topZoneId) return topZoneId;
  }

  return event.target instanceof Element
    ? zoneIdFromElement(event.target)
    : undefined;
}
